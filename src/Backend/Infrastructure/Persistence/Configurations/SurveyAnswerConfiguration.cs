namespace Infrastructure.Persistence.Configurations;

using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class SurveyAnswerConfiguration : IEntityTypeConfiguration<SurveyAnswer>
{
    public void Configure(EntityTypeBuilder<SurveyAnswer> builder)
    {
        builder.ToTable("SurveyAnswers");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.TextAnswer)
            .HasMaxLength(2000);

        builder.HasOne(x => x.Question)
            .WithMany()
            .HasForeignKey(x => x.QuestionId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.Option)
            .WithMany()
            .HasForeignKey(x => x.OptionId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
