namespace Domain.Entities;

using Domain.Common;

public class Option : BaseEntity
{
    public string Content { get; set; } = string.Empty;
    public int Order { get; set; }

    public Guid QuestionId { get; set; }
    public Question Question { get; set; } = null!;
}
