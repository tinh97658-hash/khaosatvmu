namespace Domain.Entities;

using Domain.Common;
using Domain.Enums;

public class SurveyCampaign : BaseEntity
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public CampaignStatus Status { get; set; } = CampaignStatus.Draft;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }

    public Guid SemesterId { get; set; }
    public Semester Semester { get; set; } = null!;

    public ICollection<SurveyForm> SurveyForms { get; set; } = new List<SurveyForm>();
}
