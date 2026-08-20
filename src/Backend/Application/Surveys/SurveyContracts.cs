namespace Application.Surveys;

public sealed record AnswerScaleOptionDto(
    int AnswerScaleOptionId,
    int AnswerScaleId,
    int Value,
    string DisplayText);

/// <summary><paramref name="ScaleKind"/> là 'Options' hoặc 'Text' (xem Domain.AnswerScaleKinds).</summary>
public sealed record AnswerScaleDto(
    int AnswerScaleId,
    string AnswerScaleName,
    string ScaleKind,
    IReadOnlyList<AnswerScaleOptionDto> Options);

/// <summary>
/// Câu hỏi trong trình soạn bộ câu hỏi của quản trị.
/// <paramref name="AttentionCheckValue"/> khác null nghĩa là câu bẫy độ tập trung.
/// DTO này chỉ dùng cho màn quản trị, không phải màn sinh viên làm bài.
/// </summary>
public sealed record SurveyQuestionDto(
    int QuestionId,
    int SurveyTemplateId,
    string QuestionText,
    int AnswerScaleId,
    int? AttentionCheckValue);

public sealed record SurveyTemplateDto(
    int SurveyTemplateId,
    string TemplateName,
    DateTime CreatedAt,
    IReadOnlyList<SurveyQuestionDto> Questions);

public sealed record SaveAnswerScaleOptionCommand(int Value, string DisplayText);

/// <summary>Thang loại 'Text' không nhận mức nào; danh sách <paramref name="Options"/> phải rỗng.</summary>
public sealed record SaveAnswerScaleCommand(
    string AnswerScaleName,
    string ScaleKind,
    IReadOnlyList<SaveAnswerScaleOptionCommand> Options);

/// <summary>
/// Một câu hỏi kèm thang trả lời của riêng nó.
/// <paramref name="AttentionCheckValue"/> khác null biến câu này thành câu bẫy độ
/// tập trung: người trả lời phải chọn đúng mức đó thì phiếu mới hợp lệ. Chỉ đặt
/// được trên câu thuộc thang 'Options' và phải là một mức có thật của thang đó.
/// </summary>
public sealed record SaveSurveyQuestionCommand(
    string QuestionText,
    int AnswerScaleId,
    int? AttentionCheckValue);

/// <summary>
/// Lưu cả bộ câu hỏi trong một lần: danh sách câu hỏi được ghi đè theo đúng thứ
/// tự gửi lên, tối đa <see cref="SurveyRules.MaximumQuestionsPerTemplate"/> câu.
/// Mỗi câu mang thang trả lời riêng nên một bộ trộn được nhiều loại thang.
/// </summary>
public sealed record SaveSurveyTemplateCommand(
    string TemplateName,
    IReadOnlyList<SaveSurveyQuestionCommand> Questions);

/// <summary>Một đợt khảo sát của học kỳ, kèm số lớp và số phiếu đã thu.</summary>
public sealed record SemesterSurveyDto(
    int SemesterSurveyId,
    int SemesterId,
    string SemesterName,
    string AcademicYearName,
    int SurveyTemplateId,
    string TemplateName,
    int QuestionCount,
    DateTime CreatedAt,
    DateTime StartTime,
    DateTime EndTime,
    int SectionSurveyCount,
    int ResponseCount);

// ------------------------------------------- Sheet 1: chuẩn hoá điểm (Z-score)

/// <summary>
/// Một nhóm tương đương trong bảng chuẩn hoá. Nhóm ở đây là khoa/viện.
/// <paramref name="StandardDeviation"/> null khi nhóm có ít hơn hai lớp.
/// </summary>
public sealed record NormalizationGroupDto(
    int? FacultyId,
    string FacultyName,
    int SectionCount,
    decimal AverageScore,
    decimal? StandardDeviation,
    /// <summary>Đủ số lớp tối thiểu để chuẩn hoá hay không.</summary>
    bool CanNormalize);

/// <summary>Một lớp trong bảng chi tiết của sheet chuẩn hoá điểm.</summary>
public sealed record NormalizedSectionDto(
    int CourseSectionSurveyId,
    string CourseCode,
    string CourseName,
    string SectionName,
    string LecturerName,
    string FacultyName,
    int ClassSize,
    decimal AverageScore,
    /// <summary>So với mặt bằng toàn đợt.</summary>
    decimal? ZSchool,
    /// <summary>So với mặt bằng khoa; null khi khoa quá ít lớp.</summary>
    decimal? ZFaculty,
    /// <summary>Z trong khoa trừ Z toàn trường. Lệch nhiều nghĩa là chuẩn hoá đổi kết luận.</summary>
    decimal? ZDifference,
    /// <summary>Mã trong <see cref="NormalizationVerdicts"/>.</summary>
    string Verdict);

/// <summary>Toàn bộ sheet chuẩn hoá điểm của một đợt khảo sát.</summary>
public sealed record SemesterSurveyNormalizationDto(
    int SemesterSurveyId,
    string TemplateName,
    string SemesterName,
    string AcademicYearName,
    /// <summary>Số lớp đã có phiếu; lớp chưa ai làm không tham gia mặt bằng.</summary>
    int SchoolSectionCount,
    decimal SchoolAverageScore,
    decimal? SchoolStandardDeviation,
    IReadOnlyList<NormalizationGroupDto> Groups,
    IReadOnlyList<NormalizedSectionDto> Sections);

// --------------------------------------- Sheet 3: tổng hợp theo bộ môn

/// <summary>Một dòng của bảng tổng hợp theo bộ môn, phục vụ trưởng khoa.</summary>
public sealed record DepartmentSummaryRowDto(
    int? FacultyId,
    string FacultyName,
    int? DepartmentId,
    string DepartmentName,
    int SectionCount,
    int LecturerCount,
    int ResponseCount,
    /// <summary>Tỷ lệ phản hồi bình quân, đếm cả phiếu bị lọc.</summary>
    decimal AverageCompletionRate,
    /// <summary>Điểm tổng hợp, chỉ gộp phiếu hợp lệ. Null khi chưa có phiếu nào.</summary>
    decimal? AverageScore,
    /// <summary>Số lớp có điểm dưới <see cref="ReportThresholds.LowScore"/>.</summary>
    int WarningSectionCount,
    /// <summary>Câu yếu nhất của bộ môn, đánh số theo vị trí gốc trong bộ câu hỏi.</summary>
    int? WeakestQuestionOrder,
    decimal? WeakestQuestionScore,
    string? WeakestQuestionText);

public sealed record SemesterSurveyDepartmentSummaryDto(
    int SemesterSurveyId,
    string TemplateName,
    string SemesterName,
    string AcademicYearName,
    IReadOnlyList<DepartmentSummaryRowDto> Rows);

// -------------------- Sheet 4: tách nguyên nhân học phần / giảng viên

/// <summary>Một học phần trong bảng chẩn đoán, gộp mọi lớp của học phần đó.</summary>
public sealed record CourseDiagnosisRowDto(
    int CourseId,
    string CourseCode,
    string CourseName,
    string FacultyName,
    int SectionCount,
    int LecturerCount,
    decimal AverageScore,
    decimal MinScore,
    decimal MaxScore,
    /// <summary>Cao nhất trừ thấp nhất. Học phần một lớp thì luôn bằng 0.</summary>
    decimal Spread,
    int? WeakestQuestionOrder,
    decimal? WeakestQuestionScore,
    string? WeakestQuestionText,
    /// <summary>Mã trong <see cref="CourseDiagnosisVerdicts"/>.</summary>
    string Verdict);

public sealed record SemesterSurveyCourseDiagnosisDto(
    int SemesterSurveyId,
    string TemplateName,
    string SemesterName,
    string AcademicYearName,
    IReadOnlyList<CourseDiagnosisRowDto> Rows);

// ------------------------------ Sheet 5: báo cáo cá nhân giảng viên

/// <summary>Một giảng viên có dạy trong đợt, dùng cho ô chọn ở bộ lọc.</summary>
public sealed record LecturerOptionDto(
    int LecturerId,
    string FullName,
    string DepartmentName,
    string FacultyName,
    int SectionCount);

/// <summary>Một lớp trong bảng "các lớp giảng dạy trong kỳ".</summary>
public sealed record LecturerSectionDto(
    int CourseSectionSurveyId,
    string CourseCode,
    string CourseName,
    string SectionName,
    int ClassSize,
    int ResponseCount,
    decimal CompletionRate,
    decimal AverageScore,
    /// <summary>Z so với mặt bằng khoa; null khi khoa quá ít lớp để chuẩn hoá.</summary>
    decimal? ZFaculty);

/// <summary>
/// Một dòng của bảng so sánh mặt bằng. Mọi con số đều là điểm trung bình của
/// từng lớp cho câu đó, rồi lấy trung vị theo bộ môn và theo khoa — trung vị chứ
/// không phải trung bình, để một lớp cá biệt không kéo lệch cả mặt bằng.
/// </summary>
public sealed record LecturerQuestionComparisonDto(
    int QuestionOrder,
    string QuestionText,
    decimal LecturerScore,
    decimal? DepartmentMedian,
    decimal? FacultyMedian,
    decimal? DifferenceFromDepartment);

public sealed record LecturerReportDto(
    int LecturerId,
    string FullName,
    string DepartmentName,
    string FacultyName,
    int SectionCount,
    int TotalResponseCount,
    decimal AverageScore,
    IReadOnlyList<LecturerSectionDto> Sections,
    IReadOnlyList<LecturerQuestionComparisonDto> Comparisons);

// ------------------------------ Sheet 6: tổng quan toàn trường của một đợt

/// <summary>Điểm trung bình toàn trường của một câu hỏi.</summary>
public sealed record DashboardQuestionScoreDto(
    int QuestionOrder,
    string QuestionText,
    decimal AverageScore,
    /// <summary>Số lớp có điểm câu này dưới <see cref="ReportThresholds.LowScore"/>.</summary>
    int SectionsBelowThreshold);

/// <summary>Một cột của biểu đồ điểm tổng hợp theo khoa/viện.</summary>
public sealed record DashboardFacultyScoreDto(
    int? FacultyId,
    string FacultyName,
    int SectionCount,
    decimal AverageScore);

/// <summary>
/// Số liệu của màn hình tổng quan. Bốn chỉ số đầu là chỉ số TIẾN ĐỘ nên đếm mọi
/// lớp và mọi phiếu thu được; điểm và các bảng bên dưới là chỉ số CHẤT LƯỢNG nên
/// chỉ tính trên phiếu hợp lệ.
/// </summary>
public sealed record SemesterSurveyDashboardDto(
    int SemesterSurveyId,
    string TemplateName,
    string SemesterName,
    string AcademicYearName,
    int SectionCount,
    int TotalResponseCount,
    decimal AverageCompletionRate,
    /// <summary>Null khi chưa lớp nào thu được phiếu hợp lệ.</summary>
    decimal? OverallScore,
    int ScoredSectionCount,
    IReadOnlyList<DashboardQuestionScoreDto> Questions,
    /// <summary>Năm câu điểm thấp nhất, sắp từ thấp lên.</summary>
    IReadOnlyList<DashboardQuestionScoreDto> WeakestQuestions,
    IReadOnlyList<DashboardFacultyScoreDto> Faculties,
    /// <summary>Số học phần mà mọi lớp đều dưới ngưỡng.</summary>
    int CourseIssueCount,
    /// <summary>Số học phần có biên độ điểm giữa các lớp quá rộng.</summary>
    int LecturerVarianceCount);

/// <summary>Kết quả một lần bấm tính lại điểm theo mẻ cho cả đợt khảo sát.</summary>
public sealed record RecalculateScoresDto(
    int SemesterSurveyId,
    /// <summary>Số lớp học phần đã được ghi lại điểm.</summary>
    int UpdatedSectionCount,
    DateTime CalculatedAt);

/// <summary>
/// Điểm trung bình của một câu hỏi trong phạm vi một lớp — chính là cột C1, C2…
/// của bảng thống kê.
/// </summary>
public sealed record SectionQuestionScoreDto(int QuestionId, decimal AverageScore, int AnswerCount);

/// <summary>
/// Một dòng của bảng thống kê: toàn bộ số liệu khảo sát của một lớp học phần.
/// Số về tiến độ (<paramref name="TotalResponseCount"/>, <paramref name="CompletionRate"/>)
/// đếm cả phiếu bị lọc; số về chất lượng chỉ gộp phiếu hợp lệ.
/// </summary>
public sealed record SectionStatisticsRowDto(
    int CourseSectionId,
    int CourseSectionSurveyId,
    string CourseCode,
    string CourseName,
    string SectionName,
    string DepartmentName,
    string LecturerName,
    int ClassSize,
    int TotalResponseCount,
    int ValidResponseCount,
    int InvalidResponseCount,
    decimal CompletionRate,
    /// <summary>Ảnh chụp lần bấm tính gần nhất; null là chưa tính lần nào.</summary>
    decimal? AverageScore,
    DateTime? ScoreCalculatedAt,
    /// <summary>Số phiếu có điền ô "Ý kiến khác" ở cuối bài.</summary>
    int OpenCommentCount,
    /// <summary>Câu có điểm thấp nhất của lớp; null khi lớp chưa có phiếu hợp lệ.</summary>
    int? WeakestQuestionId,
    decimal? WeakestQuestionScore,
    /// <summary>Điểm từng câu, theo đúng thứ tự cột C của bảng.</summary>
    IReadOnlyList<SectionQuestionScoreDto> QuestionScores);

/// <summary>Một cột C của bảng thống kê, sinh theo bộ câu hỏi của đợt.</summary>
public sealed record StatisticsQuestionColumnDto(int QuestionId, int Order, string QuestionText);

/// <summary>
/// Toàn bộ bảng thống kê của một đợt khảo sát. Số cột C thay đổi theo bộ câu hỏi
/// nên phải trả kèm danh sách cột, không cố định trong giao diện.
/// </summary>
public sealed record SemesterSurveyStatisticsDto(
    int SemesterSurveyId,
    string TemplateName,
    string SemesterName,
    string AcademicYearName,
    /// <summary>Thời điểm tính gần nhất trong các lớp; null là chưa lớp nào được tính.</summary>
    DateTime? LastCalculatedAt,
    /// <summary>Số phiếu về sau lần tính gần nhất, cảnh báo số đang xem đã cũ.</summary>
    int ResponsesSinceLastCalculation,
    IReadOnlyList<StatisticsQuestionColumnDto> QuestionColumns,
    /// <summary>
    /// Vị trí các câu bẫy trong bộ câu hỏi. Bảng không có cột cho chúng nên phải
    /// nói ra, nếu không người xem sẽ thắc mắc tại sao nhảy cóc số câu.
    /// </summary>
    IReadOnlyList<int> AttentionCheckOrders,
    IReadOnlyList<SectionStatisticsRowDto> Rows);

/// <summary>Bài khảo sát của một lớp học phần: link, mã QR và số lượt trả lời.</summary>
public sealed record CourseSectionSurveyDto(
    int CourseSectionSurveyId,
    int SemesterSurveyId,
    int CourseSectionId,
    string LinkToken,
    DateTime StartTime,
    DateTime EndTime,
    string CourseCode,
    string CourseName,
    string SectionName,
    string LecturerName,
    int ClassSize,
    int ResponseCount);

public sealed record CreateSemesterSurveyCommand(
    int SemesterId,
    int SurveyTemplateId,
    DateTime StartTime,
    DateTime EndTime);

public sealed record SaveSurveyScheduleCommand(DateTime StartTime, DateTime EndTime);

public sealed record PublicSurveyQuestionDto(int QuestionId, string QuestionText, int AnswerScaleId);

/// <summary>
/// Dữ liệu phiếu khảo sát mà sinh viên thấy khi mở link hoặc quét QR.
/// <paramref name="AnswerScales"/> là các thang mà bộ câu hỏi đang dùng; mỗi câu
/// trong <paramref name="Questions"/> trỏ tới một thang qua "AnswerScaleId".
/// </summary>
public sealed record PublicSurveyDto(
    string LinkToken,
    string TemplateName,
    string CourseCode,
    string CourseName,
    string SectionName,
    string LecturerName,
    string SemesterName,
    string AcademicYearName,
    DateTime StartTime,
    DateTime EndTime,
    bool IsOpen,
    IReadOnlyList<AnswerScaleDto> AnswerScales,
    IReadOnlyList<PublicSurveyQuestionDto> Questions);

/// <summary>
/// <paramref name="AnswerValue"/> là số mức đã chọn ("1".."5") với câu thang
/// 'Options', hoặc nội dung tự nhập với câu thang 'Text'.
/// </summary>
public sealed record SubmitSurveyAnswerCommand(int QuestionId, string AnswerValue);

/// <summary>
/// <paramref name="ElapsedSeconds"/> là số giây từ lúc phát vé bắt đầu tới lúc
/// nhận được request. Vé không đọc được thì tầng API truyền 0, để bộ lọc bắt.
/// </summary>
public sealed record SubmitSurveyResponseCommand(
    IReadOnlyList<SubmitSurveyAnswerCommand> Answers,
    string? AdditionalComments,
    double ElapsedSeconds);

public sealed record SubmitSurveyResponseDto(int ResponseId, decimal Score, DateTime SubmittedAt);

/// <summary>Số câu đã chọn ở một mức trả lời trong cùng một phiếu (chỉ câu thang 'Options').</summary>
public sealed record SurveyResponseValueCountDto(int Value, string DisplayText, int Count);

/// <summary>
/// Một phiếu trả lời trong danh sách của bài khảo sát một lớp học phần.
/// <paramref name="IsValid"/> và <paramref name="RejectionReasons"/> là kết quả
/// lọc nhiễu; chỉ màn quản trị mới thấy, sinh viên không được báo gì.
/// </summary>
public sealed record SurveyResponseSummaryDto(
    int ResponseId,
    int CourseSectionSurveyId,
    DateTime SubmittedAt,
    decimal Score,
    string? AdditionalComments,
    int AnswerCount,
    IReadOnlyList<SurveyResponseValueCountDto> ValueCounts,
    bool IsValid,
    string? RejectionReasons);

/// <summary>
/// Một câu trong phiếu đã nộp. <paramref name="SelectedValue"/> chỉ có giá trị khi
/// câu thuộc thang 'Options'; câu thang 'Text' để null và đọc ở
/// <paramref name="AnswerValue"/>.
/// </summary>
public sealed record SurveyResponseAnswerDto(
    int QuestionId,
    string QuestionText,
    int AnswerScaleId,
    string ScaleKind,
    string AnswerValue,
    int? SelectedValue,
    string SelectedText);

/// <summary>Toàn bộ nội dung một phiếu trả lời, dùng cho modal chỉ xem.</summary>
public sealed record SurveyResponseDetailDto(
    int ResponseId,
    int CourseSectionSurveyId,
    DateTime SubmittedAt,
    decimal Score,
    string? AdditionalComments,
    string TemplateName,
    string CourseCode,
    string CourseName,
    string SectionName,
    string LecturerName,
    IReadOnlyList<AnswerScaleDto> AnswerScales,
    IReadOnlyList<SurveyResponseAnswerDto> Answers);

public sealed record SurveyOperationResult<T>(bool Succeeded, string? ErrorCode, T? Value);

public static class SurveyRules
{
    /// <summary>Giới hạn của bảng "SurveyQuestions" theo dtb.md.</summary>
    public const int MaximumQuestionsPerTemplate = 30;

    /// <summary>Số mức tối đa của một thang: "AnswerScaleOptions"."Value" CHECK 1..5.</summary>
    public const int MaximumAnswerScaleOptions = 5;

    /// <summary>Độ dài tối đa của câu trả lời tự nhập ("SurveyResponseAnswers"."AnswerValue").</summary>
    public const int MaximumTextAnswerLength = 2000;
}

public interface ISurveyService
{
    Task<IReadOnlyList<AnswerScaleDto>> GetAnswerScalesAsync(CancellationToken cancellationToken = default);

    Task<SurveyOperationResult<AnswerScaleDto>> CreateAnswerScaleAsync(
        SaveAnswerScaleCommand command,
        CancellationToken cancellationToken = default);

    Task<SurveyOperationResult<AnswerScaleDto>> UpdateAnswerScaleAsync(
        int answerScaleId,
        SaveAnswerScaleCommand command,
        CancellationToken cancellationToken = default);

    Task<SurveyOperationResult<bool>> DeleteAnswerScaleAsync(
        int answerScaleId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SurveyTemplateDto>> GetSurveyTemplatesAsync(CancellationToken cancellationToken = default);

    Task<SurveyOperationResult<SurveyTemplateDto>> CreateSurveyTemplateAsync(
        SaveSurveyTemplateCommand command,
        CancellationToken cancellationToken = default);

    Task<SurveyOperationResult<SurveyTemplateDto>> UpdateSurveyTemplateAsync(
        int surveyTemplateId,
        SaveSurveyTemplateCommand command,
        CancellationToken cancellationToken = default);

    Task<SurveyOperationResult<bool>> DeleteSurveyTemplateAsync(
        int surveyTemplateId,
        CancellationToken cancellationToken = default);

    /// <summary>Bỏ trống semesterId để lấy toàn bộ đợt khảo sát.</summary>
    Task<IReadOnlyList<SemesterSurveyDto>> GetSemesterSurveysAsync(
        int? semesterId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Tạo đợt khảo sát cho một học kỳ: mỗi lớp học phần của kỳ được sinh một
    /// bài khảo sát riêng với LinkToken riêng, dùng chung bộ câu hỏi đã chọn.
    /// </summary>
    Task<SurveyOperationResult<SemesterSurveyDto>> CreateSemesterSurveyAsync(
        CreateSemesterSurveyCommand command,
        CancellationToken cancellationToken = default);

    Task<SurveyOperationResult<bool>> DeleteSemesterSurveyAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CourseSectionSurveyDto>> GetCourseSectionSurveysAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken = default);

    Task<SurveyOperationResult<CourseSectionSurveyDto>> GetCourseSectionSurveyAsync(
        int courseSectionSurveyId,
        CancellationToken cancellationToken = default);

    /// <summary>Danh sách phiếu trả lời đã thu của một lớp học phần.</summary>
    Task<SurveyOperationResult<IReadOnlyList<SurveyResponseSummaryDto>>> GetSurveyResponsesAsync(
        int courseSectionSurveyId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Tính lại điểm trung bình cho mọi lớp của một đợt khảo sát. Chạy theo mẻ khi
    /// quản trị bấm nút, không tự chạy sau mỗi phiếu mới về.
    /// </summary>
    Task<SurveyOperationResult<RecalculateScoresDto>> RecalculateSemesterSurveyScoresAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken = default);

    /// <summary>Bảng thống kê đầy đủ của một đợt khảo sát, dùng cho trang thống kê.</summary>
    Task<SurveyOperationResult<SemesterSurveyStatisticsDto>> GetSemesterSurveyStatisticsAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Chuẩn hoá điểm các lớp bằng Z-score, hai tầng: so toàn đợt và so trong
    /// khoa/viện. Tự tính từ phiếu hợp lệ chứ không đọc cột đã lưu.
    /// </summary>
    Task<SurveyOperationResult<SemesterSurveyNormalizationDto>> GetSemesterSurveyNormalizationAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken = default);

    /// <summary>Tổng hợp theo bộ môn của một đợt khảo sát, phục vụ trưởng khoa.</summary>
    Task<SurveyOperationResult<SemesterSurveyDepartmentSummaryDto>> GetSemesterSurveyDepartmentSummaryAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// So các lớp trong cùng một học phần để tách nguyên nhân: vấn đề thuộc học
    /// phần hay thuộc giảng viên.
    /// </summary>
    Task<SurveyOperationResult<SemesterSurveyCourseDiagnosisDto>> GetSemesterSurveyCourseDiagnosisAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken = default);

    /// <summary>Danh sách giảng viên có dạy trong đợt, dùng cho bộ lọc.</summary>
    Task<SurveyOperationResult<IReadOnlyList<LecturerOptionDto>>> GetSemesterSurveyLecturersAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken = default);

    /// <summary>Báo cáo cá nhân của một giảng viên trong một đợt khảo sát.</summary>
    Task<SurveyOperationResult<LecturerReportDto>> GetLecturerSurveyReportAsync(
        int semesterSurveyId,
        int lecturerId,
        CancellationToken cancellationToken = default);

    /// <summary>Tổng quan một đợt khảo sát ở phạm vi toàn trường.</summary>
    Task<SurveyOperationResult<SemesterSurveyDashboardDto>> GetSemesterSurveyDashboardAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken = default);

    Task<SurveyOperationResult<SurveyResponseDetailDto>> GetSurveyResponseAsync(
        int responseId,
        CancellationToken cancellationToken = default);

    Task<SurveyOperationResult<CourseSectionSurveyDto>> UpdateCourseSectionSurveyScheduleAsync(
        int courseSectionSurveyId,
        SaveSurveyScheduleCommand command,
        CancellationToken cancellationToken = default);

    /// <summary>Đọc phiếu khảo sát theo LinkToken, không cần đăng nhập.</summary>
    Task<SurveyOperationResult<PublicSurveyDto>> GetPublicSurveyAsync(
        string linkToken,
        CancellationToken cancellationToken = default);

    /// <summary>Nhận bài làm ẩn danh của sinh viên và tính điểm trung bình.</summary>
    Task<SurveyOperationResult<SubmitSurveyResponseDto>> SubmitSurveyResponseAsync(
        string linkToken,
        SubmitSurveyResponseCommand command,
        CancellationToken cancellationToken = default);

    Task<SurveyOperationResult<bool>> RestoreAnswerScaleAsync(int answerScaleId, CancellationToken cancellationToken = default);
    Task<SurveyOperationResult<bool>> RestoreSurveyTemplateAsync(int surveyTemplateId, CancellationToken cancellationToken = default);
    Task<SurveyOperationResult<bool>> RestoreSemesterSurveyAsync(int semesterSurveyId, CancellationToken cancellationToken = default);
}

public static class SurveyErrorCodes
{
    public const string InvalidRequest = "SURVEY_INVALID_REQUEST";

    public const string AnswerScaleNotFound = "SURVEY_ANSWER_SCALE_NOT_FOUND";
    public const string AnswerScaleNameRequired = "SURVEY_ANSWER_SCALE_NAME_REQUIRED";
    public const string AnswerScaleNameExists = "SURVEY_ANSWER_SCALE_NAME_EXISTS";
    public const string AnswerScaleOptionsInvalid = "SURVEY_ANSWER_SCALE_OPTIONS_INVALID";
    public const string AnswerScaleOptionTextRequired = "SURVEY_ANSWER_SCALE_OPTION_TEXT_REQUIRED";
    public const string AnswerScaleInUse = "SURVEY_ANSWER_SCALE_IN_USE";
    public const string AnswerScaleKindInvalid = "SURVEY_ANSWER_SCALE_KIND_INVALID";

    /// <summary>Thang loại 'Text' không được có mức trả lời nào.</summary>
    public const string AnswerScaleTextHasOptions = "SURVEY_ANSWER_SCALE_TEXT_HAS_OPTIONS";

    /// <summary>Không cho đổi loại thang khi đã có câu hỏi dùng nó.</summary>
    public const string AnswerScaleKindLocked = "SURVEY_ANSWER_SCALE_KIND_LOCKED";

    public const string TemplateNotFound = "SURVEY_TEMPLATE_NOT_FOUND";
    public const string TemplateNameRequired = "SURVEY_TEMPLATE_NAME_REQUIRED";
    public const string TemplateNameExists = "SURVEY_TEMPLATE_NAME_EXISTS";
    public const string TemplateQuestionsRequired = "SURVEY_TEMPLATE_QUESTIONS_REQUIRED";
    public const string TemplateTooManyQuestions = "SURVEY_TEMPLATE_TOO_MANY_QUESTIONS";
    public const string TemplateInUse = "SURVEY_TEMPLATE_IN_USE";

    /// <summary>Câu hỏi trỏ tới một "AnswerScaleId" không tồn tại.</summary>
    public const string QuestionScaleNotFound = "SURVEY_QUESTION_SCALE_NOT_FOUND";

    /// <summary>Đặt câu bẫy trên câu dùng thang tự nhập chữ, không có mức nào để chọn.</summary>
    public const string AttentionCheckOnTextScale = "SURVEY_ATTENTION_CHECK_ON_TEXT_SCALE";

    /// <summary>Mức bắt buộc của câu bẫy không phải là một mức có thật của thang đó.</summary>
    public const string AttentionCheckValueInvalid = "SURVEY_ATTENTION_CHECK_VALUE_INVALID";

    public const string SemesterNotFound = "SURVEY_SEMESTER_NOT_FOUND";
    public const string SemesterHasNoSections = "SURVEY_SEMESTER_HAS_NO_SECTIONS";
    public const string ScheduleInvalid = "SURVEY_SCHEDULE_INVALID";
    public const string SemesterSurveyNotFound = "SURVEY_SEMESTER_SURVEY_NOT_FOUND";
    public const string SemesterSurveyHasResponses = "SURVEY_SEMESTER_SURVEY_HAS_RESPONSES";
    public const string SectionSurveyNotFound = "SURVEY_SECTION_SURVEY_NOT_FOUND";

    /// <summary>Giảng viên không có lớp nào trong đợt nên không dựng được báo cáo cá nhân.</summary>
    public const string LecturerHasNoSections = "SURVEY_LECTURER_HAS_NO_SECTIONS";

    public const string ResponseNotFound = "SURVEY_RESPONSE_NOT_FOUND";

    public const string LinkNotFound = "SURVEY_LINK_NOT_FOUND";
    public const string LinkNotOpen = "SURVEY_LINK_NOT_OPEN";
    public const string AnswersIncomplete = "SURVEY_ANSWERS_INCOMPLETE";
    public const string AnswerValueInvalid = "SURVEY_ANSWER_VALUE_INVALID";

    /// <summary>Câu trả lời tự nhập vượt <see cref="SurveyRules.MaximumTextAnswerLength"/> ký tự.</summary>
    public const string AnswerTextTooLong = "SURVEY_ANSWER_TEXT_TOO_LONG";

    public const string CommentsTooLong = "SURVEY_COMMENTS_TOO_LONG";
}
