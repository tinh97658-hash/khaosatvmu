namespace Infrastructure.Persistence.Configurations;

using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class SurveyResponseConfiguration : IEntityTypeConfiguration<SurveyResponse>
{
    public void Configure(EntityTypeBuilder<SurveyResponse> builder)
    {
        builder.ToTable("SurveyResponses");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.RespondentId)
            .HasMaxLength(100);

        // Database Indexes for Performance Optimization
        builder.HasIndex(x => x.SurveyFormId);
        builder.HasIndex(x => x.RespondentId);
        builder.HasIndex(x => x.SubmittedAt);

        builder.HasMany(x => x.Answers)
            .WithOne(x => x.SurveyResponse)
            .HasForeignKey(x => x.SurveyResponseId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
