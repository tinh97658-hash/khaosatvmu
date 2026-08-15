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

/// <summary>Thống kê điểm một câu hỏi cụ thể theo mẫu khảo sát.</summary>
public sealed record QuestionRatingDto(
    int QuestionId,
    string QuestionText,
    decimal AverageScore,
    int TotalAnswers,
    IReadOnlyList<OptionCountDto> OptionDistribution);

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
}
