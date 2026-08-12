namespace Infrastructure.Persistence.Configurations;

using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class AcademicYearConfiguration : IEntityTypeConfiguration<AcademicYear>
{
    public void Configure(EntityTypeBuilder<AcademicYear> builder)
    {
        builder.ToTable("AcademicYears");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.YearName)
            .HasMaxLength(50)
            .IsRequired();

        builder.HasMany(x => x.Semesters)
            .WithOne(x => x.AcademicYear)
            .HasForeignKey(x => x.AcademicYearId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
