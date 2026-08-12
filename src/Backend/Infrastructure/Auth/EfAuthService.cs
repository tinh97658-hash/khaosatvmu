using System.Security.Claims;
using System.Text.Json;
using Application.Auth;
using Domain;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Auth;

public sealed class EfAuthService(AppDbContext db) : IAuthService
{
    public async Task<AuthMeResponse> GetCurrentAsync(ClaimsPrincipal? principal)
    {
        var state = await ResolvePrincipalStateAsync(principal);
        return state is null
            ? new AuthMeResponse(false, null, null, [])
            : await BuildResponseAsync(state.Value.User, state.Value.Profile);
    }

    public async Task<SignInResult> DevSignInAsync(string email, string? profileCode)
    {
        var user = await db.Users.SingleOrDefaultAsync(x => x.Email.ToLower() == email.ToLower());
        if (user is null)
        {
            return new SignInResult(false, AuthErrorCodes.UserNotRegistered, null, null);
        }

        if (!user.IsActive)
        {
            return new SignInResult(false, AuthErrorCodes.AccountDisabled, null, null);
        }

        var profiles = await GetProfilesAsync(user.Id);
        if (profiles.Count == 0)
        {
            return new SignInResult(false, AuthErrorCodes.NoProfiles, null, null);
        }

        UserProfile? selected;
        if (string.IsNullOrWhiteSpace(profileCode))
        {
            if (profiles.Count > 1)
            {
                return new SignInResult(false, AuthErrorCodes.ProfileSelectionRequired, null, profiles);
            }

            selected = await db.UserProfiles.SingleAsync(x => x.Id == profiles[0].Id);
        }
        else
        {
            selected = await db.UserProfiles.SingleOrDefaultAsync(x =>
                x.UserId == user.Id && x.ProfileCode.ToLower() == profileCode.ToLower());
            if (selected is null)
            {
                return new SignInResult(false, AuthErrorCodes.ProfileNotFound, null, profiles);
            }
        }

        if (!selected.IsActive)
        {
            return new SignInResult(false, AuthErrorCodes.ProfileDisabled, null, profiles);
        }

        var now = DateTime.UtcNow;
        selected.LastSelectedAt = now;
        user.FirstLoginAt ??= now;
        user.LastLoginAt = now;
        user.UpdatedAt = now;
        AddAudit(user, selected, "LOGIN_SUCCESS");
        await db.SaveChangesAsync();

        return new SignInResult(true, null, await BuildResponseAsync(user, selected), profiles);
    }

    public async Task<ProfileSelectionResult> SelectProfileAsync(ClaimsPrincipal? principal, Guid profileId)
    {
        var userId = GetGuidClaim(principal, ClaimTypes.NameIdentifier);
        if (userId is null)
        {
            return new ProfileSelectionResult(false, AuthErrorCodes.SessionExpired, null);
        }

        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == userId.Value);
        var profile = await db.UserProfiles.SingleOrDefaultAsync(x => x.Id == profileId && x.UserId == userId.Value);
        if (user is null || profile is null)
        {
            return new ProfileSelectionResult(false, AuthErrorCodes.ProfileNotFound, null);
        }

        if (!user.IsActive || !profile.IsActive)
        {
            return new ProfileSelectionResult(false, AuthErrorCodes.ProfileDisabled, null);
        }

        var now = DateTime.UtcNow;
        profile.LastSelectedAt = now;
        user.LastLoginAt = now;
        user.UpdatedAt = now;
        AddAudit(user, profile, "PROFILE_SWITCHED");
        await db.SaveChangesAsync();

        return new ProfileSelectionResult(true, null, await BuildResponseAsync(user, profile));
    }

    public async Task<SignOutResult> SignOutAsync(ClaimsPrincipal? principal)
    {
        var state = await ResolvePrincipalStateAsync(principal);
        if (state is null)
        {
            return new SignOutResult(true);
        }

        AddAudit(state.Value.User, state.Value.Profile, "LOGOUT");
        await db.SaveChangesAsync();
        return new SignOutResult(true);
    }

    public async Task<bool> HasPermissionAsync(ClaimsPrincipal? principal, string permissionCode)
    {
        var state = await ResolvePrincipalStateAsync(principal);
        if (state is null)
        {
            return false;
        }

        return await (
            from rolePermission in db.RolePermissions
            join permission in db.Permissions on rolePermission.PermissionId equals permission.Id
            where rolePermission.RoleId == state.Value.Profile.RoleId
                  && permission.Code == permissionCode
                  && rolePermission.IsGranted
            select rolePermission.Id).AnyAsync();
    }

    private async Task<(User User, UserProfile Profile)?> ResolvePrincipalStateAsync(ClaimsPrincipal? principal)
    {
        var userId = GetGuidClaim(principal, ClaimTypes.NameIdentifier);
        var profileId = GetGuidClaim(principal, "active_profile_id");
        if (userId is null || profileId is null)
        {
            return null;
        }

        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == userId.Value && x.IsActive);
        var profile = await db.UserProfiles.SingleOrDefaultAsync(x =>
            x.Id == profileId.Value && x.UserId == userId.Value && x.IsActive);
        return user is null || profile is null ? null : (user, profile);
    }

    private async Task<AuthMeResponse> BuildResponseAsync(User user, UserProfile activeProfile)
    {
        var profiles = await GetProfilesAsync(user.Id);
        var active = profiles.SingleOrDefault(x => x.Id == activeProfile.Id);
        return new AuthMeResponse(
            true,
            new AuthUserDto(user.Id, user.Email, user.DisplayName, user.AvatarUrl),
            active,
            profiles);
    }

    private Task<List<AuthProfileDto>> GetProfilesAsync(Guid userId) =>
        (from profile in db.UserProfiles
         join role in db.Roles on profile.RoleId equals role.Id
         where profile.UserId == userId && profile.IsActive
         orderby profile.IsDefault descending, profile.ProfileName
         select new AuthProfileDto(
             profile.Id,
             profile.ProfileName,
             profile.ProfileCode,
             role.Code,
             profile.OrganizationUnitCode,
             profile.OrganizationUnitName,
             profile.IsDefault)).ToListAsync();

    private void AddAudit(User user, UserProfile profile, string eventName)
    {
        db.AuthAuditLogs.Add(new AuthAuditLog
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            ProfileId = profile.Id,
            Email = user.Email,
            Event = eventName,
            CreatedAt = DateTime.UtcNow,
            Metadata = JsonSerializer.Serialize(new { profile.ProfileCode, profile.ProfileName })
        });
    }

    private static Guid? GetGuidClaim(ClaimsPrincipal? principal, string claimType) =>
        Guid.TryParse(principal?.FindFirst(claimType)?.Value, out var value) ? value : null;
}
