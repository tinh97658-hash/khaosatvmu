namespace Domain.Entities;

using Domain.Common;
using Domain.Enums;

public class Question : BaseEntity
{
    public string Content { get; set; } = string.Empty;
    public QuestionType QuestionType { get; set; } = QuestionType.SingleChoice;
    public int Order { get; set; }

    public Guid SurveyFormId { get; set; }
    public SurveyForm SurveyForm { get; set; } = null!;

    public ICollection<Option> Options { get; set; } = new List<Option>();
}
