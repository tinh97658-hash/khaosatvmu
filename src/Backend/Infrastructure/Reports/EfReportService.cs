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

    /// <summary>Trần số câu trả lời tự nhập trả kèm mỗi câu hỏi, tránh payload quá lớn.</summary>
    private const int MaxTextAnswersPerQuestion = 200;

    /// <summary>
    /// Số phiếu của một lớp, tách làm hai nhóm theo quyết định C-e:
    /// <see cref="TotalCount"/> đếm hết mọi phiếu, dùng cho số liệu tiến độ thu
    /// phiếu (tỷ lệ hoàn thành so với sĩ số) — nộp ẩu thì vẫn là đã tham gia.
    /// <see cref="ValidCount"/> và <see cref="ValidTotalScore"/> chỉ gộp phiếu qua
    /// bộ lọc nhiễu, dùng cho mọi số liệu về chất lượng.
    /// </summary>
    private sealed record ResponseTally(int TotalCount, int ValidCount, decimal ValidTotalScore)
    {
        public static readonly ResponseTally Empty = new(0, 0, 0m);

        public decimal AverageScore =>
            ValidCount > 0 ? Math.Round(ValidTotalScore / ValidCount, 2) : 0m;
    }

    /// <summary>
    /// Gộp số phiếu theo lớp trong một lượt truy vấn: cả tổng lẫn phần hợp lệ.
    /// </summary>
    private async Task<Dictionary<int, ResponseTally>> ResponseTalliesAsync(
        IReadOnlyCollection<int> courseSectionSurveyIds,
        CancellationToken cancellationToken)
    {
        if (courseSectionSurveyIds.Count == 0) return [];

        return await db.SurveyResponses.AsNoTracking()
            .Where(x => courseSectionSurveyIds.Contains(x.CourseSectionSurveyId))
            .GroupBy(x => x.CourseSectionSurveyId)
            .Select(g => new
            {
                CourseSectionSurveyId = g.Key,
                TotalCount = g.Count(),
                ValidCount = g.Count(x => x.IsValid),
                ValidTotalScore = g.Sum(x => x.IsValid ? x.Score : 0m)
            })
            .ToDictionaryAsync(
                x => x.CourseSectionSurveyId,
                x => new ResponseTally(x.TotalCount, x.ValidCount, x.ValidTotalScore),
                cancellationToken);
    }

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

        // CỐ Ý đếm cả phiếu bị lọc nhiễu: đây là báo cáo tiến độ thu phiếu, một em
        // nộp phiếu ẩu thì vẫn là đã tham gia, không thể coi như chưa làm.
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

        // Lớp chưa xác định được giảng viên (LecturerId NULL) không vào báo cáo giảng viên.
        var sectionQuery = db.CourseSections.AsNoTracking()
            .Where(x => x.LecturerId != null && lecturerIds.Contains(x.LecturerId.Value));
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

        // Gộp ngay trong SQL thay vì kéo hết phiếu về bộ nhớ ứng dụng.
        var responseStats = await ResponseTalliesAsync(cssIds, cancellationToken);

        var reports = new List<LecturerPerformanceReportDto>();

        foreach (var lec in lecturers)
        {
            var lecSections = sections.Where(x => x.LecturerId == lec.LecturerId).ToList();
            var lecSecIds = lecSections.Select(x => x.CourseSectionId).ToList();
            var lecCss = sectionSurveys.Where(x => lecSecIds.Contains(x.CourseSectionId)).ToList();

            // Số lượt nộp đếm hết (tiến độ); điểm chỉ gộp phiếu hợp lệ (chất lượng).
            int totalResponses = 0;
            int validResponses = 0;
            decimal validScoreSum = 0;

            var sectionSummaries = new List<LecturerSectionSummaryDto>();
            foreach (var css in lecCss)
            {
                var sec = lecSections.FirstOrDefault(x => x.CourseSectionId == css.CourseSectionId);
                var crs = sec != null && courses.TryGetValue(sec.CourseId, out var c) ? c : null;

                var tally = responseStats.GetValueOrDefault(css.CourseSectionSurveyId, ResponseTally.Empty);

                totalResponses += tally.TotalCount;
                validResponses += tally.ValidCount;
                validScoreSum += tally.ValidTotalScore;

                sectionSummaries.Add(new LecturerSectionSummaryDto(
                    css.CourseSectionSurveyId,
                    crs?.CourseCode ?? string.Empty,
                    crs?.CourseName ?? string.Empty,
                    sec?.SectionName ?? string.Empty,
                    sec?.ClassSize ?? 0,
                    tally.TotalCount,
                    tally.AverageScore
                ));
            }

            decimal avgScore = validResponses > 0 ? Math.Round(validScoreSum / validResponses, 2) : 0;

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

        // Điểm từng câu của giảng viên là số liệu chất lượng: chỉ gộp phiếu hợp lệ.
        var responseIds = await db.SurveyResponses.AsNoTracking()
            .Where(x => cssIds.Contains(x.CourseSectionSurveyId) && x.IsValid)
            .Select(x => x.ResponseId)
            .ToListAsync(cancellationToken);

        if (responseIds.Count == 0) return report;

        var answers = await db.SurveyResponseAnswers.AsNoTracking()
            .Where(x => responseIds.Contains(x.ResponseId))
            .ToListAsync(cancellationToken);

        var questionIds = answers.Select(x => x.QuestionId).Distinct().ToList();
        // Câu bẫy ép chọn một mức cố định nên điểm của nó vô nghĩa: bỏ hẳn khỏi
        // phân tích theo câu hỏi, không chỉ khỏi phép trung bình.
        var questions = await db.SurveyQuestions.AsNoTracking()
            .Where(x => questionIds.Contains(x.QuestionId) && x.AttentionCheckValue == null)
            .ToListAsync(cancellationToken);
        var scaleByQuestion = await LoadScalesByQuestionAsync(questions, cancellationToken);

        var questionRatings = questions
            .Select(question => BuildQuestionRating(
                question.QuestionId,
                question.QuestionText,
                answers.Where(x => x.QuestionId == question.QuestionId).ToList(),
                scaleByQuestion.GetValueOrDefault(question.QuestionId)))
            .ToList();

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
        
        var responseStats = await ResponseTalliesAsync(cssIds, cancellationToken);

        var facultyReports = new List<FacultyDepartmentReportDto>();

        foreach (var fac in faculties)
        {
            var facDepts = departments.Where(x => x.FacultyId == fac.FacultyId).ToList();
            var facLecturers = lecturers.Where(x => x.FacultyId == fac.FacultyId).ToList();
            var facLecIds = facLecturers.Select(x => x.LecturerId).ToList();

            var facSections = sections
                .Where(x => x.LecturerId is { } lecId && facLecIds.Contains(lecId))
                .ToList();
            var facSecIds = facSections.Select(x => x.CourseSectionId).ToList();
            var facCss = sectionSurveys.Where(x => facSecIds.Contains(x.CourseSectionId)).ToList();

            // Số lượt nộp đếm hết; điểm chỉ gộp phiếu hợp lệ.
            int facResponses = 0;
            int facValidResponses = 0;
            decimal facValidScoreSum = 0;

            foreach (var css in facCss)
            {
                var tally = responseStats.GetValueOrDefault(css.CourseSectionSurveyId, ResponseTally.Empty);
                facResponses += tally.TotalCount;
                facValidResponses += tally.ValidCount;
                facValidScoreSum += tally.ValidTotalScore;
            }

            decimal facAvgScore = facValidResponses > 0
                ? Math.Round(facValidScoreSum / facValidResponses, 2)
                : 0;

            var deptSummaries = new List<DepartmentSummaryDto>();
            foreach (var dept in facDepts)
            {
                var deptLecs = facLecturers.Where(x => x.DepartmentId == dept.DepartmentId).ToList();
                var deptLecIds = deptLecs.Select(x => x.LecturerId).ToList();
                var deptSections = facSections
                    .Where(x => x.LecturerId is { } deptLecId && deptLecIds.Contains(deptLecId))
                    .ToList();
                var deptSecIds = deptSections.Select(x => x.CourseSectionId).ToList();
                var deptCss = facCss.Where(x => deptSecIds.Contains(x.CourseSectionId)).ToList();

                int deptResponses = 0;
                int deptValidResponses = 0;
                decimal deptValidScoreSum = 0;
                foreach (var css in deptCss)
                {
                    var tally = responseStats.GetValueOrDefault(css.CourseSectionSurveyId, ResponseTally.Empty);
                    deptResponses += tally.TotalCount;
                    deptValidResponses += tally.ValidCount;
                    deptValidScoreSum += tally.ValidTotalScore;
                }

                decimal deptAvg = deptValidResponses > 0
                    ? Math.Round(deptValidScoreSum / deptValidResponses, 2)
                    : 0;

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

        // Bỏ câu bẫy: điểm của nó vô nghĩa vì mọi người đều bị ép chọn một mức.
        var questions = await db.SurveyQuestions.AsNoTracking()
            .Where(x => x.SurveyTemplateId == template.SurveyTemplateId && x.AttentionCheckValue == null)
            .OrderBy(x => x.QuestionId)
            .ToListAsync(cancellationToken);

        var sectionSurveys = await db.CourseSectionSurveys.AsNoTracking()
            .Where(x => x.SemesterSurveyId == semesterSurveyId)
            .ToListAsync(cancellationToken);
        var cssIds = sectionSurveys.Select(x => x.CourseSectionSurveyId).ToList();

        // Báo cáo chất lượng nên chỉ gộp phiếu qua bộ lọc nhiễu.
        var responseIds = await db.SurveyResponses.AsNoTracking()
            .Where(x => cssIds.Contains(x.CourseSectionSurveyId) && x.IsValid)
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
            .Where(x => cssIds.Contains(x.CourseSectionSurveyId) && x.IsValid)
            .AverageAsync(x => x.Score, cancellationToken);

        var answers = await db.SurveyResponseAnswers.AsNoTracking()
            .Where(x => responseIds.Contains(x.ResponseId))
            .ToListAsync(cancellationToken);
        var scaleByQuestion = await LoadScalesByQuestionAsync(questions, cancellationToken);

        var questionRatings = questions
            .Select(q => BuildQuestionRating(
                q.QuestionId,
                q.QuestionText,
                answers.Where(x => x.QuestionId == q.QuestionId).ToList(),
                scaleByQuestion.GetValueOrDefault(q.QuestionId)))
            .ToList();

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
            // Bỏ câu bẫy khỏi phân tích theo câu hỏi.
            : await db.SurveyQuestions.AsNoTracking()
                .Where(x => x.SurveyTemplateId == template.SurveyTemplateId && x.AttentionCheckValue == null)
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

        // Phân tích theo câu hỏi là số liệu chất lượng nên chỉ gộp phiếu hợp lệ.
        var responseIds = await db.SurveyResponses.AsNoTracking()
            .Where(x => x.CourseSectionSurveyId == courseSectionSurveyId && x.IsValid)
            .Select(x => x.ResponseId)
            .ToListAsync(cancellationToken);

        var questionRatings = new List<QuestionRatingDto>();

        if (responseIds.Count > 0 && questions.Count > 0)
        {
            var answers = await db.SurveyResponseAnswers.AsNoTracking()
                .Where(x => responseIds.Contains(x.ResponseId))
                .ToListAsync(cancellationToken);
            var scaleByQuestion = await LoadScalesByQuestionAsync(questions, cancellationToken);

            questionRatings.AddRange(questions.Select(q => BuildQuestionRating(
                q.QuestionId,
                q.QuestionText,
                answers.Where(x => x.QuestionId == q.QuestionId).ToList(),
                scaleByQuestion.GetValueOrDefault(q.QuestionId))));
        }
        else
        {
            questionRatings.AddRange(questions.Select(q =>
                new QuestionRatingDto(q.QuestionId, q.QuestionText, 0, 0, [])));
        }

        var responseCount = responseIds.Count;
        decimal averageScore = responseCount > 0
            ? Math.Round(await db.SurveyResponses.AsNoTracking()
                .Where(x => x.CourseSectionSurveyId == courseSectionSurveyId && x.IsValid)
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

        var deptIds = lecturers.Where(x => x.DepartmentId.HasValue).Select(x => x.DepartmentId!.Value)
            .Concat(courses.Values.Where(x => x.DepartmentId.HasValue).Select(x => x.DepartmentId!.Value))
            .Distinct()
            .ToList();
        var departments = deptIds.Count == 0
            ? new Dictionary<int, Department>()
            : await db.Departments.AsNoTracking()
                .Where(x => deptIds.Contains(x.DepartmentId))
                .ToDictionaryAsync(x => x.DepartmentId, x => x, cancellationToken);
        var facIds = lecturers.Where(x => x.FacultyId.HasValue).Select(x => x.FacultyId!.Value)
            .Concat(courses.Values.Where(x => x.FacultyId.HasValue).Select(x => x.FacultyId!.Value))
            .Concat(departments.Values.Where(x => x.FacultyId.HasValue).Select(x => x.FacultyId!.Value))
            .Distinct()
            .ToList();
        var faculties = facIds.Count == 0
            ? new Dictionary<int, string>()
            : await db.Faculties.AsNoTracking()
                .Where(x => facIds.Contains(x.FacultyId))
                .ToDictionaryAsync(x => x.FacultyId, x => x.FacultyName, cancellationToken);

        var cssIds = sectionSurveys.Select(x => x.CourseSectionSurveyId).ToList();
        var responseStats = await ResponseTalliesAsync(cssIds, cancellationToken);

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
            int? reportDepartmentId = crs?.DepartmentId ?? lec?.DepartmentId;
            int? reportFacultyId = crs?.FacultyId;
            if (reportFacultyId is null
                && reportDepartmentId is { } owningDepartmentId
                && departments.TryGetValue(owningDepartmentId, out var owningDepartment))
            {
                reportFacultyId = owningDepartment.FacultyId;
            }
            reportFacultyId ??= lec?.FacultyId;

            if (facultyId is { } fId && reportFacultyId != fId) continue;
            if (departmentId is { } dId && reportDepartmentId != dId) continue;
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

            var tally = responseStats.GetValueOrDefault(css.CourseSectionSurveyId, ResponseTally.Empty);
            var cnt = tally.TotalCount;

            int classSize = sec?.ClassSize ?? 0;
            // Tỷ lệ hoàn thành đếm hết lượt nộp; điểm chỉ gộp phiếu hợp lệ.
            decimal completionRate = classSize > 0 ? Math.Round((decimal)cnt / classSize * 100, 1) : 0;
            decimal averageScore = tally.AverageScore;

            results.Add(new SurveyResultDetailDto(
                css.CourseSectionSurveyId,
                css.SemesterSurveyId,
                templateName,
                lec?.LecturerId ?? 0,
                lecturerName,
                reportDepartmentId ?? 0,
                reportDepartmentId is { } dd && departments.TryGetValue(dd, out var department)
                    ? department.DepartmentName
                    : "Chưa thuộc bộ môn",
                reportFacultyId ?? 0,
                reportFacultyId is { } ff && faculties.TryGetValue(ff, out var fn) ? fn : "Chưa thuộc khoa",
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
        int? comparisonSemesterId = null,
        CancellationToken cancellationToken = default)
    {
        string cacheKey = $"{SchoolOverviewCachePrefix}{semesterId}:compare:{comparisonSemesterId?.ToString() ?? "previous"}";
        if (cache.TryGetValue(cacheKey, out SchoolSurveyOverviewDto? cached) && cached is not null)
        {
            return cached;
        }

        var overview = await BuildSchoolSurveyOverviewAsync(
            semesterId,
            comparisonSemesterId,
            cancellationToken);
        if (overview is not null)
        {
            cache.Set(cacheKey, overview, SchoolOverviewCacheTtl);
        }

        return overview;
    }

    private async Task<SchoolSurveyOverviewDto?> BuildSchoolSurveyOverviewAsync(
        int semesterId,
        int? comparisonSemesterId,
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

        var courseIds = sections.Select(x => x.CourseId).Distinct().ToList();
        Dictionary<int, Course> courses = courseIds.Count == 0
            ? []
            : await db.Courses.AsNoTracking()
                .Where(x => courseIds.Contains(x.CourseId))
                .ToDictionaryAsync(x => x.CourseId, x => x, cancellationToken);

        var lecturerIds = sections.Select(x => x.LecturerId).Distinct().ToList();
        List<Lecturer> lecturers = lecturerIds.Count == 0
            ? []
            : await db.Lecturers.AsNoTracking()
                .Where(x => lecturerIds.Contains(x.LecturerId))
                .ToListAsync(cancellationToken);

        var deptIds = lecturers.Where(x => x.DepartmentId.HasValue).Select(x => x.DepartmentId!.Value)
            .Concat(courses.Values.Where(x => x.DepartmentId.HasValue).Select(x => x.DepartmentId!.Value))
            .Distinct()
            .ToList();
        Dictionary<int, Department> departments = deptIds.Count == 0
            ? []
            : await db.Departments.AsNoTracking()
                .Where(x => deptIds.Contains(x.DepartmentId))
                .ToDictionaryAsync(x => x.DepartmentId, x => x, cancellationToken);

        var facultyIds = lecturers.Where(x => x.FacultyId.HasValue).Select(x => x.FacultyId!.Value)
            .Concat(courses.Values.Where(x => x.FacultyId.HasValue).Select(x => x.FacultyId!.Value))
            .Concat(departments.Values.Where(x => x.FacultyId.HasValue).Select(x => x.FacultyId!.Value))
            .Distinct()
            .ToList();
        Dictionary<int, Faculty> faculties = facultyIds.Count == 0
            ? []
            : await db.Faculties.AsNoTracking()
                .Where(x => facultyIds.Contains(x.FacultyId))
                .ToDictionaryAsync(x => x.FacultyId, x => x, cancellationToken);

        // Gộp phiếu theo lớp (1 query duy nhất).
        var responseStats = await ResponseTalliesAsync(cssIds, cancellationToken);

        // Phân bố điểm theo nhóm (band 2..5) gộp ngay trong SQL.
        // Là số liệu chất lượng nên chỉ gộp phiếu hợp lệ.
        var bandCounts = cssIds.Count == 0
            ? new List<BandCount>()
            : (await db.SurveyResponses.AsNoTracking()
                .Where(x => cssIds.Contains(x.CourseSectionSurveyId) && x.IsValid)
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
        var facultyStats = new Dictionary<int, (int SectionCount, int Target, int Responses, int ValidResponses, decimal ScoreSum)>();
        var deptStats = new Dictionary<int, (int SectionCount, int Target, int Responses, int ValidResponses, decimal ScoreSum)>();
        int completedCount = 0;
        int inProgressCount = 0;
        int laggingCount = 0;

        foreach (var ss in sectionSurveys)
        {
            var sec = sections.FirstOrDefault(x => x.CourseSectionId == ss.CourseSectionId);
            var lec = sec is null ? null : lecturers.FirstOrDefault(x => x.LecturerId == sec.LecturerId);
            var course = sec is not null && courses.TryGetValue(sec.CourseId, out var matchedCourse)
                ? matchedCourse
                : null;
            int? reportDepartmentId = course?.DepartmentId ?? lec?.DepartmentId;
            int? reportFacultyId = course?.FacultyId;
            if (reportFacultyId is null
                && reportDepartmentId is { } owningDepartmentId
                && departments.TryGetValue(owningDepartmentId, out var owningDepartment))
            {
                reportFacultyId = owningDepartment.FacultyId;
            }
            reportFacultyId ??= lec?.FacultyId;
            var tally = responseStats.GetValueOrDefault(ss.CourseSectionSurveyId, ResponseTally.Empty);
            var cnt = tally.TotalCount;
            int classSize = sec?.ClassSize ?? 0;
            // Tỷ lệ hoàn thành là số liệu tiến độ nên đếm cả phiếu bị lọc.
            decimal rate = classSize > 0 ? Math.Round((decimal)cnt / classSize * 100, 2) : 0;

            if (rate >= 80) completedCount++;
            else if (rate >= 40) inProgressCount++;
            else laggingCount++;

            if (reportFacultyId is { } fId)
            {
                var f = facultyStats.TryGetValue(fId, out var fs) ? fs : (SectionCount: 0, Target: 0, Responses: 0, ValidResponses: 0, ScoreSum: 0m);
                f.SectionCount++;
                f.Target += classSize;
                f.Responses += cnt;
                f.ValidResponses += tally.ValidCount;
                f.ScoreSum += tally.ValidTotalScore;
                facultyStats[fId] = f;
            }

            if (reportDepartmentId is { } dId)
            {
                var d = deptStats.TryGetValue(dId, out var ds) ? ds : (SectionCount: 0, Target: 0, Responses: 0, ValidResponses: 0, ScoreSum: 0m);
                d.SectionCount++;
                d.Target += classSize;
                d.Responses += cnt;
                d.ValidResponses += tally.ValidCount;
                d.ScoreSum += tally.ValidTotalScore;
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
            decimal avg = stats.ValidResponses > 0
                ? Math.Round(stats.ScoreSum / stats.ValidResponses, 2)
                : 0;
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
            decimal avg = stats.ValidResponses > 0
                ? Math.Round(stats.ScoreSum / stats.ValidResponses, 2)
                : 0;
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
        int totalValidResponses = facultyStats.Values.Sum(x => x.ValidResponses);
        decimal totalScoreSum = facultyStats.Values.Sum(x => x.ScoreSum);
        decimal overallCompletion = totalTarget > 0 ? Math.Round((decimal)totalResponses / totalTarget * 100, 2) : 0;
        decimal overallAvg = totalValidResponses > 0
            ? Math.Round(totalScoreSum / totalValidResponses, 2)
            : 0;

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

        // Xu hướng so với học kỳ được chọn; nếu không chọn thì dùng học kỳ liền trước.
        var semesterComparison = await GetSemesterComparisonAsync(
            semesterId,
            comparisonSemesterId,
            totalResponses,
            totalTarget,
            overallAvg,
            cancellationToken);

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
            semesterComparison);
    }

    /// <summary>Gộp các câu hỏi yếu nhất toàn trường theo số lượt trả lời của kỳ.</summary>
    private async Task<IReadOnlyList<QuestionRatingDto>> BuildWeakestQuestionsAsync(
        List<int> cssIds,
        CancellationToken cancellationToken)
    {
        if (cssIds.Count == 0) return [];

        // Số lượt trả lời theo (Câu hỏi, Giá trị) gộp trong SQL qua join Responses →
        // Answers. "AnswerValue" là chuỗi nên gộp nguyên văn rồi mới ép sang số ở
        // dưới, chỉ với câu thuộc thang 'Options'.
        // Chỉ gộp phiếu hợp lệ vì đây là số liệu chất lượng.
        var valueCounts = await (from r in db.SurveyResponses.AsNoTracking()
                                 join a in db.SurveyResponseAnswers.AsNoTracking()
                                     on r.ResponseId equals a.ResponseId
                                 where cssIds.Contains(r.CourseSectionSurveyId) && r.IsValid
                                 group a by new { a.QuestionId, a.AnswerValue } into g
                                 select new { g.Key.QuestionId, g.Key.AnswerValue, Count = g.Count() })
            .ToListAsync(cancellationToken);

        if (valueCounts.Count == 0) return [];

        var questionIds = valueCounts.Select(x => x.QuestionId).Distinct().ToList();
        // Bỏ câu bẫy khỏi bảng xếp hạng câu hỏi yếu nhất.
        var questions = await db.SurveyQuestions.AsNoTracking()
            .Where(x => questionIds.Contains(x.QuestionId) && x.AttentionCheckValue == null)
            .ToListAsync(cancellationToken);
        var scaleByQuestion = await LoadScalesByQuestionAsync(questions, cancellationToken);
        var textById = questions.ToDictionary(x => x.QuestionId, x => x.QuestionText);

        var ratings = new List<QuestionRatingDto>();
        foreach (var group in valueCounts.GroupBy(x => x.QuestionId))
        {
            int qId = group.Key;

            // Câu tự nhập không có điểm nên không xếp hạng "yếu nhất" được.
            var scale = scaleByQuestion.GetValueOrDefault(qId);
            if (scale is null || scale.IsText) continue;

            int total = group.Sum(x => x.Count);
            if (total < WeakQuestionMinAnswers) continue;

            var counts = group
                .Select(x => (Value: int.TryParse(x.AnswerValue, out var v) ? v : (int?)null, x.Count))
                .Where(x => x.Value.HasValue)
                .ToList();

            int scored = counts.Sum(x => x.Count);
            if (scored == 0) continue;

            decimal sum = counts.Sum(x => (decimal)x.Value!.Value * x.Count);
            var options = scale.Options
                .OrderBy(option => option.Value)
                .Select(option =>
                {
                    int count = counts.Where(x => x.Value == option.Value).Sum(x => x.Count);
                    decimal pct = Math.Round((decimal)count / scored * 100, 1);
                    return new OptionCountDto(option.Value, option.DisplayText, count, pct);
                })
                .ToList();

            ratings.Add(new QuestionRatingDto(
                qId,
                textById.TryGetValue(qId, out var txt) ? txt : $"Câu hỏi #{qId}",
                Math.Round(sum / scored, 2),
                total,
                options,
                AnswerScaleKinds.Options,
                scale.AnswerScaleName));
        }

        return ratings
            .OrderBy(x => x.AverageScore) // yếu nhất trước
            .ThenByDescending(x => x.TotalAnswers)
            .Take(WeakQuestionCount)
            .ToList();
    }

    /// <summary>So sánh học kỳ hiện tại với kỳ được chọn; mặc định là kỳ liền trước.</summary>
    private async Task<SemesterComparisonDto?> GetSemesterComparisonAsync(
        int semesterId,
        int? comparisonSemesterId,
        int currentResponses,
        int currentTarget,
        decimal currentAvg,
        CancellationToken cancellationToken)
    {
        if (comparisonSemesterId == semesterId) return null;

        var comparisonSemesterQuery = db.Semesters.AsNoTracking();
        var comparisonSemester = comparisonSemesterId.HasValue
            ? await comparisonSemesterQuery.FirstOrDefaultAsync(
                x => x.SemesterId == comparisonSemesterId.Value,
                cancellationToken)
            : await comparisonSemesterQuery
                .Where(x => x.SemesterId < semesterId)
                .OrderByDescending(x => x.SemesterId)
                .FirstOrDefaultAsync(cancellationToken);
        if (comparisonSemester is null) return null;

        var comparisonYear = await db.AcademicYears.AsNoTracking()
            .FirstOrDefaultAsync(x => x.AcademicYearId == comparisonSemester.AcademicYearId, cancellationToken);

        var (comparisonTarget, comparisonResponses, comparisonAvg) = await ComputeSemesterCoreStatsAsync(
            comparisonSemester.SemesterId,
            cancellationToken);
        decimal comparisonCompletion = comparisonTarget > 0
            ? Math.Round((decimal)comparisonResponses / comparisonTarget * 100, 2)
            : 0;

        decimal currentCompletion = currentTarget > 0 ? Math.Round((decimal)currentResponses / currentTarget * 100, 2) : 0;

        return new SemesterComparisonDto(
            comparisonSemester.SemesterId,
            comparisonSemester.SemesterName,
            comparisonYear?.AcademicYearName ?? string.Empty,
            comparisonCompletion,
            comparisonAvg,
            Math.Round(currentCompletion - comparisonCompletion, 2),
            Math.Round(currentAvg - comparisonAvg, 2));
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

        // Số lượt nộp đếm hết (tiến độ), điểm chỉ gộp phiếu hợp lệ (chất lượng).
        var agg = await db.SurveyResponses.AsNoTracking()
            .Where(x => cssIds.Contains(x.CourseSectionSurveyId))
            .GroupBy(x => 1)
            .Select(g => new
            {
                Count = g.Count(),
                ValidCount = g.Count(x => x.IsValid),
                ValidTotalScore = g.Sum(x => x.IsValid ? x.Score : 0m)
            })
            .FirstOrDefaultAsync(cancellationToken);

        int responses = agg?.Count ?? 0;
        decimal avg = agg is null || agg.ValidCount == 0
            ? 0m
            : Math.Round(agg.ValidTotalScore / agg.ValidCount, 2);
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

    // ------------------------------------------------- Thang trả lời theo câu hỏi

    /// <summary>Thang trả lời kèm các mức của nó, dùng để đọc "AnswerValue".</summary>
    private sealed record ScaleInfo(
        int AnswerScaleId,
        string AnswerScaleName,
        string ScaleKind,
        IReadOnlyList<AnswerScaleOption> Options)
    {
        public bool IsText => ScaleKind == AnswerScaleKinds.Text;
    }

    /// <summary>Nạp thang trả lời của một tập câu hỏi, tra theo "QuestionId".</summary>
    private async Task<Dictionary<int, ScaleInfo>> LoadScalesByQuestionAsync(
        IReadOnlyList<SurveyQuestion> questions,
        CancellationToken cancellationToken)
    {
        if (questions.Count == 0) return [];

        var scaleIds = questions.Select(x => x.AnswerScaleId).Distinct().ToList();
        var scales = await db.AnswerScales.AsNoTracking()
            .Where(x => scaleIds.Contains(x.AnswerScaleId))
            .ToListAsync(cancellationToken);
        var options = await db.AnswerScaleOptions.AsNoTracking()
            .Where(x => scaleIds.Contains(x.AnswerScaleId))
            .OrderBy(x => x.Value)
            .ToListAsync(cancellationToken);

        var infoById = scales.ToDictionary(
            scale => scale.AnswerScaleId,
            scale => new ScaleInfo(
                scale.AnswerScaleId,
                scale.AnswerScaleName,
                scale.ScaleKind,
                options.Where(option => option.AnswerScaleId == scale.AnswerScaleId).ToList()));

        return questions
            .Where(question => infoById.ContainsKey(question.AnswerScaleId))
            .ToDictionary(question => question.QuestionId, question => infoById[question.AnswerScaleId]);
    }

    /// <summary>
    /// Thống kê một câu hỏi. Câu thang 'Options' ra điểm trung bình và phân bố các
    /// mức của chính thang đó; câu thang 'Text' ra danh sách nội dung người học gõ.
    /// </summary>
    private static QuestionRatingDto BuildQuestionRating(
        int questionId,
        string questionText,
        IReadOnlyList<SurveyResponseAnswer> answers,
        ScaleInfo? scale)
    {
        int total = answers.Count;

        if (scale is null)
        {
            return new QuestionRatingDto(questionId, questionText, 0, total, []);
        }

        if (scale.IsText)
        {
            var texts = answers
                .Select(x => x.AnswerValue)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Take(MaxTextAnswersPerQuestion)
                .ToList();

            return new QuestionRatingDto(
                questionId,
                questionText,
                0,
                total,
                [],
                AnswerScaleKinds.Text,
                scale.AnswerScaleName,
                texts);
        }

        // Chỉ "AnswerValue" đọc được ra số mới vào điểm; dòng hỏng thì bỏ qua.
        var values = answers
            .Select(x => int.TryParse(x.AnswerValue, out var value) ? value : (int?)null)
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .ToList();

        decimal average = values.Count > 0 ? Math.Round((decimal)values.Average(), 2) : 0;

        // Phân bố theo đúng các mức mà thang này có, không cứng 1..5.
        var distribution = scale.Options
            .OrderBy(option => option.Value)
            .Select(option =>
            {
                int count = values.Count(value => value == option.Value);
                decimal pct = values.Count > 0 ? Math.Round((decimal)count / values.Count * 100, 1) : 0;
                return new OptionCountDto(option.Value, option.DisplayText, count, pct);
            })
            .ToList();

        return new QuestionRatingDto(
            questionId,
            questionText,
            average,
            total,
            distribution,
            AnswerScaleKinds.Options,
            scale.AnswerScaleName);
    }
}
