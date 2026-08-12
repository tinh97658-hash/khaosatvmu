using System.Text.Json;
using System.Net.Mail;
using Application.UserAdministration;
using Domain;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.UserAdministration;

public sealed class EfUserAdministrationService(AppDbContext db) : IUserAdministrationService
{
    private const int MaximumPageSize = 100;

    public async Task<AdminPage<AdminUserDto>> GetUsersAsync(
        string? search,
        bool? isActive,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        (page, pageSize) = NormalizePaging(page, pageSize);
        var query = db.Users.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x =>
                x.Email.ToLower().Contains(term)
                || (x.DisplayName != null && x.DisplayName.ToLower().Contains(term)));
        }

        if (isActive is not null)
        {
            query = query.Where(x => x.IsActive == isActive.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var users = await query
            .OrderByDescending(x => x.IsActive)
            .ThenBy(x => x.DisplayName)
            .ThenBy(x => x.Email)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        var items = await BuildUsersAsync(users, cancellationToken);
        return new AdminPage<AdminUserDto>(items, page, pageSize, totalCount);
    }

    public async Task<AdminOperationResult<AdminUserDto>> CreateUserAsync(
        CreateAdminUserCommand command,
        Guid actorUserId,
        CancellationToken cancellationToken = default)
    {
        var email = command.Email.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email)
            || email.Length > 320
            || !MailAddress.TryCreate(email, out var parsedEmail)
            || !string.Equals(parsedEmail.Address, email, StringComparison.OrdinalIgnoreCase)
            || !IsValidDisplayName(command.DisplayName))
        {
            return Failure<AdminUserDto>(UserAdministrationErrorCodes.InvalidRequest);
        }

        if (await db.Users.AnyAsync(x => x.Email.ToLower() == email, cancellationToken))
        {
            return Failure<AdminUserDto>(UserAdministrationErrorCodes.UserEmailExists);
        }

        var now = DateTime.UtcNow;
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            DisplayName = NormalizeOptional(command.DisplayName),
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        db.Users.Add(user);
        AddAudit(user, null, "ADMIN_USER_CREATED", actorUserId, new { user.Email });
        await db.SaveChangesAsync(cancellationToken);
        return Success(await BuildUserAsync(user, cancellationToken));
    }

    public async Task<AdminOperationResult<AdminUserDto>> SetUserStatusAsync(
        Guid userId,
        bool isActive,
        Guid actorUserId,
        CancellationToken cancellationToken = default)
    {
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (user is null)
        {
            return Failure<AdminUserDto>(UserAdministrationErrorCodes.UserNotFound);
        }

        if (!isActive && userId == actorUserId)
        {
            return Failure<AdminUserDto>(UserAdministrationErrorCodes.CannotDisableSelf);
        }

        if (user.IsActive != isActive)
        {
            user.IsActive = isActive;
            user.UpdatedAt = DateTime.UtcNow;
            AddAudit(
                user,
                null,
                isActive ? "ADMIN_USER_ENABLED" : "ADMIN_USER_DISABLED",
                actorUserId,
                new { user.IsActive });
            if (!isActive)
            {
                await RevokeUserSessionsAsync(user.Id, "USER_DISABLED", cancellationToken);
            }

            await db.SaveChangesAsync(cancellationToken);
        }

        return Success(await BuildUserAsync(user, cancellationToken));
    }

    public async Task<AdminOperationResult<AdminProfileDto>> CreateProfileAsync(
        Guid userId,
        SaveAdminProfileCommand command,
        Guid actorUserId,
        CancellationToken cancellationToken = default)
    {
        var validationError = await ValidateProfileCommandAsync(userId, null, command, cancellationToken);
        if (validationError is not null)
        {
            return Failure<AdminProfileDto>(validationError);
        }

        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (user is null)
        {
            return Failure<AdminProfileDto>(UserAdministrationErrorCodes.UserNotFound);
        }

        var now = DateTime.UtcNow;
        var hasActiveProfile = await db.UserProfiles.AnyAsync(
            x => x.UserId == userId && x.IsActive,
            cancellationToken);
        var isDefault = command.IsDefault || !hasActiveProfile;
        if (isDefault)
        {
            await ClearDefaultProfileAsync(userId, null, cancellationToken);
        }

        var profile = new UserProfile
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            RoleId = command.RoleId,
            ProfileName = command.Name.Trim(),
            ProfileCode = NormalizeCode(command.Code),
            OrganizationUnitCode = NormalizeCodeOptional(command.OrganizationUnitCode),
            OrganizationUnitName = NormalizeOptional(command.OrganizationUnitName),
            IsActive = true,
            IsDefault = isDefault,
            CreatedAt = now,
            UpdatedAt = now
        };
        db.UserProfiles.Add(profile);
        user.UpdatedAt = now;
        AddAudit(user, profile, "ADMIN_PROFILE_CREATED", actorUserId, ProfileMetadata(profile));
        await db.SaveChangesAsync(cancellationToken);
        return Success(await BuildProfileAsync(profile, cancellationToken));
    }

    public async Task<AdminOperationResult<AdminProfileDto>> UpdateProfileAsync(
        Guid userId,
        Guid profileId,
        SaveAdminProfileCommand command,
        Guid actorUserId,
        Guid actorProfileId,
        CancellationToken cancellationToken = default)
    {
        var profile = await db.UserProfiles.SingleOrDefaultAsync(
            x => x.Id == profileId && x.UserId == userId,
            cancellationToken);
        if (profile is null)
        {
            return Failure<AdminProfileDto>(UserAdministrationErrorCodes.ProfileNotFound);
        }

        if (profileId == actorProfileId && profile.RoleId != command.RoleId)
        {
            return Failure<AdminProfileDto>(UserAdministrationErrorCodes.CannotModifyActiveProfile);
        }

        var validationError = await ValidateProfileCommandAsync(userId, profileId, command, cancellationToken);
        if (validationError is not null)
        {
            return Failure<AdminProfileDto>(validationError);
        }

        if (command.IsDefault && profile.IsActive)
        {
            await ClearDefaultProfileAsync(userId, profileId, cancellationToken);
        }

        var roleChanged = profile.RoleId != command.RoleId;
        profile.ProfileName = command.Name.Trim();
        profile.ProfileCode = NormalizeCode(command.Code);
        profile.RoleId = command.RoleId;
        profile.OrganizationUnitCode = NormalizeCodeOptional(command.OrganizationUnitCode);
        profile.OrganizationUnitName = NormalizeOptional(command.OrganizationUnitName);
        profile.IsDefault = command.IsDefault && profile.IsActive;
        profile.UpdatedAt = DateTime.UtcNow;
        var user = await db.Users.SingleAsync(x => x.Id == userId, cancellationToken);
        user.UpdatedAt = profile.UpdatedAt;
        AddAudit(user, profile, "ADMIN_PROFILE_UPDATED", actorUserId, ProfileMetadata(profile));
        if (roleChanged)
        {
            await RevokeProfileSessionsAsync(profile.Id, "PROFILE_ROLE_CHANGED", cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
        return Success(await BuildProfileAsync(profile, cancellationToken));
    }

    public async Task<AdminOperationResult<AdminProfileDto>> SetProfileStatusAsync(
        Guid userId,
        Guid profileId,
        bool isActive,
        Guid actorUserId,
        Guid actorProfileId,
        CancellationToken cancellationToken = default)
    {
        var profile = await db.UserProfiles.SingleOrDefaultAsync(
            x => x.Id == profileId && x.UserId == userId,
            cancellationToken);
        if (profile is null)
        {
            return Failure<AdminProfileDto>(UserAdministrationErrorCodes.ProfileNotFound);
        }

        if (!isActive && profileId == actorProfileId)
        {
            return Failure<AdminProfileDto>(UserAdministrationErrorCodes.CannotModifyActiveProfile);
        }

        if (profile.IsActive != isActive)
        {
            profile.IsActive = isActive;
            profile.UpdatedAt = DateTime.UtcNow;
            if (!isActive)
            {
                profile.IsDefault = false;
                await RevokeProfileSessionsAsync(profile.Id, "PROFILE_DISABLED", cancellationToken);
                await EnsureDefaultProfileAsync(userId, profile.Id, cancellationToken);
            }
            else if (!await db.UserProfiles.AnyAsync(
                         x => x.UserId == userId && x.IsActive && x.IsDefault,
                         cancellationToken))
            {
                profile.IsDefault = true;
            }

            var user = await db.Users.SingleAsync(x => x.Id == userId, cancellationToken);
            user.UpdatedAt = profile.UpdatedAt;
            AddAudit(
                user,
                profile,
                isActive ? "ADMIN_PROFILE_ENABLED" : "ADMIN_PROFILE_DISABLED",
                actorUserId,
                new { profile.IsActive });
            await db.SaveChangesAsync(cancellationToken);
        }

        return Success(await BuildProfileAsync(profile, cancellationToken));
    }

    public async Task<IReadOnlyList<AdminRoleDto>> GetRolesAsync(CancellationToken cancellationToken = default) =>
        await db.Roles
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => new AdminRoleDto(x.Id, x.Code, x.Name, x.Description))
            .ToListAsync(cancellationToken);

    public async Task<AdminPage<AdminAuditLogDto>> GetAuditLogsAsync(
        Guid? userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        (page, pageSize) = NormalizePaging(page, pageSize);
        var query = db.AuthAuditLogs.AsNoTracking();
        if (userId is not null)
        {
            query = query.Where(x => x.UserId == userId);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new AdminAuditLogDto(
                x.Id,
                x.UserId,
                x.ProfileId,
                x.Email,
                x.Event,
                x.Metadata,
                x.CreatedAt))
            .ToListAsync(cancellationToken);
        return new AdminPage<AdminAuditLogDto>(items, page, pageSize, totalCount);
    }

    private async Task<string?> ValidateProfileCommandAsync(
        Guid userId,
        Guid? profileId,
        SaveAdminProfileCommand command,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(command.Name)
            || command.Name.Trim().Length > 200
            || string.IsNullOrWhiteSpace(command.Code)
            || command.Code.Trim().Length > 100
            || command.OrganizationUnitCode?.Trim().Length > 100
            || command.OrganizationUnitName?.Trim().Length > 200)
        {
            return UserAdministrationErrorCodes.InvalidRequest;
        }

        if (!await db.Users.AnyAsync(x => x.Id == userId, cancellationToken))
        {
            return UserAdministrationErrorCodes.UserNotFound;
        }

        if (!await db.Roles.AnyAsync(x => x.Id == command.RoleId, cancellationToken))
        {
            return UserAdministrationErrorCodes.RoleNotFound;
        }

        var code = NormalizeCode(command.Code);
        if (await db.UserProfiles.AnyAsync(
                x => x.ProfileCode == code && x.Id != profileId,
                cancellationToken))
        {
            return UserAdministrationErrorCodes.ProfileCodeExists;
        }

        var organizationCode = NormalizeCodeOptional(command.OrganizationUnitCode);
        if (await db.UserProfiles.AnyAsync(
                x => x.UserId == userId
                     && x.RoleId == command.RoleId
                     && x.OrganizationUnitCode == organizationCode
                     && x.Id != profileId,
                cancellationToken))
        {
            return UserAdministrationErrorCodes.ProfileAssignmentExists;
        }

        return null;
    }

    private async Task<IReadOnlyList<AdminUserDto>> BuildUsersAsync(
        IReadOnlyCollection<User> users,
        CancellationToken cancellationToken)
    {
        if (users.Count == 0)
        {
            return [];
        }

        var userIds = users.Select(x => x.Id).ToArray();
        var profiles = await BuildProfilesQuery()
            .Where(x => userIds.Contains(x.UserId))
            .OrderByDescending(x => x.IsDefault)
            .ThenBy(x => x.ProfileName)
            .ToListAsync(cancellationToken);
        var profilesByUser = profiles.ToLookup(x => x.UserId);
        return users
            .Select(user => MapUser(user, profilesByUser[user.Id]))
            .ToList();
    }

    private async Task<AdminUserDto> BuildUserAsync(User user, CancellationToken cancellationToken)
    {
        var profiles = await BuildProfilesQuery()
            .Where(x => x.UserId == user.Id)
            .OrderByDescending(x => x.IsDefault)
            .ThenBy(x => x.ProfileName)
            .ToListAsync(cancellationToken);
        return MapUser(user, profiles);
    }

    private async Task<AdminProfileDto> BuildProfileAsync(
        UserProfile profile,
        CancellationToken cancellationToken) =>
        await BuildProfilesQuery()
            .Where(x => x.Id == profile.Id)
            .Select(x => new AdminProfileDto(
                x.Id,
                x.ProfileName,
                x.ProfileCode,
                x.RoleId,
                x.RoleCode,
                x.RoleName,
                x.OrganizationUnitCode,
                x.OrganizationUnitName,
                x.IsActive,
                x.IsDefault,
                x.LastSelectedAt,
                x.CreatedAt,
                x.UpdatedAt))
            .SingleAsync(cancellationToken);

    private IQueryable<ProfileProjection> BuildProfilesQuery() =>
        from profile in db.UserProfiles.AsNoTracking()
        join role in db.Roles.AsNoTracking() on profile.RoleId equals role.Id
        select new ProfileProjection
        {
            Id = profile.Id,
            UserId = profile.UserId,
            ProfileName = profile.ProfileName,
            ProfileCode = profile.ProfileCode,
            RoleId = profile.RoleId,
            RoleCode = role.Code,
            RoleName = role.Name,
            OrganizationUnitCode = profile.OrganizationUnitCode,
            OrganizationUnitName = profile.OrganizationUnitName,
            IsActive = profile.IsActive,
            IsDefault = profile.IsDefault,
            LastSelectedAt = profile.LastSelectedAt,
            CreatedAt = profile.CreatedAt,
            UpdatedAt = profile.UpdatedAt
        };

    private static AdminUserDto MapUser(User user, IEnumerable<ProfileProjection> profiles) =>
        new(
            user.Id,
            user.Email,
            user.DisplayName,
            user.IsActive,
            user.FirstLoginAt,
            user.LastLoginAt,
            user.CreatedAt,
            user.UpdatedAt,
            profiles.Select(x => new AdminProfileDto(
                x.Id,
                x.ProfileName,
                x.ProfileCode,
                x.RoleId,
                x.RoleCode,
                x.RoleName,
                x.OrganizationUnitCode,
                x.OrganizationUnitName,
                x.IsActive,
                x.IsDefault,
                x.LastSelectedAt,
                x.CreatedAt,
                x.UpdatedAt)).ToList());

    private async Task ClearDefaultProfileAsync(
        Guid userId,
        Guid? excludedProfileId,
        CancellationToken cancellationToken)
    {
        var profiles = await db.UserProfiles
            .Where(x => x.UserId == userId && x.IsDefault && x.Id != excludedProfileId)
            .ToListAsync(cancellationToken);
        foreach (var profile in profiles)
        {
            profile.IsDefault = false;
            profile.UpdatedAt = DateTime.UtcNow;
        }
    }

    private async Task EnsureDefaultProfileAsync(
        Guid userId,
        Guid excludedProfileId,
        CancellationToken cancellationToken)
    {
        if (await db.UserProfiles.AnyAsync(
                x => x.UserId == userId && x.IsActive && x.IsDefault && x.Id != excludedProfileId,
                cancellationToken))
        {
            return;
        }

        var replacement = await db.UserProfiles
            .Where(x => x.UserId == userId && x.IsActive && x.Id != excludedProfileId)
            .OrderBy(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (replacement is not null)
        {
            replacement.IsDefault = true;
            replacement.UpdatedAt = DateTime.UtcNow;
        }
    }

    private Task<int> RevokeUserSessionsAsync(
        Guid userId,
        string reason,
        CancellationToken cancellationToken) =>
        db.AuthSessions
            .Where(x => x.UserId == userId && x.RevokedAt == null)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.RevokedAt, DateTime.UtcNow)
                .SetProperty(x => x.RevokedReason, reason), cancellationToken);

    private Task<int> RevokeProfileSessionsAsync(
        Guid profileId,
        string reason,
        CancellationToken cancellationToken) =>
        db.AuthSessions
            .Where(x => x.ActiveProfileId == profileId && x.RevokedAt == null)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.RevokedAt, DateTime.UtcNow)
                .SetProperty(x => x.RevokedReason, reason), cancellationToken);

    private void AddAudit(
        User user,
        UserProfile? profile,
        string eventName,
        Guid actorUserId,
        object details)
    {
        db.AuthAuditLogs.Add(new AuthAuditLog
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            ProfileId = profile?.Id,
            Email = user.Email,
            Event = eventName,
            Metadata = JsonSerializer.Serialize(new { actorUserId, details }),
            CreatedAt = DateTime.UtcNow
        });
    }

    private static object ProfileMetadata(UserProfile profile) => new
    {
        profile.ProfileCode,
        profile.ProfileName,
        profile.RoleId,
        profile.OrganizationUnitCode,
        profile.OrganizationUnitName,
        profile.IsDefault
    };

    private static (int Page, int PageSize) NormalizePaging(int page, int pageSize) =>
        (Math.Max(1, page), Math.Clamp(pageSize, 1, MaximumPageSize));

    private static bool IsValidDisplayName(string? value) =>
        string.IsNullOrWhiteSpace(value) || value.Trim().Length <= 200;

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string NormalizeCode(string value) => value.Trim().ToUpperInvariant();

    private static string? NormalizeCodeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : NormalizeCode(value);

    private static AdminOperationResult<T> Failure<T>(string errorCode) => new(false, errorCode, default);

    private static AdminOperationResult<T> Success<T>(T value) => new(true, null, value);

    private sealed class ProfileProjection
    {
        public Guid Id { get; init; }
        public Guid UserId { get; init; }
        public string ProfileName { get; init; } = string.Empty;
        public string ProfileCode { get; init; } = string.Empty;
        public Guid RoleId { get; init; }
        public string RoleCode { get; init; } = string.Empty;
        public string RoleName { get; init; } = string.Empty;
        public string? OrganizationUnitCode { get; init; }
        public string? OrganizationUnitName { get; init; }
        public bool IsActive { get; init; }
        public bool IsDefault { get; init; }
        public DateTime? LastSelectedAt { get; init; }
        public DateTime CreatedAt { get; init; }
        public DateTime UpdatedAt { get; init; }
    }
}
