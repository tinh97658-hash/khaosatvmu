namespace Infrastructure.Persistence.Configurations;

using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class QuestionConfiguration : IEntityTypeConfiguration<Question>
{
    public void Configure(EntityTypeBuilder<Question> builder)
    {
        builder.ToTable("Questions");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Content)
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(x => x.QuestionType)
            .HasConversion<int>()
            .IsRequired();

        builder.HasMany(x => x.Options)
            .WithOne(x => x.Question)
            .HasForeignKey(x => x.QuestionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
