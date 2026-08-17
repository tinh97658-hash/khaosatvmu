using Application.Reports;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Reports;

public sealed class EfReportService(AppDbContext db) : IReportService
{
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
}
