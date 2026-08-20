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
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
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
    /// thuộc thang <see cref="AnswerScaleKinds.Options"/>; câu thang Text không tính.
    /// </summary>
    public decimal Score { get; set; }

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
