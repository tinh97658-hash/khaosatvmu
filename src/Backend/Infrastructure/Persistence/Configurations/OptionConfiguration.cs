namespace Infrastructure.Persistence.Configurations;

using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class OptionConfiguration : IEntityTypeConfiguration<Option>
{
    public void Configure(EntityTypeBuilder<Option> builder)
    {
        builder.ToTable("Options");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Content)
            .HasMaxLength(300)
            .IsRequired();
    }
}
