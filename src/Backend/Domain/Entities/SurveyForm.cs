namespace Domain.Entities;

using Domain.Common;

public class SurveyForm : BaseEntity
{
    public string Title { get; set; } = string.Empty;
    public string TargetAudience { get; set; } = string.Empty;

    public Guid SurveyCampaignId { get; set; }
    public SurveyCampaign SurveyCampaign { get; set; } = null!;

    public ICollection<Question> Questions { get; set; } = new List<Question>();
    public ICollection<SurveyResponse> Responses { get; set; } = new List<SurveyResponse>();
}
