namespace Application.Common.Interfaces;

using Domain.Entities;
using Microsoft.EntityFrameworkCore;

public interface IApplicationDbContext
{
    DbSet<AcademicYear> AcademicYears { get; }
    DbSet<Semester> Semesters { get; }
    DbSet<SurveyCampaign> SurveyCampaigns { get; }
    DbSet<SurveyForm> SurveyForms { get; }
    DbSet<Question> Questions { get; }
    DbSet<Option> Options { get; }
    DbSet<SurveyResponse> SurveyResponses { get; }
    DbSet<SurveyAnswer> SurveyAnswers { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
