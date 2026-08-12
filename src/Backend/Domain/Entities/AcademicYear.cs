namespace Domain.Entities;

using Domain.Common;

public class AcademicYear : BaseEntity
{
    public string YearName { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<Semester> Semesters { get; set; } = new List<Semester>();
}
