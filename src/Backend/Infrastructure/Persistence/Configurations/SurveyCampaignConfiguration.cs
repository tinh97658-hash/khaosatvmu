namespace Infrastructure.Persistence.Configurations;

using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class SurveyCampaignConfiguration : IEntityTypeConfiguration<SurveyCampaign>
{
    public void Configure(EntityTypeBuilder<SurveyCampaign> builder)
    {
        builder.ToTable("SurveyCampaigns");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Title)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(x => x.Description)
            .HasMaxLength(1000);

        builder.Property(x => x.Status)
            .HasConversion<int>()
            .IsRequired();

        builder.HasMany(x => x.SurveyForms)
            .WithOne(x => x.SurveyCampaign)
            .HasForeignKey(x => x.SurveyCampaignId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
