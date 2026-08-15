using Application.Auth;
using Domain;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Auth;

public sealed class EfAuthSessionService(AppDbContext db) : IAuthSessionService
{
    private static readonly TimeSpan SessionLifetime = TimeSpan.FromHours(8);

    public async Task<AuthSessionTicket> CreateAsync(Guid userId, Guid activeProfileId)
    {
        var now = DateTime.UtcNow;
        var session = new AuthSession
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ActiveProfileId = activeProfileId,
            CreatedAt = now,
            ExpiresAt = now.Add(SessionLifetime)
        };
        db.AuthSessions.Add(session);
        await db.SaveChangesAsync();
        return new AuthSessionTicket(session.Id, session.ExpiresAt);
    }

    public async Task<AuthSessionTicket?> SwitchProfileAsync(
        Guid sessionId,
        Guid userId,
        Guid activeProfileId)
    {
        var now = DateTime.UtcNow;
        var session = await db.AuthSessions.SingleOrDefaultAsync(x =>
            x.Id == sessionId
            && x.UserId == userId
            && x.RevokedAt == null
            && x.ExpiresAt > now);
        if (session is null)
        {
            return null;
        }

        var profileIsValid = await db.UserProfiles.AnyAsync(x =>
            x.Id == activeProfileId && x.UserId == userId && x.IsActive);
        if (!profileIsValid)
        {
            return null;
        }

        session.ActiveProfileId = activeProfileId;
        await db.SaveChangesAsync();
        return new AuthSessionTicket(session.Id, session.ExpiresAt);
    }

    public Task<bool> ValidateAsync(Guid sessionId, Guid userId, Guid activeProfileId)
    {
        var now = DateTime.UtcNow;
        return (
            from session in db.AuthSessions
            join user in db.Users on session.UserId equals user.Id
            join profile in db.UserProfiles on session.ActiveProfileId equals profile.Id
            where session.Id == sessionId
                  && session.UserId == userId
                  && session.ActiveProfileId == activeProfileId
                  && session.RevokedAt == null
                  && session.ExpiresAt > now
                  && user.IsActive
                  && profile.IsActive
                  && profile.UserId == userId
            select session.Id).AnyAsync();
    }

    public async Task RevokeAsync(Guid sessionId, Guid userId, string reason)
    {
        var session = await db.AuthSessions.SingleOrDefaultAsync(x =>
            x.Id == sessionId && x.UserId == userId && x.RevokedAt == null);
        if (session is null)
        {
            return;
        }

        session.RevokedAt = DateTime.UtcNow;
        session.RevokedReason = reason;
        await db.SaveChangesAsync();
    }

    public Task<int> RevokeAllAsync(Guid userId, string reason) =>
        db.AuthSessions
            .Where(x => x.UserId == userId && x.RevokedAt == null)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.RevokedAt, DateTime.UtcNow)
                .SetProperty(x => x.RevokedReason, reason));
}
