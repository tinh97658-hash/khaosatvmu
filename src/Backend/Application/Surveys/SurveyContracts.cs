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

public sealed record SurveyQuestionDto(
    int QuestionId,
    int SurveyTemplateId,
    string QuestionText,
    int AnswerScaleId);

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

/// <summary>Một câu hỏi kèm thang trả lời của riêng nó.</summary>
public sealed record SaveSurveyQuestionCommand(string QuestionText, int AnswerScaleId);

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

public sealed record SubmitSurveyResponseCommand(
    IReadOnlyList<SubmitSurveyAnswerCommand> Answers,
    string? AdditionalComments);

public sealed record SubmitSurveyResponseDto(int ResponseId, decimal Score, DateTime SubmittedAt);

/// <summary>Số câu đã chọn ở một mức trả lời trong cùng một phiếu (chỉ câu thang 'Options').</summary>
public sealed record SurveyResponseValueCountDto(int Value, string DisplayText, int Count);

/// <summary>Một phiếu trả lời trong danh sách của bài khảo sát một lớp học phần.</summary>
public sealed record SurveyResponseSummaryDto(
    int ResponseId,
    int CourseSectionSurveyId,
    DateTime SubmittedAt,
    decimal Score,
    string? AdditionalComments,
    int AnswerCount,
    IReadOnlyList<SurveyResponseValueCountDto> ValueCounts);

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

    public const string SemesterNotFound = "SURVEY_SEMESTER_NOT_FOUND";
    public const string SemesterHasNoSections = "SURVEY_SEMESTER_HAS_NO_SECTIONS";
    public const string ScheduleInvalid = "SURVEY_SCHEDULE_INVALID";
    public const string SemesterSurveyNotFound = "SURVEY_SEMESTER_SURVEY_NOT_FOUND";
    public const string SemesterSurveyHasResponses = "SURVEY_SEMESTER_SURVEY_HAS_RESPONSES";
    public const string SectionSurveyNotFound = "SURVEY_SECTION_SURVEY_NOT_FOUND";
    public const string ResponseNotFound = "SURVEY_RESPONSE_NOT_FOUND";

    public const string LinkNotFound = "SURVEY_LINK_NOT_FOUND";
    public const string LinkNotOpen = "SURVEY_LINK_NOT_OPEN";
    public const string AnswersIncomplete = "SURVEY_ANSWERS_INCOMPLETE";
    public const string AnswerValueInvalid = "SURVEY_ANSWER_VALUE_INVALID";

    /// <summary>Câu trả lời tự nhập vượt <see cref="SurveyRules.MaximumTextAnswerLength"/> ký tự.</summary>
    public const string AnswerTextTooLong = "SURVEY_ANSWER_TEXT_TOO_LONG";

    public const string CommentsTooLong = "SURVEY_COMMENTS_TOO_LONG";
}
