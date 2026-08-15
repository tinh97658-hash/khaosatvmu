namespace Infrastructure.Persistence.Configurations;

using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class SurveyFormConfiguration : IEntityTypeConfiguration<SurveyForm>
{
    public void Configure(EntityTypeBuilder<SurveyForm> builder)
    {
        builder.ToTable("SurveyForms");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Title)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(x => x.TargetAudience)
            .HasMaxLength(100)
            .IsRequired();

        // Database Indexes for Performance Optimization
        builder.HasIndex(x => x.SurveyCampaignId);
        builder.HasIndex(x => x.TargetAudience);

        builder.HasMany(x => x.Questions)
            .WithOne(x => x.SurveyForm)
            .HasForeignKey(x => x.SurveyFormId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(x => x.Responses)
            .WithOne(x => x.SurveyForm)
            .HasForeignKey(x => x.SurveyFormId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
