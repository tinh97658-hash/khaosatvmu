namespace Domain;

/// <summary>Các giá trị hợp lệ của "AnswerScales"."ScaleKind".</summary>
public static class AnswerScaleKinds
{
    /// <summary>Thang có sẵn các mức chọn trong "AnswerScaleOptions" (Mức độ hài lòng, Có/Không, Phần trăm...).</summary>
    public const string Options = "Options";

    /// <summary>Thang để người trả lời tự nhập chữ, không có mức chọn nào.</summary>
    public const string Text = "Text";

    public static bool IsValid(string? value) => value is Options or Text;
}

/// <summary>Bảng "AnswerScales". Thang trả lời dùng lại được cho nhiều bộ câu hỏi.</summary>
public sealed class AnswerScale : ISoftDeletable
{
    public int AnswerScaleId { get; set; }

    /// <summary>Vd 'Mức độ hài lòng', 'Mức độ đồng ý'.</summary>
    public string AnswerScaleName { get; set; } = string.Empty;

    /// <summary>
    /// <see cref="AnswerScaleKinds.Options"/> hoặc <see cref="AnswerScaleKinds.Text"/>.
    /// Thang loại Text không có dòng nào trong "AnswerScaleOptions" và câu trả lời
    /// của nó không được tính vào <see cref="SurveyResponse.Score"/>.
    /// </summary>
    public string ScaleKind { get; set; } = AnswerScaleKinds.Options;

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
}

/// <summary>Bảng "AnswerScaleOptions". UNIQUE theo (AnswerScaleId, Value).</summary>
public sealed class AnswerScaleOption
{
    public int AnswerScaleOptionId { get; set; }

    /// <summary>NOT NULL, ON DELETE CASCADE.</summary>
    public int AnswerScaleId { get; set; }

    /// <summary>
    /// CHECK 1..5. Không bắt buộc liên tiếp: thang 'Có/Không' dùng 1 và 5 để
    /// điểm của nó cùng dải với thang mức độ hài lòng.
    /// </summary>
    public int Value { get; set; }

    /// <summary>Nhãn hiển thị của mức, vd 'Rất hài lòng' hoặc '100%'.</summary>
    public string DisplayText { get; set; } = string.Empty;
}

/// <summary>Bảng "SurveyTemplates". Bộ câu hỏi do quản trị soạn, tối đa 30 câu.</summary>
public sealed class SurveyTemplate : ISoftDeletable
{
    public int SurveyTemplateId { get; set; }

    public string TemplateName { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
}

/// <summary>Bảng "SurveyQuestions". Một câu hỏi thuộc đúng một bộ câu hỏi.</summary>
public sealed class SurveyQuestion
{
    public int QuestionId { get; set; }

    /// <summary>NOT NULL, ON DELETE CASCADE.</summary>
    public int SurveyTemplateId { get; set; }

    public string QuestionText { get; set; } = string.Empty;

    /// <summary>
    /// NOT NULL, ON DELETE RESTRICT. Thang trả lời của riêng câu này nên một bộ
    /// câu hỏi trộn được nhiều loại thang khác nhau.
    /// </summary>
    public int AnswerScaleId { get; set; }

    /// <summary>
    /// Câu bẫy kiểm tra độ tập trung. NULL là câu hỏi bình thường; có giá trị thì
    /// người trả lời phải chọn đúng mức đó, sai một câu là phiếu bị lọc.
    /// Chỉ đặt được trên câu thuộc thang <see cref="AnswerScaleKinds.Options"/> và
    /// giá trị phải là một mức có thật của chính thang đó.
    /// Câu bẫy không được tính vào <see cref="SurveyResponse.Score"/>.
    /// </summary>
    public int? AttentionCheckValue { get; set; }
}

/// <summary>
/// Bảng "SemesterSurveys". Một lần phát khảo sát cho cả học kỳ: chọn học kỳ và
/// bộ câu hỏi, mọi lớp học phần của kỳ dùng chung bộ câu hỏi này.
/// </summary>
public sealed class SemesterSurvey : ISoftDeletable
{
    public int SemesterSurveyId { get; set; }

    /// <summary>NOT NULL, ON DELETE CASCADE.</summary>
    public int SemesterId { get; set; }

    /// <summary>NOT NULL, ON DELETE RESTRICT.</summary>
    public int SurveyTemplateId { get; set; }

    public DateTime CreatedAt { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
}

/// <summary>
/// Bảng "CourseSectionSurveys". Mỗi lớp học phần có một bài khảo sát riêng với
/// LinkToken riêng để dựng link và mã QR. UNIQUE theo (SemesterSurveyId, CourseSectionId).
/// </summary>
public sealed class CourseSectionSurvey : ISoftDeletable
{
    public int CourseSectionSurveyId { get; set; }

    /// <summary>NOT NULL, ON DELETE CASCADE.</summary>
    public int SemesterSurveyId { get; set; }

    /// <summary>NOT NULL, ON DELETE CASCADE.</summary>
    public int CourseSectionId { get; set; }

    /// <summary>UNIQUE. Chuỗi ngẫu nhiên dùng trong link và mã QR của lớp.</summary>
    public string LinkToken { get; set; } = string.Empty;

    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// Điểm trung bình của lớp, chỉ gộp phiếu qua bộ lọc nhiễu. NULL nghĩa là
    /// chưa bấm tính lần nào. Đây là ảnh chụp của lần bấm nút gần nhất chứ không
    /// tự cập nhật khi có phiếu mới về, nên chỗ nào hiện số này phải hiện kèm
    /// <see cref="ScoreCalculatedAt"/>.
    /// </summary>
    public decimal? AverageScore { get; set; }

    /// <summary>Tổng lượt nộp, tính cả phiếu bị lọc. Số liệu tiến độ thu phiếu.</summary>
    public int TotalResponseCount { get; set; }

    /// <summary>Số phiếu qua lọc, chính là mẫu số của <see cref="AverageScore"/>.</summary>
    public int ValidResponseCount { get; set; }

    /// <summary>
    /// Số phiếu bị lọc nhiễu. Suy ra được bằng tổng trừ hợp lệ, nhưng lưu sẵn để
    /// màn danh sách lớp hiển thị thẳng, và lệch nhau thì biết dữ liệu có vấn đề.
    /// </summary>
    public int InvalidResponseCount { get; set; }

    /// <summary>Lần bấm tính điểm gần nhất. NULL là chưa tính lần nào.</summary>
    public DateTime? ScoreCalculatedAt { get; set; }

    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
}

/// <summary>
/// Bảng "CourseSectionSurveyQuestionScores". Điểm từng câu của từng lớp — chính
/// là các cột C1, C2… của bảng dữ liệu khảo sát. Cũng là ảnh chụp của lần bấm
/// tính gần nhất, cùng thời điểm với <see cref="CourseSectionSurvey.AverageScore"/>.
///
/// Có bảng riêng vì nếu gộp thẳng từ phiếu mỗi lần mở trang thì phải quét toàn bộ
/// "SurveyResponseAnswers" của cả đợt: một kỳ hơn 2000 lớp là vài triệu dòng cho
/// mỗi lượt xem. Gộp sẵn một lần khi chốt đợt thì trang chỉ còn đọc đúng số dòng
/// mà nó hiển thị.
/// </summary>
public sealed class CourseSectionSurveyQuestionScore
{
    /// <summary>NOT NULL, ON DELETE CASCADE. Khoá chính ghép với <see cref="QuestionId"/>.</summary>
    public int CourseSectionSurveyId { get; set; }

    /// <summary>NOT NULL, ON DELETE CASCADE.</summary>
    public int QuestionId { get; set; }

    /// <summary>numeric(4,2): trung bình câu này trên các phiếu hợp lệ có trả lời.</summary>
    public decimal AverageScore { get; set; }

    /// <summary>
    /// Số phiếu hợp lệ đã trả lời câu này, chính là mẫu số của <see cref="AverageScore"/>.
    /// Không có dòng nào cho câu mà cả lớp chưa ai trả lời, nên giá trị này luôn > 0.
    /// </summary>
    public int AnswerCount { get; set; }
}

/// <summary>Bảng "SurveyResponses". Phiếu trả lời ẩn danh của sinh viên.</summary>
public sealed class SurveyResponse
{
    public int ResponseId { get; set; }

    /// <summary>NOT NULL, ON DELETE CASCADE.</summary>
    public int CourseSectionSurveyId { get; set; }

    public string? AdditionalComments { get; set; }

    /// <summary>
    /// numeric(4,2): điểm trung bình, backend tính khi nhận phiếu. Chỉ gộp các câu
    /// thuộc thang <see cref="AnswerScaleKinds.Options"/> và không phải câu bẫy;
    /// câu thang Text và câu bẫy không tính.
    /// </summary>
    public decimal Score { get; set; }

    /// <summary>
    /// Phiếu có qua bộ lọc nhiễu không. Phiếu bị lọc vẫn tính là một lượt nộp
    /// nhưng không tham gia vào điểm trung bình của lớp.
    /// Kết quả là ảnh chụp tại thời điểm nộp, không tính lại về sau.
    /// </summary>
    public bool IsValid { get; set; } = true;

    /// <summary>
    /// Các lý do bị lọc, ngăn cách bằng dấu phẩy, vd 'TOO_FAST,SINGLE_ANSWER'.
    /// NULL khi phiếu hợp lệ.
    /// </summary>
    public string? RejectionReasons { get; set; }

    public DateTime SubmittedAt { get; set; }
}

/// <summary>Bảng "SurveyResponseAnswers". Khóa chính ghép (ResponseId, QuestionId).</summary>
public sealed class SurveyResponseAnswer
{
    /// <summary>NOT NULL, ON DELETE CASCADE.</summary>
    public int ResponseId { get; set; }

    /// <summary>NOT NULL, ON DELETE RESTRICT.</summary>
    public int QuestionId { get; set; }

    /// <summary>
    /// Câu trả lời thô luôn lưu dạng chữ. Câu thuộc thang
    /// <see cref="AnswerScaleKinds.Options"/> lưu số mức đã chọn ("1".."5"), câu
    /// thuộc thang <see cref="AnswerScaleKinds.Text"/> lưu nguyên nội dung người
    /// học gõ. Muốn đọc lại thì tra "ScaleKind" của thang gắn với câu hỏi.
    /// </summary>
    public string AnswerValue { get; set; } = string.Empty;

    public SurveyResponse? SurveyResponse { get; set; }
}
