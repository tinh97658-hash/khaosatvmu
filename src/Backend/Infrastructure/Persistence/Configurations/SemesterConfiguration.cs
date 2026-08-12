namespace Infrastructure.Persistence.Configurations;

using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class SemesterConfiguration : IEntityTypeConfiguration<Semester>
{
    public void Configure(EntityTypeBuilder<Semester> builder)
    {
        builder.ToTable("Semesters");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.SemesterName)
            .HasMaxLength(100)
            .IsRequired();

        builder.HasMany(x => x.SurveyCampaigns)
            .WithOne(x => x.Semester)
            .HasForeignKey(x => x.SemesterId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
