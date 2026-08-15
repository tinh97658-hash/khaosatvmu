namespace Application.Auth;

public sealed record AuthSessionTicket(Guid Id, DateTime ExpiresAt);

public interface IAuthSessionService
{
    Task<AuthSessionTicket> CreateAsync(Guid userId, Guid activeProfileId);
    Task<AuthSessionTicket?> SwitchProfileAsync(Guid sessionId, Guid userId, Guid activeProfileId);
    Task<bool> ValidateAsync(Guid sessionId, Guid userId, Guid activeProfileId);
    Task RevokeAsync(Guid sessionId, Guid userId, string reason);
    Task<int> RevokeAllAsync(Guid userId, string reason);
}
