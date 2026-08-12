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

    public async Task<AuthAccessResponse?> GetAccessAsync(ClaimsPrincipal? principal)
    {
        var state = await ResolvePrincipalStateAsync(principal);
        if (state is null)
        {
            return null;
        }

        var roleCode = await db.Roles
            .Where(x => x.Id == state.Value.Profile.RoleId)
            .Select(x => x.Code)
            .SingleAsync();
        var permissions = await GetPermissionCodesAsync(state.Value.Profile.RoleId);
        return new AuthAccessResponse(
            state.Value.Profile.Id,
            roleCode,
            state.Value.Profile.OrganizationUnitCode,
            permissions);
    }

    public async Task<GoogleSignInResult> GoogleSignInAsync(GoogleIdentity identity, string allowedDomain)
    {
        if (string.IsNullOrWhiteSpace(identity.Subject) || string.IsNullOrWhiteSpace(identity.Email))
        {
            return new GoogleSignInResult(false, AuthErrorCodes.InvalidGoogleIdentity, null, null, null);
        }

        if (!identity.EmailVerified)
        {
            return new GoogleSignInResult(false, AuthErrorCodes.EmailNotVerified, null, null, null);
        }

        var normalizedDomain = allowedDomain.Trim().TrimStart('@').ToLowerInvariant();
        var normalizedEmail = identity.Email.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalizedDomain)
            || !string.Equals(identity.HostedDomain, normalizedDomain, StringComparison.OrdinalIgnoreCase)
            || !normalizedEmail.EndsWith($"@{normalizedDomain}", StringComparison.Ordinal))
        {
            return new GoogleSignInResult(false, AuthErrorCodes.InvalidDomain, null, null, null);
        }

        var userBySubject = await db.Users.SingleOrDefaultAsync(x => x.GoogleSubject == identity.Subject);
        var userByEmail = await db.Users.SingleOrDefaultAsync(x => x.Email.ToLower() == normalizedEmail);
        if (userBySubject is not null && userBySubject.Id != userByEmail?.Id)
        {
            return new GoogleSignInResult(false, AuthErrorCodes.AccountLinkConflict, null, null, null);
        }

        var user = userBySubject ?? userByEmail;
        if (user is null)
        {
            return new GoogleSignInResult(false, AuthErrorCodes.UserNotRegistered, null, null, null);
        }

        if (!string.IsNullOrWhiteSpace(user.GoogleSubject)
            && !string.Equals(user.GoogleSubject, identity.Subject, StringComparison.Ordinal))
        {
            return new GoogleSignInResult(false, AuthErrorCodes.AccountLinkConflict, null, null, null);
        }

        if (!user.IsActive)
        {
            return new GoogleSignInResult(false, AuthErrorCodes.AccountDisabled, null, null, null);
        }

        user.GoogleSubject ??= identity.Subject;
        user.DisplayName = identity.DisplayName ?? user.DisplayName;
        user.AvatarUrl = identity.AvatarUrl ?? user.AvatarUrl;
        user.UpdatedAt = DateTime.UtcNow;

        var profiles = await GetProfilesAsync(user.Id);
        if (profiles.Count == 0)
        {
            AddAudit(user, null, "GOOGLE_LOGIN_NO_PROFILE");
            await db.SaveChangesAsync();
            return new GoogleSignInResult(false, AuthErrorCodes.NoProfiles, null, null, null);
        }

        if (profiles.Count > 1)
        {
            AddAudit(user, null, "GOOGLE_LOGIN_PROFILE_REQUIRED");
            await db.SaveChangesAsync();
            return new GoogleSignInResult(false, AuthErrorCodes.ProfileSelectionRequired, user.Id, null, profiles);
        }

        var profile = await db.UserProfiles.SingleAsync(x => x.Id == profiles[0].Id);
        var response = await CompleteSignInAsync(user, profile, "LOGIN_SUCCESS");
        return new GoogleSignInResult(true, null, null, response, profiles);
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

        return await SelectProfileForUserAsync(userId.Value, profileId, "PROFILE_SWITCHED");
    }

    public Task<IReadOnlyList<AuthProfileDto>> GetAvailableProfilesAsync(Guid userId) =>
        GetProfilesAsReadOnlyAsync(userId);

    public Task<ProfileSelectionResult> SelectInitialProfileAsync(Guid userId, Guid profileId) =>
        SelectProfileForUserAsync(userId, profileId, "LOGIN_SUCCESS");

    private async Task<ProfileSelectionResult> SelectProfileForUserAsync(Guid userId, Guid profileId, string eventName)
    {
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == userId);
        var profile = await db.UserProfiles.SingleOrDefaultAsync(x => x.Id == profileId && x.UserId == userId);
        if (user is null || profile is null)
        {
            return new ProfileSelectionResult(false, AuthErrorCodes.ProfileNotFound, null);
        }

        if (!user.IsActive || !profile.IsActive)
        {
            return new ProfileSelectionResult(false, AuthErrorCodes.ProfileDisabled, null);
        }

        return new ProfileSelectionResult(true, null, await CompleteSignInAsync(user, profile, eventName));
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

    public async Task<bool> HasPermissionAsync(
        ClaimsPrincipal? principal,
        string permissionCode,
        string? resourceOrganizationUnitCode = null)
    {
        var state = await ResolvePrincipalStateAsync(principal);
        if (state is null)
        {
            return false;
        }

        var hasPermission = await (
            from rolePermission in db.RolePermissions
            join permission in db.Permissions on rolePermission.PermissionId equals permission.Id
            where rolePermission.RoleId == state.Value.Profile.RoleId
                  && permission.Code == permissionCode
                  && rolePermission.IsGranted
            select rolePermission.Id).AnyAsync();

        if (!hasPermission || string.IsNullOrWhiteSpace(resourceOrganizationUnitCode))
        {
            return hasPermission;
        }

        return string.IsNullOrWhiteSpace(state.Value.Profile.OrganizationUnitCode)
            || string.Equals(
                state.Value.Profile.OrganizationUnitCode,
                resourceOrganizationUnitCode,
                StringComparison.OrdinalIgnoreCase);
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

    private async Task<AuthMeResponse> CompleteSignInAsync(User user, UserProfile profile, string eventName)
    {
        var now = DateTime.UtcNow;
        profile.LastSelectedAt = now;
        user.FirstLoginAt ??= now;
        user.LastLoginAt = now;
        user.UpdatedAt = now;
        AddAudit(user, profile, eventName);
        await db.SaveChangesAsync();
        return await BuildResponseAsync(user, profile);
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

    private Task<List<string>> GetPermissionCodesAsync(Guid roleId) =>
        (from rolePermission in db.RolePermissions
         join permission in db.Permissions on rolePermission.PermissionId equals permission.Id
         where rolePermission.RoleId == roleId && rolePermission.IsGranted
         orderby permission.Code
         select permission.Code).ToListAsync();

    private async Task<IReadOnlyList<AuthProfileDto>> GetProfilesAsReadOnlyAsync(Guid userId) =>
        await GetProfilesAsync(userId);

    private void AddAudit(User user, UserProfile? profile, string eventName)
    {
        db.AuthAuditLogs.Add(new AuthAuditLog
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            ProfileId = profile?.Id,
            Email = user.Email,
            Event = eventName,
            CreatedAt = DateTime.UtcNow,
            Metadata = profile is null
                ? null
                : JsonSerializer.Serialize(new { profile.ProfileCode, profile.ProfileName })
        });
    }

    private static Guid? GetGuidClaim(ClaimsPrincipal? principal, string claimType) =>
        Guid.TryParse(principal?.FindFirst(claimType)?.Value, out var value) ? value : null;
}
