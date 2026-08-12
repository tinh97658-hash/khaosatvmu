namespace Infrastructure.Persistence;

using System.Reflection;
using Application.Common.Interfaces;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

public class ApplicationDbContext : DbContext, IApplicationDbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<AcademicYear> AcademicYears => Set<AcademicYear>();
    public DbSet<Semester> Semesters => Set<Semester>();
    public DbSet<SurveyCampaign> SurveyCampaigns => Set<SurveyCampaign>();
    public DbSet<SurveyForm> SurveyForms => Set<SurveyForm>();
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<Option> Options => Set<Option>();
    public DbSet<SurveyResponse> SurveyResponses => Set<SurveyResponse>();
    public DbSet<SurveyAnswer> SurveyAnswers => Set<SurveyAnswer>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());
    }
}
