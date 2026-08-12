namespace Domain.Entities;

using Domain.Common;

public class Semester : BaseEntity
{
    public string SemesterName { get; set; } = string.Empty;
    public Guid AcademicYearId { get; set; }
    public AcademicYear AcademicYear { get; set; } = null!;

    public ICollection<SurveyCampaign> SurveyCampaigns { get; set; } = new List<SurveyCampaign>();
}
