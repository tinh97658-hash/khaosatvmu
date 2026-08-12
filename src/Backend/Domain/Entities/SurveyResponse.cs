namespace Domain.Entities;

using Domain.Common;

public class SurveyResponse : BaseEntity
{
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
    public string? RespondentId { get; set; }

    public Guid SurveyFormId { get; set; }
    public SurveyForm SurveyForm { get; set; } = null!;

    public ICollection<SurveyAnswer> Answers { get; set; } = new List<SurveyAnswer>();
}
