using Application.Reports;
using Domain;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Infrastructure.Reports;

public sealed class EfReportService(AppDbContext db, IMemoryCache cache) : IReportService
{
    /// <summary>Prefix key cache cho báo cáo tổng quan toàn trường (theo học kỳ).</summary>
    private const string SchoolOverviewCachePrefix = "school-overview:";

    /// <summary>TTL ngắn vì dữ liệu gộp chỉ tăng khi có phiếu mới, chấp nhận độ trễ nhỏ.</summary>
    private static readonly TimeSpan SchoolOverviewCacheTtl = TimeSpan.FromSeconds(90);

    /// <summary>Số phiếu trả lời tối thiểu để một câu hỏi được xếp vào danh sách "yếu nhất" (tránh nhiễu).</summary>
    private const int WeakQuestionMinAnswers = 10;

    /// <summary>Số câu hỏi yếu nhất hiển thị trong bảng tổng quan.</summary>
    private const int WeakQuestionCount = 5;

    public async Task<OperationalProgressReportDto?> GetOperationalProgressReportAsync(
        int semesterId,
        CancellationToken cancellationToken = default)
    {
        var semester = await db.Semesters
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.SemesterId == semesterId, cancellationToken);
        if (semester is null) return null;

        var academicYear = await db.AcademicYears
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.AcademicYearId == semester.AcademicYearId, cancellationToken);

        var semesterSurveyIds = await db.SemesterSurveys
            .AsNoTracking()
            .Where(x => x.SemesterId == semesterId)
            .Select(x => x.SemesterSurveyId)
            .ToListAsync(cancellationToken);

        var sectionSurveys = await db.CourseSectionSurveys
            .AsNoTracking()
            .Where(x => semesterSurveyIds.Contains(x.SemesterSurveyId))
            .ToListAsync(cancellationToken);

        var sectionSurveyIds = sectionSurveys.Select(x => x.CourseSectionSurveyId).ToList();

        var responseCounts = await db.SurveyResponses
            .AsNoTracking()
            .Where(x => sectionSurveyIds.Contains(x.CourseSectionSurveyId))
            .GroupBy(x => x.CourseSectionSurveyId)
            .Select(g => new { CourseSectionSurveyId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.CourseSectionSurveyId, x => x.Count, cancellationToken);

        var sectionIds = sectionSurveys.Select(x => x.CourseSectionId).Distinct().ToList();
        var sections = await db.CourseSections
            .AsNoTracking()
            .Where(x => sectionIds.Contains(x.CourseSectionId))
            .ToListAsync(cancellationToken);

        var courseIds = sections.Select(x => x.CourseId).Distinct().ToList();
        var courses = await db.Courses
            .AsNoTracking()
            .Where(x => courseIds.Contains(x.CourseId))
            .ToListAsync(cancellationToken);

        var lecturerIds = sections.Select(x => x.LecturerId).Distinct().ToList();
        var lecturers = await db.Lecturers
            .AsNoTracking()
            .Where(x => lecturerIds.Contains(x.LecturerId))
            .ToListAsync(cancellationToken);

        var sectionDetails = new List<SectionProgressDetailDto>();
        int completedCount = 0;
        int inProgressCount = 0;
        int laggingCount = 0;

        foreach (var ss in sectionSurveys)
        {
            var sec = sections.FirstOrDefault(x => x.CourseSectionId == ss.CourseSectionId);
            var crs = courses.FirstOrDefault(x => x.CourseId == sec?.CourseId);
            var lec = lecturers.FirstOrDefault(x => x.LecturerId == sec?.LecturerId);

            int classSize = sec?.ClassSize ?? 0;
            int responseCount = responseCounts.TryGetValue(ss.CourseSectionSurveyId, out var cnt) ? cnt : 0;
            decimal rate = classSize > 0 ? Math.Round((decimal)responseCount / classSize * 100, 2) : 0;

            string status;
            if (rate >= 80)
            {
                status = "Hoàn thành";
                completedCount++;
            }
            else if (rate >= 40)
            {
                status = "Đang thu";
                inProgressCount++;
            }
            else
            {
                status = "Chậm tiến độ";
                laggingCount++;
            }

            sectionDetails.Add(new SectionProgressDetailDto(
                ss.CourseSectionSurveyId,
                crs?.CourseCode ?? string.Empty,
                crs?.CourseName ?? string.Empty,
                sec?.SectionName ?? string.Empty,
                lec?.FullName ?? "Chưa phân công",
                classSize,
                responseCount,
                rate,
                status
            ));
        }

        int totalTarget = sectionDetails.Sum(x => x.ClassSize);
        int totalActual = sectionDetails.Sum(x => x.ResponseCount);
        decimal overallRate = totalTarget > 0 ? Math.Round((decimal)totalActual / totalTarget * 100, 2) : 0;

        return new OperationalProgressReportDto(
            semester.SemesterId,
            semester.SemesterName,
            academicYear?.AcademicYearName ?? string.Empty,
            totalTarget,
            totalActual,
            overallRate,
            completedCount,
            inProgressCount,
            laggingCount,
            sectionDetails.OrderBy(x => x.CourseCode).ThenBy(x => x.SectionName).ToList()
        );
    }

    public async Task<IReadOnlyList<LecturerPerformanceReportDto>> GetLecturerPerformanceReportsAsync(
        int? facultyId,
        int? departmentId,
        int? semesterId,
        CancellationToken cancellationToken = default)
    {
        var query = db.Lecturers.AsNoTracking().AsQueryable();
        if (facultyId is { } fId) query = query.Where(x => x.FacultyId == fId);
        if (departmentId is { } dId) query = query.Where(x => x.DepartmentId == dId);

        var lecturers = await query.ToListAsync(cancellationToken);
        if (lecturers.Count == 0) return [];

        var lecturerIds = lecturers.Select(x => x.LecturerId).ToList();

        var faculties = await db.Faculties.AsNoTracking().ToDictionaryAsync(x => x.FacultyId, x => x.FacultyName, cancellationToken);
        var departments = await db.Departments.AsNoTracking().ToDictionaryAsync(x => x.DepartmentId, x => x.DepartmentName, cancellationToken);

        var sectionQuery = db.CourseSections.AsNoTracking().Where(x => lecturerIds.Contains(x.LecturerId));
        if (semesterId is { } semId)
        {
            sectionQuery = sectionQuery.Where(x => x.SemesterId == semId);
        }
        var sections = await sectionQuery.ToListAsync(cancellationToken);
        var sectionIds = sections.Select(x => x.CourseSectionId).ToList();

        var courses = await db.Courses.AsNoTracking()
            .Where(x => sections.Select(s => s.CourseId).Contains(x.CourseId))
            .ToDictionaryAsync(x => x.CourseId, x => x, cancellationToken);

        var sectionSurveys = await db.CourseSectionSurveys.AsNoTracking()
            .Where(x => sectionIds.Contains(x.CourseSectionId))
            .ToListAsync(cancellationToken);

        var cssIds = sectionSurveys.Select(x => x.CourseSectionSurveyId).ToList();

        // SQL Server / Postgres aggregation in DB instead of pulling all rows into RAM
        var responseStats = cssIds.Count == 0
            ? new Dictionary<int, (int Count, decimal TotalScore)>()
            : await db.SurveyResponses.AsNoTracking()
                .Where(x => cssIds.Contains(x.CourseSectionSurveyId))
                .GroupBy(x => x.CourseSectionSurveyId)
                .Select(g => new
                {
                    CourseSectionSurveyId = g.Key,
                    Count = g.Count(),
                    TotalScore = g.Sum(x => x.Score)
                })
                .ToDictionaryAsync(
                    x => x.CourseSectionSurveyId,
                    x => (x.Count, x.TotalScore),
                    cancellationToken);

        var reports = new List<LecturerPerformanceReportDto>();

        foreach (var lec in lecturers)
        {
            var lecSections = sections.Where(x => x.LecturerId == lec.LecturerId).ToList();
            var lecSecIds = lecSections.Select(x => x.CourseSectionId).ToList();
            var lecCss = sectionSurveys.Where(x => lecSecIds.Contains(x.CourseSectionId)).ToList();

            int totalResponses = 0;
            decimal totalScoreSum = 0;

            var sectionSummaries = new List<LecturerSectionSummaryDto>();
            foreach (var css in lecCss)
            {
                var sec = lecSections.FirstOrDefault(x => x.CourseSectionId == css.CourseSectionId);
                var crs = sec != null && courses.TryGetValue(sec.CourseId, out var c) ? c : null;
                
                var (cnt, sum) = responseStats.TryGetValue(css.CourseSectionSurveyId, out var stat)
                    ? stat
                    : (0, 0m);

                totalResponses += cnt;
                totalScoreSum += sum;

                decimal secAvg = cnt > 0 ? Math.Round(sum / cnt, 2) : 0;

                sectionSummaries.Add(new LecturerSectionSummaryDto(
                    css.CourseSectionSurveyId,
                    crs?.CourseCode ?? string.Empty,
                    crs?.CourseName ?? string.Empty,
                    sec?.SectionName ?? string.Empty,
                    sec?.ClassSize ?? 0,
                    cnt,
                    secAvg
                ));
            }

            decimal avgScore = totalResponses > 0 ? Math.Round(totalScoreSum / totalResponses, 2) : 0;

            reports.Add(new LecturerPerformanceReportDto(
                lec.LecturerId,
                lec.FullName,
                lec.DepartmentId.HasValue && departments.TryGetValue(lec.DepartmentId.Value, out var dName) ? dName : "Chưa thuộc bộ môn",
                lec.FacultyId.HasValue && faculties.TryGetValue(lec.FacultyId.Value, out var fName) ? fName : "Chưa thuộc khoa",
                avgScore,
                totalResponses,
                lecSections.Count,
                avgScore,
                avgScore,
                sectionSummaries,
                []
            ));
        }

        return reports.OrderByDescending(x => x.AverageScore).ToList();
    }

    public async Task<LecturerPerformanceReportDto?> GetLecturerPerformanceReportAsync(
        int lecturerId,
        int? semesterId,
        CancellationToken cancellationToken = default)
    {
        var reports = await GetLecturerPerformanceReportsAsync(null, null, semesterId, cancellationToken);
        var report = reports.FirstOrDefault(x => x.LecturerId == lecturerId);
        if (report is null) return null;

        var sections = await db.CourseSections.AsNoTracking()
            .Where(x => x.LecturerId == lecturerId)
            .ToListAsync(cancellationToken);
        var sectionIds = sections.Select(x => x.CourseSectionId).ToList();

        var sectionSurveys = await db.CourseSectionSurveys.AsNoTracking()
            .Where(x => sectionIds.Contains(x.CourseSectionId))
            .ToListAsync(cancellationToken);
        var cssIds = sectionSurveys.Select(x => x.CourseSectionSurveyId).ToList();

        var responseIds = await db.SurveyResponses.AsNoTracking()
            .Where(x => cssIds.Contains(x.CourseSectionSurveyId))
            .Select(x => x.ResponseId)
            .ToListAsync(cancellationToken);

        if (responseIds.Count == 0) return report;

        var answers = await db.SurveyResponseAnswers.AsNoTracking()
            .Where(x => responseIds.Contains(x.ResponseId))
            .ToListAsync(cancellationToken);

        var questionIds = answers.Select(x => x.QuestionId).Distinct().ToList();
        var questions = await db.SurveyQuestions.AsNoTracking()
            .Where(x => questionIds.Contains(x.QuestionId))
            .ToDictionaryAsync(x => x.QuestionId, x => x.QuestionText, cancellationToken);

        var questionRatings = new List<QuestionRatingDto>();
        var groupedAnswers = answers.GroupBy(x => x.QuestionId);

        foreach (var group in groupedAnswers)
        {
            int qId = group.Key;
            string qText = questions.TryGetValue(qId, out var txt) ? txt : $"Câu hỏi #{qId}";
            var qAnswers = group.ToList();
            int totalCount = qAnswers.Count;
            decimal avg = totalCount > 0 ? Math.Round((decimal)qAnswers.Average(x => x.SelectedValue), 2) : 0;

            var options = new List<OptionCountDto>();
            for (int val = 1; val <= 5; val++)
            {
                int valCount = qAnswers.Count(x => x.SelectedValue == val);
                decimal pct = totalCount > 0 ? Math.Round((decimal)valCount / totalCount * 100, 1) : 0;
                options.Add(new OptionCountDto(val, $"Mức {val}", valCount, pct));
            }

            questionRatings.Add(new QuestionRatingDto(qId, qText, avg, totalCount, options));
        }

        return report with { QuestionRatings = questionRatings.OrderBy(x => x.QuestionId).ToList() };
    }

    public async Task<IReadOnlyList<FacultyDepartmentReportDto>> GetFacultyDepartmentReportsAsync(
        int? semesterId,
        CancellationToken cancellationToken = default)
    {
        var faculties = await db.Faculties.AsNoTracking().ToListAsync(cancellationToken);
        var departments = await db.Departments.AsNoTracking().ToListAsync(cancellationToken);
        var lecturers = await db.Lecturers.AsNoTracking().ToListAsync(cancellationToken);

        var sectionQuery = db.CourseSections.AsNoTracking().AsQueryable();
        if (semesterId is { } semId) sectionQuery = sectionQuery.Where(x => x.SemesterId == semId);
        var sections = await sectionQuery.ToListAsync(cancellationToken);

        var sectionSurveys = await db.CourseSectionSurveys.AsNoTracking()
            .Where(x => sections.Select(s => s.CourseSectionId).Contains(x.CourseSectionId))
            .ToListAsync(cancellationToken);

        var cssIds = sectionSurveys.Select(x => x.CourseSectionSurveyId).ToList();
        
        var responseStats = cssIds.Count == 0
            ? new Dictionary<int, (int Count, decimal TotalScore)>()
            : await db.SurveyResponses.AsNoTracking()
                .Where(x => cssIds.Contains(x.CourseSectionSurveyId))
                .GroupBy(x => x.CourseSectionSurveyId)
                .Select(g => new
                {
                    CourseSectionSurveyId = g.Key,
                    Count = g.Count(),
                    TotalScore = g.Sum(x => x.Score)
                })
                .ToDictionaryAsync(
                    x => x.CourseSectionSurveyId,
                    x => (x.Count, x.TotalScore),
                    cancellationToken);

        var facultyReports = new List<FacultyDepartmentReportDto>();

        foreach (var fac in faculties)
        {
            var facDepts = departments.Where(x => x.FacultyId == fac.FacultyId).ToList();
            var facLecturers = lecturers.Where(x => x.FacultyId == fac.FacultyId).ToList();
            var facLecIds = facLecturers.Select(x => x.LecturerId).ToList();

            var facSections = sections.Where(x => facLecIds.Contains(x.LecturerId)).ToList();
            var facSecIds = facSections.Select(x => x.CourseSectionId).ToList();
            var facCss = sectionSurveys.Where(x => facSecIds.Contains(x.CourseSectionId)).ToList();

            int facResponses = 0;
            decimal facScoreSum = 0;

            foreach (var css in facCss)
            {
                if (responseStats.TryGetValue(css.CourseSectionSurveyId, out var stat))
                {
                    facResponses += stat.Count;
                    facScoreSum += stat.TotalScore;
                }
            }

            decimal facAvgScore = facResponses > 0 ? Math.Round(facScoreSum / facResponses, 2) : 0;

            var deptSummaries = new List<DepartmentSummaryDto>();
            foreach (var dept in facDepts)
            {
                var deptLecs = facLecturers.Where(x => x.DepartmentId == dept.DepartmentId).ToList();
                var deptLecIds = deptLecs.Select(x => x.LecturerId).ToList();
                var deptSections = facSections.Where(x => deptLecIds.Contains(x.LecturerId)).ToList();
                var deptSecIds = deptSections.Select(x => x.CourseSectionId).ToList();
                var deptCss = facCss.Where(x => deptSecIds.Contains(x.CourseSectionId)).ToList();

                int deptResponses = 0;
                decimal deptScoreSum = 0;
                foreach (var css in deptCss)
                {
                    if (responseStats.TryGetValue(css.CourseSectionSurveyId, out var stat))
                    {
                        deptResponses += stat.Count;
                        deptScoreSum += stat.TotalScore;
                    }
                }

                decimal deptAvg = deptResponses > 0 ? Math.Round(deptScoreSum / deptResponses, 2) : 0;

                deptSummaries.Add(new DepartmentSummaryDto(
                    dept.DepartmentId,
                    dept.DepartmentName,
                    deptLecs.Count,
                    deptSections.Count,
                    deptResponses,
                    deptAvg
                ));
            }

            facultyReports.Add(new FacultyDepartmentReportDto(
                fac.FacultyId,
                fac.FacultyName,
                facDepts.Count,
                facLecturers.Count,
                facSections.Count,
                facResponses,
                facAvgScore,
                deptSummaries
            ));
        }

        return facultyReports;
    }

    public async Task<SurveyQuestionSummaryReportDto?> GetQuestionAnalysisReportAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken = default)
    {
        var semesterSurvey = await db.SemesterSurveys.AsNoTracking()
            .FirstOrDefaultAsync(x => x.SemesterSurveyId == semesterSurveyId, cancellationToken);
        if (semesterSurvey is null) return null;

        var template = await db.SurveyTemplates.AsNoTracking()
            .FirstOrDefaultAsync(x => x.SurveyTemplateId == semesterSurvey.SurveyTemplateId, cancellationToken);
        if (template is null) return null;

        var questions = await db.SurveyQuestions.AsNoTracking()
            .Where(x => x.SurveyTemplateId == template.SurveyTemplateId)
            .OrderBy(x => x.QuestionId)
            .ToListAsync(cancellationToken);

        var sectionSurveys = await db.CourseSectionSurveys.AsNoTracking()
            .Where(x => x.SemesterSurveyId == semesterSurveyId)
            .ToListAsync(cancellationToken);
        var cssIds = sectionSurveys.Select(x => x.CourseSectionSurveyId).ToList();

        var responseIds = await db.SurveyResponses.AsNoTracking()
            .Where(x => cssIds.Contains(x.CourseSectionSurveyId))
            .Select(x => x.ResponseId)
            .ToListAsync(cancellationToken);

        if (responseIds.Count == 0)
        {
            return new SurveyQuestionSummaryReportDto(
                semesterSurveyId,
                template.SurveyTemplateId,
                template.TemplateName,
                0,
                0,
                questions.Select(q => new QuestionRatingDto(q.QuestionId, q.QuestionText, 0, 0, [])).ToList()
            );
        }

        var responsesCount = responseIds.Count;
        var overallAvgScore = await db.SurveyResponses.AsNoTracking()
            .Where(x => cssIds.Contains(x.CourseSectionSurveyId))
            .AverageAsync(x => x.Score, cancellationToken);

        var answers = await db.SurveyResponseAnswers.AsNoTracking()
            .Where(x => responseIds.Contains(x.ResponseId))
            .ToListAsync(cancellationToken);

        var questionRatings = new List<QuestionRatingDto>();

        foreach (var q in questions)
        {
            var qAnswers = answers.Where(x => x.QuestionId == q.QuestionId).ToList();
            int totalAnswers = qAnswers.Count;
            decimal avg = totalAnswers > 0 ? Math.Round((decimal)qAnswers.Average(x => x.SelectedValue), 2) : 0;

            var options = new List<OptionCountDto>();
            for (int val = 1; val <= 5; val++)
            {
                int valCount = qAnswers.Count(x => x.SelectedValue == val);
                decimal pct = totalAnswers > 0 ? Math.Round((decimal)valCount / totalAnswers * 100, 1) : 0;
                options.Add(new OptionCountDto(val, $"Mức {val}", valCount, pct));
            }

            questionRatings.Add(new QuestionRatingDto(q.QuestionId, q.QuestionText, avg, totalAnswers, options));
        }

        return new SurveyQuestionSummaryReportDto(
            semesterSurveyId,
            template.SurveyTemplateId,
            template.TemplateName,
            responsesCount,
            Math.Round(overallAvgScore, 2),
            questionRatings
        );
    }

    public async Task<SectionSurveyAnalysisDto?> GetSectionSurveyAnalysisAsync(
        int courseSectionSurveyId,
        CancellationToken cancellationToken = default)
    {
        var sectionSurvey = await db.CourseSectionSurveys.AsNoTracking()
            .FirstOrDefaultAsync(x => x.CourseSectionSurveyId == courseSectionSurveyId, cancellationToken);
        if (sectionSurvey is null) return null;

        var semesterSurvey = await db.SemesterSurveys.AsNoTracking()
            .FirstOrDefaultAsync(x => x.SemesterSurveyId == sectionSurvey.SemesterSurveyId, cancellationToken);
        var template = semesterSurvey is null
            ? null
            : await db.SurveyTemplates.AsNoTracking()
                .FirstOrDefaultAsync(x => x.SurveyTemplateId == semesterSurvey.SurveyTemplateId, cancellationToken);

        var questions = template is null
            ? []
            : await db.SurveyQuestions.AsNoTracking()
                .Where(x => x.SurveyTemplateId == template.SurveyTemplateId)
                .OrderBy(x => x.QuestionId)
                .ToListAsync(cancellationToken);

        var section = await db.CourseSections.AsNoTracking()
            .FirstOrDefaultAsync(x => x.CourseSectionId == sectionSurvey.CourseSectionId, cancellationToken);
        var course = section is null
            ? null
            : await db.Courses.AsNoTracking()
                .FirstOrDefaultAsync(x => x.CourseId == section.CourseId, cancellationToken);
        var lecturer = section is null
            ? null
            : await db.Lecturers.AsNoTracking()
                .FirstOrDefaultAsync(x => x.LecturerId == section.LecturerId, cancellationToken);

        var responseIds = await db.SurveyResponses.AsNoTracking()
            .Where(x => x.CourseSectionSurveyId == courseSectionSurveyId)
            .Select(x => x.ResponseId)
            .ToListAsync(cancellationToken);

        var questionRatings = new List<QuestionRatingDto>();

        if (responseIds.Count > 0 && questions.Count > 0)
        {
            var answers = await db.SurveyResponseAnswers.AsNoTracking()
                .Where(x => responseIds.Contains(x.ResponseId))
                .ToListAsync(cancellationToken);

            foreach (var q in questions)
            {
                var qAnswers = answers.Where(x => x.QuestionId == q.QuestionId).ToList();
                int totalAnswers = qAnswers.Count;
                decimal avg = totalAnswers > 0 ? Math.Round((decimal)qAnswers.Average(x => x.SelectedValue), 2) : 0;

                var options = new List<OptionCountDto>();
                for (int val = 1; val <= 5; val++)
                {
                    int valCount = qAnswers.Count(x => x.SelectedValue == val);
                    decimal pct = totalAnswers > 0 ? Math.Round((decimal)valCount / totalAnswers * 100, 1) : 0;
                    options.Add(new OptionCountDto(val, $"Mức {val}", valCount, pct));
                }

                questionRatings.Add(new QuestionRatingDto(q.QuestionId, q.QuestionText, avg, totalAnswers, options));
            }
        }
        else
        {
            questionRatings.AddRange(questions.Select(q =>
                new QuestionRatingDto(q.QuestionId, q.QuestionText, 0, 0, [])));
        }

        var responseCount = responseIds.Count;
        decimal averageScore = responseCount > 0
            ? Math.Round(await db.SurveyResponses.AsNoTracking()
                .Where(x => x.CourseSectionSurveyId == courseSectionSurveyId)
                .AverageAsync(x => x.Score, cancellationToken), 2)
            : 0;

        return new SectionSurveyAnalysisDto(
            courseSectionSurveyId,
            course?.CourseCode ?? string.Empty,
            course?.CourseName ?? string.Empty,
            section?.SectionName ?? string.Empty,
            lecturer?.FullName ?? "Chưa phân công",
            section?.ClassSize ?? 0,
            responseCount,
            averageScore,
            template?.TemplateName ?? string.Empty,
            questionRatings
        );
    }

    public async Task<IReadOnlyList<SurveyResultDetailDto>> GetSurveyResultsAsync(
        int? semesterId,
        int? facultyId,
        int? departmentId,
        int? lecturerId,
        int? semesterSurveyId,
        string? search,
        CancellationToken cancellationToken = default)
    {
        var sectionSurveyQuery = db.CourseSectionSurveys.AsNoTracking().AsQueryable();

        if (semesterSurveyId is { } ssId)
        {
            sectionSurveyQuery = sectionSurveyQuery.Where(x => x.SemesterSurveyId == ssId);
        }
        else if (semesterId is { } semId)
        {
            var allowed = await db.SemesterSurveys.AsNoTracking()
                .Where(x => x.SemesterId == semId)
                .Select(x => x.SemesterSurveyId)
                .ToListAsync(cancellationToken);
            sectionSurveyQuery = sectionSurveyQuery.Where(x => allowed.Contains(x.SemesterSurveyId));
        }

        var sectionSurveys = await sectionSurveyQuery.ToListAsync(cancellationToken);
        if (sectionSurveys.Count == 0) return [];

        var semesterSurveyIds = sectionSurveys.Select(x => x.SemesterSurveyId).Distinct().ToList();
        var semesterSurveys = await db.SemesterSurveys.AsNoTracking()
            .Where(x => semesterSurveyIds.Contains(x.SemesterSurveyId))
            .ToDictionaryAsync(x => x.SemesterSurveyId, x => x, cancellationToken);
        var templateIds = semesterSurveys.Values.Select(x => x.SurveyTemplateId).Distinct().ToList();
        var templates = await db.SurveyTemplates.AsNoTracking()
            .Where(x => templateIds.Contains(x.SurveyTemplateId))
            .ToDictionaryAsync(x => x.SurveyTemplateId, x => x.TemplateName, cancellationToken);

        var sectionIds = sectionSurveys.Select(x => x.CourseSectionId).Distinct().ToList();
        var sections = await db.CourseSections.AsNoTracking()
            .Where(x => sectionIds.Contains(x.CourseSectionId))
            .ToListAsync(cancellationToken);

        var courseIds = sections.Select(x => x.CourseId).Distinct().ToList();
        var courses = await db.Courses.AsNoTracking()
            .Where(x => courseIds.Contains(x.CourseId))
            .ToDictionaryAsync(x => x.CourseId, x => x, cancellationToken);

        var lecturerIds = sections.Select(x => x.LecturerId).Distinct().ToList();
        var lecturers = await db.Lecturers.AsNoTracking()
            .Where(x => lecturerIds.Contains(x.LecturerId))
            .ToListAsync(cancellationToken);

        var deptIds = lecturers.Where(x => x.DepartmentId.HasValue).Select(x => x.DepartmentId!.Value).Distinct().ToList();
        var departments = deptIds.Count == 0
            ? new Dictionary<int, string>()
            : await db.Departments.AsNoTracking()
                .Where(x => deptIds.Contains(x.DepartmentId))
                .ToDictionaryAsync(x => x.DepartmentId, x => x.DepartmentName, cancellationToken);
        var facIds = lecturers.Where(x => x.FacultyId.HasValue).Select(x => x.FacultyId!.Value).Distinct().ToList();
        var faculties = facIds.Count == 0
            ? new Dictionary<int, string>()
            : await db.Faculties.AsNoTracking()
                .Where(x => facIds.Contains(x.FacultyId))
                .ToDictionaryAsync(x => x.FacultyId, x => x.FacultyName, cancellationToken);

        var cssIds = sectionSurveys.Select(x => x.CourseSectionSurveyId).ToList();
        var responseStats = cssIds.Count == 0
            ? new Dictionary<int, (int Count, decimal TotalScore)>()
            : await db.SurveyResponses.AsNoTracking()
                .Where(x => cssIds.Contains(x.CourseSectionSurveyId))
                .GroupBy(x => x.CourseSectionSurveyId)
                .Select(g => new
                {
                    CourseSectionSurveyId = g.Key,
                    Count = g.Count(),
                    TotalScore = g.Sum(x => x.Score)
                })
                .ToDictionaryAsync(x => x.CourseSectionSurveyId, x => (x.Count, x.TotalScore), cancellationToken);

        var term = search?.Trim().ToLowerInvariant();
        var results = new List<SurveyResultDetailDto>();

        foreach (var css in sectionSurveys)
        {
            var semesterSurvey = semesterSurveys.TryGetValue(css.SemesterSurveyId, out var ss) ? ss : null;
            var templateName = semesterSurvey != null && templates.TryGetValue(semesterSurvey.SurveyTemplateId, out var tn)
                ? tn
                : string.Empty;
            var sec = sections.FirstOrDefault(x => x.CourseSectionId == css.CourseSectionId);
            var crs = sec != null && courses.TryGetValue(sec.CourseId, out var c) ? c : null;
            var lec = sec != null ? lecturers.FirstOrDefault(x => x.LecturerId == sec.LecturerId) : null;

            if (facultyId is { } fId && lec?.FacultyId != fId) continue;
            if (departmentId is { } dId && lec?.DepartmentId != dId) continue;
            if (lecturerId is { } lId && lec?.LecturerId != lId) continue;

            var courseCode = crs?.CourseCode ?? string.Empty;
            var courseName = crs?.CourseName ?? string.Empty;
            var sectionName = sec?.SectionName ?? string.Empty;
            var lecturerName = lec?.FullName ?? "Chưa phân công";

            if (!string.IsNullOrEmpty(term)
                && !courseCode.ToLowerInvariant().Contains(term)
                && !courseName.ToLowerInvariant().Contains(term)
                && !sectionName.ToLowerInvariant().Contains(term)
                && !lecturerName.ToLowerInvariant().Contains(term)
                && !templateName.ToLowerInvariant().Contains(term))
            {
                continue;
            }

            var (cnt, totalScore) = responseStats.TryGetValue(css.CourseSectionSurveyId, out var stat)
                ? stat
                : (0, 0m);

            int classSize = sec?.ClassSize ?? 0;
            decimal completionRate = classSize > 0 ? Math.Round((decimal)cnt / classSize * 100, 1) : 0;
            decimal averageScore = cnt > 0 ? Math.Round(totalScore / cnt, 2) : 0;

            results.Add(new SurveyResultDetailDto(
                css.CourseSectionSurveyId,
                css.SemesterSurveyId,
                templateName,
                lec?.LecturerId ?? 0,
                lecturerName,
                lec?.DepartmentId ?? 0,
                lec?.DepartmentId is { } dd && departments.TryGetValue(dd, out var dn) ? dn : "Chưa thuộc bộ môn",
                lec?.FacultyId ?? 0,
                lec?.FacultyId is { } ff && faculties.TryGetValue(ff, out var fn) ? fn : "Chưa thuộc khoa",
                courseCode,
                courseName,
                sectionName,
                classSize,
                cnt,
                completionRate,
                averageScore));
        }

        return results
            .OrderBy(x => x.FacultyName)
            .ThenBy(x => x.DepartmentName)
            .ThenBy(x => x.CourseCode)
            .ThenBy(x => x.SectionName)
            .ToList();
    }

    // -----------------------------------------------------------------------
    // BẢNG TỔNG QUAN TOÀN TRƯỜNG (EXECUTIVE SURVEY DASHBOARD)
    // -----------------------------------------------------------------------

    /// <summary>Bảng tổng quan toàn trường theo học kỳ, có cache TTL ngắn.</summary>
    public async Task<SchoolSurveyOverviewDto?> GetSchoolSurveyOverviewAsync(
        int semesterId,
        CancellationToken cancellationToken = default)
    {
        string cacheKey = $"{SchoolOverviewCachePrefix}{semesterId}";
        if (cache.TryGetValue(cacheKey, out SchoolSurveyOverviewDto? cached) && cached is not null)
        {
            return cached;
        }

        var overview = await BuildSchoolSurveyOverviewAsync(semesterId, cancellationToken);
        if (overview is not null)
        {
            cache.Set(cacheKey, overview, SchoolOverviewCacheTtl);
        }

        return overview;
    }

    private async Task<SchoolSurveyOverviewDto?> BuildSchoolSurveyOverviewAsync(
        int semesterId,
        CancellationToken cancellationToken)
    {
        var semester = await db.Semesters
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.SemesterId == semesterId, cancellationToken);
        if (semester is null) return null;

        var academicYear = await db.AcademicYears
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.AcademicYearId == semester.AcademicYearId, cancellationToken);

        var semesterSurveyIds = await db.SemesterSurveys
            .AsNoTracking()
            .Where(x => x.SemesterId == semesterId)
            .Select(x => x.SemesterSurveyId)
            .ToListAsync(cancellationToken);

        // Kỳ chưa phát đợt khảo sát nào → trả bảng tổng quan rỗng để UI dựng được khung.
        if (semesterSurveyIds.Count == 0)
        {
            return new SchoolSurveyOverviewDto(
                semester.SemesterId,
                semester.SemesterName,
                academicYear?.AcademicYearName ?? string.Empty,
                0, 0, 0, 0m, 0, 0, 0, 0m, [], 0m, [], [], [], null);
        }

        var sectionSurveys = await db.CourseSectionSurveys
            .AsNoTracking()
            .Where(x => semesterSurveyIds.Contains(x.SemesterSurveyId))
            .ToListAsync(cancellationToken);

        var cssIds = sectionSurveys.Select(x => x.CourseSectionSurveyId).ToList();
        var sectionIds = sectionSurveys.Select(x => x.CourseSectionId).Distinct().ToList();

        var sections = await db.CourseSections
            .AsNoTracking()
            .Where(x => sectionIds.Contains(x.CourseSectionId))
            .ToListAsync(cancellationToken);

        var lecturerIds = sections.Select(x => x.LecturerId).Distinct().ToList();
        List<Lecturer> lecturers = lecturerIds.Count == 0
            ? []
            : await db.Lecturers.AsNoTracking()
                .Where(x => lecturerIds.Contains(x.LecturerId))
                .ToListAsync(cancellationToken);

        var deptIds = lecturers.Where(x => x.DepartmentId.HasValue).Select(x => x.DepartmentId!.Value).Distinct().ToList();
        Dictionary<int, Department> departments = deptIds.Count == 0
            ? []
            : await db.Departments.AsNoTracking()
                .Where(x => deptIds.Contains(x.DepartmentId))
                .ToDictionaryAsync(x => x.DepartmentId, x => x, cancellationToken);

        var facultyIds = lecturers.Where(x => x.FacultyId.HasValue).Select(x => x.FacultyId!.Value).Distinct().ToList();
        Dictionary<int, Faculty> faculties = facultyIds.Count == 0
            ? []
            : await db.Faculties.AsNoTracking()
                .Where(x => facultyIds.Contains(x.FacultyId))
                .ToDictionaryAsync(x => x.FacultyId, x => x, cancellationToken);

        // Gộp phiếu theo lớp (1 query duy nhất).
        var responseStats = cssIds.Count == 0
            ? new Dictionary<int, (int Count, decimal TotalScore)>()
            : await db.SurveyResponses.AsNoTracking()
                .Where(x => cssIds.Contains(x.CourseSectionSurveyId))
                .GroupBy(x => x.CourseSectionSurveyId)
                .Select(g => new
                {
                    CourseSectionSurveyId = g.Key,
                    Count = g.Count(),
                    TotalScore = g.Sum(x => x.Score)
                })
                .ToDictionaryAsync(
                    x => x.CourseSectionSurveyId,
                    x => (x.Count, x.TotalScore),
                    cancellationToken);

        // Phân bố điểm theo nhóm (band 2..5) gộp ngay trong SQL.
        var bandCounts = cssIds.Count == 0
            ? new List<BandCount>()
            : (await db.SurveyResponses.AsNoTracking()
                .Where(x => cssIds.Contains(x.CourseSectionSurveyId))
                .Select(x => new
                {
                    Band = x.Score >= 4.5m ? 5 : x.Score >= 4.0m ? 4 : x.Score >= 3.0m ? 3 : 2
                })
                .GroupBy(x => x.Band)
                .Select(g => new { g.Key, Count = g.Count() })
                .ToListAsync(cancellationToken))
                .Select(x => new BandCount(x.Key, x.Count))
                .ToList();

        // Duyệt từng lớp để gộp theo Khoa / Bộ môn và phân loại trạng thái thu phiếu.
        var facultyStats = new Dictionary<int, (int SectionCount, int Target, int Responses, decimal ScoreSum)>();
        var deptStats = new Dictionary<int, (int SectionCount, int Target, int Responses, decimal ScoreSum)>();
        int completedCount = 0;
        int inProgressCount = 0;
        int laggingCount = 0;

        foreach (var ss in sectionSurveys)
        {
            var sec = sections.FirstOrDefault(x => x.CourseSectionId == ss.CourseSectionId);
            var lec = sec is null ? null : lecturers.FirstOrDefault(x => x.LecturerId == sec.LecturerId);
            var (cnt, totalScore) = responseStats.TryGetValue(ss.CourseSectionSurveyId, out var stat)
                ? stat
                : (0, 0m);
            int classSize = sec?.ClassSize ?? 0;
            decimal rate = classSize > 0 ? Math.Round((decimal)cnt / classSize * 100, 2) : 0;

            if (rate >= 80) completedCount++;
            else if (rate >= 40) inProgressCount++;
            else laggingCount++;

            if (lec?.FacultyId is { } fId)
            {
                var f = facultyStats.TryGetValue(fId, out var fs) ? fs : (SectionCount: 0, Target: 0, Responses: 0, ScoreSum: 0m);
                f.SectionCount++;
                f.Target += classSize;
                f.Responses += cnt;
                f.ScoreSum += totalScore;
                facultyStats[fId] = f;
            }

            if (lec?.DepartmentId is { } dId)
            {
                var d = deptStats.TryGetValue(dId, out var ds) ? ds : (SectionCount: 0, Target: 0, Responses: 0, ScoreSum: 0m);
                d.SectionCount++;
                d.Target += classSize;
                d.Responses += cnt;
                d.ScoreSum += totalScore;
                deptStats[dId] = d;
            }
        }

        // Danh sách Khoa cho biểu đồ xếp hạng.
        var facultyList = new List<FacultyOverviewDto>();
        foreach (var (fId, stats) in facultyStats)
        {
            var fac = faculties.TryGetValue(fId, out var f) ? f : null;
            int deptCount = departments.Values.Count(d => d.FacultyId == fId);
            int responses = stats.Responses;
            decimal avg = responses > 0 ? Math.Round(stats.ScoreSum / responses, 2) : 0;
            decimal completion = stats.Target > 0 ? Math.Round((decimal)responses / stats.Target * 100, 2) : 0;
            facultyList.Add(new FacultyOverviewDto(
                fId,
                fac?.FacultyName ?? "Chưa thuộc khoa",
                deptCount,
                stats.SectionCount,
                stats.Target,
                responses,
                completion,
                avg));
        }

        // Danh sách Bộ môn cho bảng "chậm tiến độ nhất".
        var deptList = new List<DepartmentOverviewDto>();
        foreach (var (dId, stats) in deptStats)
        {
            var dept = departments.TryGetValue(dId, out var d) ? d : null;
            string facName = dept?.FacultyId is { } dfId && faculties.TryGetValue(dfId, out var ff)
                ? ff.FacultyName
                : "Chưa thuộc khoa";
            int responses = stats.Responses;
            decimal avg = responses > 0 ? Math.Round(stats.ScoreSum / responses, 2) : 0;
            decimal completion = stats.Target > 0 ? Math.Round((decimal)responses / stats.Target * 100, 2) : 0;
            deptList.Add(new DepartmentOverviewDto(
                dId,
                dept?.DepartmentName ?? "Chưa thuộc bộ môn",
                dept?.FacultyId ?? 0,
                facName,
                stats.SectionCount,
                stats.Target,
                responses,
                completion,
                avg));
        }

        // Tổng hợp toàn trường.
        int totalTarget = facultyStats.Values.Sum(x => x.Target);
        int totalResponses = facultyStats.Values.Sum(x => x.Responses);
        decimal totalScoreSum = facultyStats.Values.Sum(x => x.ScoreSum);
        decimal overallCompletion = totalTarget > 0 ? Math.Round((decimal)totalResponses / totalTarget * 100, 2) : 0;
        decimal overallAvg = totalResponses > 0 ? Math.Round(totalScoreSum / totalResponses, 2) : 0;

        var scoreDistribution = new List<ScoreBandDto>();
        int bandTotal = bandCounts.Sum(x => x.Count);
        foreach (var band in new[] { 5, 4, 3, 2 })
        {
            int count = bandCounts.FirstOrDefault(x => x.Band == band)?.Count ?? 0;
            decimal pct = bandTotal > 0 ? Math.Round((decimal)count / bandTotal * 100, 1) : 0;
            scoreDistribution.Add(new ScoreBandDto(band, ScoreBandLabel(band), count, pct));
        }

        // Tiêu chí yếu nhất toàn trường.
        var weakestQuestions = await BuildWeakestQuestionsAsync(cssIds, cancellationToken);

        // Xu hướng so với học kỳ liền trước.
        var previousSemester = await GetPreviousSemesterComparisonAsync(
            semesterId, totalResponses, totalTarget, overallAvg, cancellationToken);

        return new SchoolSurveyOverviewDto(
            semester.SemesterId,
            semester.SemesterName,
            academicYear?.AcademicYearName ?? string.Empty,
            sectionSurveys.Count,
            totalTarget,
            totalResponses,
            overallCompletion,
            completedCount,
            inProgressCount,
            laggingCount,
            overallAvg,
            scoreDistribution,
            overallAvg,
            facultyList.OrderByDescending(x => x.AverageScore).ToList(),
            deptList.OrderBy(x => x.CompletionRate).ThenBy(x => x.DepartmentName).ToList(),
            weakestQuestions,
            previousSemester);
    }

    /// <summary>Gộp các câu hỏi yếu nhất toàn trường theo số lượt trả lời của kỳ.</summary>
    private async Task<IReadOnlyList<QuestionRatingDto>> BuildWeakestQuestionsAsync(
        List<int> cssIds,
        CancellationToken cancellationToken)
    {
        if (cssIds.Count == 0) return [];

        // Số lượt trả lời theo (Câu hỏi, Mức) gộp trong SQL qua join Responses → Answers.
        var valueCounts = await (from r in db.SurveyResponses.AsNoTracking()
                                 join a in db.SurveyResponseAnswers.AsNoTracking()
                                     on r.ResponseId equals a.ResponseId
                                 where cssIds.Contains(r.CourseSectionSurveyId)
                                 group a by new { a.QuestionId, a.SelectedValue } into g
                                 select new { g.Key.QuestionId, g.Key.SelectedValue, Count = g.Count() })
            .ToListAsync(cancellationToken);

        if (valueCounts.Count == 0) return [];

        var questionIds = valueCounts.Select(x => x.QuestionId).Distinct().ToList();
        Dictionary<int, string> texts = questionIds.Count == 0
            ? []
            : await db.SurveyQuestions.AsNoTracking()
                .Where(x => questionIds.Contains(x.QuestionId))
                .ToDictionaryAsync(x => x.QuestionId, x => x.QuestionText, cancellationToken);

        var ratings = new List<QuestionRatingDto>();
        foreach (var group in valueCounts.GroupBy(x => x.QuestionId))
        {
            int qId = group.Key;
            int total = group.Sum(x => x.Count);
            if (total < WeakQuestionMinAnswers) continue;

            decimal sum = 0;
            var options = new List<OptionCountDto>();
            for (int val = 1; val <= 5; val++)
            {
                int count = group.FirstOrDefault(x => x.SelectedValue == val)?.Count ?? 0;
                sum += count * val;
                decimal pct = total > 0 ? Math.Round((decimal)count / total * 100, 1) : 0;
                options.Add(new OptionCountDto(val, $"Mức {val}", count, pct));
            }

            ratings.Add(new QuestionRatingDto(
                qId,
                texts.TryGetValue(qId, out var txt) ? txt : $"Câu hỏi #{qId}",
                Math.Round(sum / total, 2),
                total,
                options));
        }

        return ratings
            .OrderBy(x => x.AverageScore) // yếu nhất trước
            .ThenByDescending(x => x.TotalAnswers)
            .Take(WeakQuestionCount)
            .ToList();
    }

    /// <summary>So sánh học kỳ hiện tại với học kỳ liền trước về tiến độ và điểm TB.</summary>
    private async Task<SemesterComparisonDto?> GetPreviousSemesterComparisonAsync(
        int semesterId,
        int currentResponses,
        int currentTarget,
        decimal currentAvg,
        CancellationToken cancellationToken)
    {
        var previous = await db.Semesters.AsNoTracking()
            .Where(x => x.SemesterId < semesterId)
            .OrderByDescending(x => x.SemesterId)
            .FirstOrDefaultAsync(cancellationToken);
        if (previous is null) return null;

        var prevYear = await db.AcademicYears.AsNoTracking()
            .FirstOrDefaultAsync(x => x.AcademicYearId == previous.AcademicYearId, cancellationToken);

        var (prevTarget, prevResponses, prevAvg) = await ComputeSemesterCoreStatsAsync(previous.SemesterId, cancellationToken);
        decimal prevCompletion = prevTarget > 0 ? Math.Round((decimal)prevResponses / prevTarget * 100, 2) : 0;

        decimal currentCompletion = currentTarget > 0 ? Math.Round((decimal)currentResponses / currentTarget * 100, 2) : 0;

        return new SemesterComparisonDto(
            previous.SemesterId,
            previous.SemesterName,
            prevYear?.AcademicYearName ?? string.Empty,
            prevCompletion,
            prevAvg,
            Math.Round(currentCompletion - prevCompletion, 2),
            Math.Round(currentAvg - prevAvg, 2));
    }

    /// <summary>Chỉ số lõi (chỉ tiêu / phiếu thu / điểm TB) của một học kỳ, dùng cho so sánh.</summary>
    private async Task<(int Target, int Responses, decimal AverageScore)> ComputeSemesterCoreStatsAsync(
        int semesterId,
        CancellationToken cancellationToken)
    {
        var ssIds = await db.SemesterSurveys.AsNoTracking()
            .Where(x => x.SemesterId == semesterId)
            .Select(x => x.SemesterSurveyId)
            .ToListAsync(cancellationToken);
        if (ssIds.Count == 0) return (0, 0, 0m);

        var cssIds = await db.CourseSectionSurveys.AsNoTracking()
            .Where(x => ssIds.Contains(x.SemesterSurveyId))
            .Select(x => x.CourseSectionSurveyId)
            .ToListAsync(cancellationToken);
        if (cssIds.Count == 0) return (0, 0, 0m);

        int target = await (from sec in db.CourseSections.AsNoTracking()
                            join css in db.CourseSectionSurveys.AsNoTracking()
                                on sec.CourseSectionId equals css.CourseSectionId
                            where cssIds.Contains(css.CourseSectionSurveyId)
                            select (int?)sec.ClassSize)
            .SumAsync(cancellationToken) ?? 0;

        var agg = await db.SurveyResponses.AsNoTracking()
            .Where(x => cssIds.Contains(x.CourseSectionSurveyId))
            .GroupBy(x => 1)
            .Select(g => new { Count = g.Count(), Avg = g.Average(x => x.Score) })
            .FirstOrDefaultAsync(cancellationToken);

        int responses = agg?.Count ?? 0;
        decimal avg = agg is null ? 0m : Math.Round(agg.Avg, 2);
        return (target, responses, avg);
    }

    private static string ScoreBandLabel(int band) => band switch
    {
        5 => "Xuất sắc",
        4 => "Tốt",
        3 => "Trung bình",
        _ => "Cần cải thiện",
    };

    /// <summary>Bản ghi trung gian cho phép gộp phân bố điểm không cần anonymous type.</summary>
    private sealed record BandCount(int Band, int Count);
}
