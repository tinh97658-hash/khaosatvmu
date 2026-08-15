namespace Domain;

/// <summary>Bảng "AnswerScales". Thang trả lời dùng lại được cho nhiều bộ câu hỏi.</summary>
public sealed class AnswerScale
{
    public int AnswerScaleId { get; set; }

    /// <summary>Vd 'Mức độ hài lòng', 'Mức độ đồng ý'.</summary>
    public string AnswerScaleName { get; set; } = string.Empty;
}

/// <summary>Bảng "AnswerScaleOptions". UNIQUE theo (AnswerScaleId, Value).</summary>
public sealed class AnswerScaleOption
{
    public int AnswerScaleOptionId { get; set; }

    /// <summary>NOT NULL, ON DELETE CASCADE.</summary>
    public int AnswerScaleId { get; set; }

    /// <summary>CHECK 1..5.</summary>
    public int Value { get; set; }

    /// <summary>Nhãn hiển thị của mức, vd 'Rất hài lòng' hoặc '100%'.</summary>
    public string DisplayText { get; set; } = string.Empty;
}

/// <summary>Bảng "SurveyTemplates". Bộ câu hỏi do quản trị soạn, tối đa 30 câu.</summary>
public sealed class SurveyTemplate
{
    public int SurveyTemplateId { get; set; }

    public string TemplateName { get; set; } = string.Empty;

    /// <summary>NOT NULL: cả bộ dùng chung một thang trả lời (ON DELETE RESTRICT).</summary>
    public int AnswerScaleId { get; set; }

    public DateTime CreatedAt { get; set; }
}

/// <summary>Bảng "SurveyQuestions". Một câu hỏi thuộc đúng một bộ câu hỏi.</summary>
public sealed class SurveyQuestion
{
    public int QuestionId { get; set; }

    /// <summary>NOT NULL, ON DELETE CASCADE.</summary>
    public int SurveyTemplateId { get; set; }

    public string QuestionText { get; set; } = string.Empty;
}

/// <summary>
/// Bảng "SemesterSurveys". Một lần phát khảo sát cho cả học kỳ: chọn học kỳ và
/// bộ câu hỏi, mọi lớp học phần của kỳ dùng chung bộ câu hỏi này.
/// </summary>
public sealed class SemesterSurvey
{
    public int SemesterSurveyId { get; set; }

    /// <summary>NOT NULL, ON DELETE CASCADE.</summary>
    public int SemesterId { get; set; }

    /// <summary>NOT NULL, ON DELETE RESTRICT.</summary>
    public int SurveyTemplateId { get; set; }

    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// Bảng "CourseSectionSurveys". Mỗi lớp học phần có một bài khảo sát riêng với
/// LinkToken riêng để dựng link và mã QR. UNIQUE theo (SemesterSurveyId, CourseSectionId).
/// </summary>
public sealed class CourseSectionSurvey
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
}

/// <summary>Bảng "SurveyResponses". Phiếu trả lời ẩn danh của sinh viên.</summary>
public sealed class SurveyResponse
{
    public int ResponseId { get; set; }

    /// <summary>NOT NULL, ON DELETE CASCADE.</summary>
    public int CourseSectionSurveyId { get; set; }

    public string? AdditionalComments { get; set; }

    /// <summary>numeric(4,2): điểm trung bình, backend tính khi nhận phiếu.</summary>
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

    /// <summary>CHECK 1..5.</summary>
    public int SelectedValue { get; set; }
}
