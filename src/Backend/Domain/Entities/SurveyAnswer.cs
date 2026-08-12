namespace Domain.Entities;

using Domain.Common;

public class SurveyAnswer : BaseEntity
{
    public Guid SurveyResponseId { get; set; }
    public SurveyResponse SurveyResponse { get; set; } = null!;

    public Guid QuestionId { get; set; }
    public Question Question { get; set; } = null!;

    public Guid? OptionId { get; set; }
    public Option? Option { get; set; }

    public string? TextAnswer { get; set; }
}
