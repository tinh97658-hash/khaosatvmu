namespace Application;

public interface ICurrentUserAccessor
{
    Guid? UserId { get; }
    string? UserEmail { get; }
}
