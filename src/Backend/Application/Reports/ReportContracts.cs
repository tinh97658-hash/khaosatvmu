namespace Application.Reports;

/// <summary>Chi tiết tiến độ thu phiếu của một lớp học phần.</summary>
public sealed record SectionProgressDetailDto(
    int CourseSectionSurveyId,
    string CourseCode,
    string CourseName,
    string SectionName,
    string LecturerName,
    int ClassSize,
    int ResponseCount,
    decimal CompletionRate,
    string Status);

/// <summary>Báo cáo tiến độ vận hành thu phiếu theo học kỳ.</summary>
public sealed record OperationalProgressReportDto(
    int SemesterId,
    string SemesterName,
    string AcademicYearName,
    int TotalTargetResponses,
    int TotalActualResponses,
    decimal OverallCompletionRate,
    int CompletedSectionCount,
    int InProgressSectionCount,
    int LaggingSectionCount,
    IReadOnlyList<SectionProgressDetailDto> SectionDetails);

/// <summary>Thống kê số lượng và tỷ lệ % của một lựa chọn điểm 1..5.</summary>
public sealed record OptionCountDto(
    int Value,
    string DisplayText,
    int Count,
    decimal Percentage);

/// <summary>
/// Thống kê một câu hỏi cụ thể theo mẫu khảo sát.
/// Câu thuộc thang 'Options' có <paramref name="AverageScore"/> và
/// <paramref name="OptionDistribution"/>; câu thuộc thang 'Text' để cả hai rỗng
/// và đọc nội dung ở <paramref name="TextAnswers"/>.
/// </summary>
public sealed record QuestionRatingDto(
    int QuestionId,
    string QuestionText,
    decimal AverageScore,
    int TotalAnswers,
    IReadOnlyList<OptionCountDto> OptionDistribution,
    string ScaleKind = "Options",
    string AnswerScaleName = "",
    IReadOnlyList<string>? TextAnswers = null);

/// <summary>Tóm tắt kết quả của một lớp học phần mà giảng viên đảm nhận.</summary>
public sealed record LecturerSectionSummaryDto(
    int CourseSectionSurveyId,
    string CourseCode,
    string CourseName,
    string SectionName,
    int ClassSize,
    int ResponseCount,
    decimal AverageScore);

/// <summary>Báo cáo chi tiết đánh giá năng lực & hài lòng của Giảng viên.</summary>
public sealed record LecturerPerformanceReportDto(
    int LecturerId,
    string FullName,
    string DepartmentName,
    string FacultyName,
    decimal AverageScore,
    int TotalResponses,
    int CourseSectionCount,
    decimal DepartmentAverageScore,
    decimal FacultyAverageScore,
    IReadOnlyList<LecturerSectionSummaryDto> Sections,
    IReadOnlyList<QuestionRatingDto> QuestionRatings);

/// <summary>Báo cáo thống kê cấp Bộ môn.</summary>
public sealed record DepartmentSummaryDto(
    int DepartmentId,
    string DepartmentName,
    int LecturerCount,
    int SectionCount,
    int ResponseCount,
    decimal AverageSatisfactionScore);

/// <summary>Báo cáo thống kê cấp Khoa / Viện.</summary>
public sealed record FacultyDepartmentReportDto(
    int FacultyId,
    string FacultyName,
    int TotalDepartments,
    int TotalLecturers,
    int TotalSections,
    int TotalResponses,
    decimal AverageSatisfactionScore,
    IReadOnlyList<DepartmentSummaryDto> Departments);

/// <summary>Báo cáo phân tích tổng hợp theo tiêu chí / câu hỏi của đợt khảo sát.</summary>
public sealed record SurveyQuestionSummaryReportDto(
    int SemesterSurveyId,
    int SurveyTemplateId,
    string TemplateName,
    int TotalResponses,
    decimal OverallAverageScore,
    IReadOnlyList<QuestionRatingDto> Questions);

/// <summary>Báo cáo phân tích theo từng câu hỏi của một bài khảo sát lớp học phần.</summary>
public sealed record SectionSurveyAnalysisDto(
    int CourseSectionSurveyId,
    string CourseCode,
    string CourseName,
    string SectionName,
    string LecturerName,
    int ClassSize,
    int ResponseCount,
    decimal AverageScore,
    string TemplateName,
    IReadOnlyList<QuestionRatingDto> Questions);

/// <summary>Một dòng kết quả chi tiết của một bài khảo sát lớp học phần.</summary>
public sealed record SurveyResultDetailDto(
    int CourseSectionSurveyId,
    int SemesterSurveyId,
    string TemplateName,
    int LecturerId,
    string LecturerName,
    int DepartmentId,
    string DepartmentName,
    int FacultyId,
    string FacultyName,
    string CourseCode,
    string CourseName,
    string SectionName,
    int ClassSize,
    int ResponseCount,
    decimal CompletionRate,
    decimal AverageScore);

/// <summary>Một nhóm điểm trong phân bố điểm toàn trường (theo điểm TB từng phiếu).</summary>
public sealed record ScoreBandDto(
    int Band,
    string Label,
    int Count,
    decimal Percentage);

/// <summary>Dữ liệu 1 Khoa cho biểu đồ tổng quan toàn trường.</summary>
public sealed record FacultyOverviewDto(
    int FacultyId,
    string FacultyName,
    int DepartmentCount,
    int SectionCount,
    int TargetResponses,
    int ResponseCount,
    decimal CompletionRate,
    decimal AverageScore);

/// <summary>Dữ liệu 1 Bộ môn cho bảng "chậm tiến độ" của tổng quan toàn trường.</summary>
public sealed record DepartmentOverviewDto(
    int DepartmentId,
    string DepartmentName,
    int FacultyId,
    string FacultyName,
    int SectionCount,
    int TargetResponses,
    int ResponseCount,
    decimal CompletionRate,
    decimal AverageScore);

/// <summary>So sánh học kỳ hiện tại với một học kỳ được chọn.</summary>
public sealed record SemesterComparisonDto(
    int ComparisonSemesterId,
    string ComparisonSemesterName,
    string ComparisonAcademicYearName,
    decimal ComparisonCompletionRate,
    decimal ComparisonAverageScore,
    decimal CompletionRateDelta,
    decimal AverageScoreDelta);

/// <summary>Bảng tổng quan toàn trường (executive summary) của một học kỳ.</summary>
public sealed record SchoolSurveyOverviewDto(
    int SemesterId,
    string SemesterName,
    string AcademicYearName,

    // Quy mô & tiến độ thu phiếu
    int TotalSections,
    int TotalTargetResponses,
    int TotalResponses,
    decimal CompletionRate,
    int CompletedSectionCount,
    int InProgressSectionCount,
    int LaggingSectionCount,

    // Chất lượng kết quả
    decimal OverallAverageScore,
    IReadOnlyList<ScoreBandDto> ScoreDistribution,

    // So sánh theo Khoa (SchoolAverageScore dùng làm đường tham chiếu cho biểu đồ)
    decimal SchoolAverageScore,
    IReadOnlyList<FacultyOverviewDto> Faculties,

    // Bộ môn để lọc "chậm tiến độ nhất"
    IReadOnlyList<DepartmentOverviewDto> Departments,

    // Tiêu chí yếu nhất toàn trường (gộp mọi phiếu trong kỳ)
    IReadOnlyList<QuestionRatingDto> WeakestQuestions,

    // Xu hướng so với học kỳ được chọn (mặc định là kỳ liền trước)
    SemesterComparisonDto? SemesterComparison);

/// <summary>Dịch vụ truy vấn và tổng hợp các báo cáo thống kê.</summary>
public interface IReportService
{
    /// <summary>Lấy báo cáo tiến độ vận hành đợt thu phiếu theo học kỳ.</summary>
    Task<OperationalProgressReportDto?> GetOperationalProgressReportAsync(
        int semesterId,
        CancellationToken cancellationToken = default);

    /// <summary>Lấy danh sách báo cáo đánh giá giảng viên (có lọc theo Khoa/Bộ môn/Kỳ).</summary>
    Task<IReadOnlyList<LecturerPerformanceReportDto>> GetLecturerPerformanceReportsAsync(
        int? facultyId,
        int? departmentId,
        int? semesterId,
        CancellationToken cancellationToken = default);

    /// <summary>Lấy báo cáo đánh giá chi tiết cho 1 giảng viên.</summary>
    Task<LecturerPerformanceReportDto?> GetLecturerPerformanceReportAsync(
        int lecturerId,
        int? semesterId,
        CancellationToken cancellationToken = default);

    /// <summary>Lấy báo cáo thống kê so sánh cấp Khoa / Viện và Bộ môn.</summary>
    Task<IReadOnlyList<FacultyDepartmentReportDto>> GetFacultyDepartmentReportsAsync(
        int? semesterId,
        CancellationToken cancellationToken = default);

    /// <summary>Lấy báo cáo phân tích theo từng câu hỏi / tiêu chí khảo sát.</summary>
    Task<SurveyQuestionSummaryReportDto?> GetQuestionAnalysisReportAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken = default);

    /// <summary>Lấy báo cáo phân tích từng câu hỏi của một bài khảo sát lớp học phần.</summary>
    Task<SectionSurveyAnalysisDto?> GetSectionSurveyAnalysisAsync(
        int courseSectionSurveyId,
        CancellationToken cancellationToken = default);

    /// <summary>Lấy kết quả chi tiết từng bài khảo sát lớp, có lọc theo đơn vị / giảng viên / đợt / tên.</summary>
    Task<IReadOnlyList<SurveyResultDetailDto>> GetSurveyResultsAsync(
        int? semesterId,
        int? facultyId,
        int? departmentId,
        int? lecturerId,
        int? semesterSurveyId,
        string? search,
        CancellationToken cancellationToken = default);

    /// <summary>Lấy bảng tổng quan toàn trường và so sánh với kỳ được chọn (mặc định là kỳ trước).</summary>
    Task<SchoolSurveyOverviewDto?> GetSchoolSurveyOverviewAsync(
        int semesterId,
        int? comparisonSemesterId = null,
        CancellationToken cancellationToken = default);
}
