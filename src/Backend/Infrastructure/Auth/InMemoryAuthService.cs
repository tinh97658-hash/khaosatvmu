using System.Security.Claims;
using Application.Auth;
using Domain;

namespace Infrastructure.Auth;

public sealed class InMemoryAuthService : IAuthService
{
    private readonly object _gate = new();
    private readonly List<User> _users = [];
    private readonly List<Role> _roles = [];
    private readonly List<Permission> _permissions = [];
    private readonly List<RolePermission> _rolePermissions = [];
    private readonly List<AuthAuditLog> _auditLogs = [];

    public InMemoryAuthService()
    {
        Seed();
    }

    public Task<AuthMeResponse> GetCurrentAsync(ClaimsPrincipal? principal)
    {
        var state = ResolvePrincipalState(principal);
        if (state is null)
        {
            return Task.FromResult(new AuthMeResponse(false, null, null, []));
        }

        return Task.FromResult(BuildAuthMeResponse(state.Value.User, state.Value.ActiveProfile));
    }

    public Task<AuthAccessResponse?> GetAccessAsync(ClaimsPrincipal? principal)
    {
        var state = ResolvePrincipalState(principal);
        if (state is null)
        {
            return Task.FromResult<AuthAccessResponse?>(null);
        }

        var role = _roles.Single(x => x.Id == state.Value.ActiveProfile.RoleId);
        var permissionIds = _rolePermissions
            .Where(x => x.RoleId == role.Id && x.IsGranted)
            .Select(x => x.PermissionId)
            .ToHashSet();
        var permissions = _permissions
            .Where(x => permissionIds.Contains(x.Id))
            .Select(x => x.Code)
            .OrderBy(x => x)
            .ToList();
        return Task.FromResult<AuthAccessResponse?>(new AuthAccessResponse(
            state.Value.ActiveProfile.Id,
            role.Code,
            state.Value.ActiveProfile.OrganizationUnitCode,
            permissions));
    }

    public async Task<GoogleSignInResult> GoogleSignInAsync(GoogleIdentity identity)
    {
        if (!identity.EmailVerified)
        {
            return new GoogleSignInResult(false, AuthErrorCodes.EmailNotVerified, null, null, null);
        }

        var result = await DevSignInAsync(identity.Email);
        return new GoogleSignInResult(
            result.Succeeded,
            result.ErrorCode,
            result.PendingUserId,
            result.Response,
            result.AvailableProfiles);
    }

    public Task<IReadOnlyList<AuthProfileDto>> GetAvailableProfilesAsync(Guid userId) =>
        Task.FromResult(GetProfilesForUser(userId));

    public Task<ProfileSelectionResult> SelectInitialProfileAsync(Guid userId, Guid profileId)
    {
        var user = _users.SingleOrDefault(x => x.Id == userId);
        var profile = user?.Profiles.SingleOrDefault(x => x.Id == profileId);
        if (user is null || profile is null)
        {
            return Task.FromResult(new ProfileSelectionResult(false, AuthErrorCodes.ProfileNotFound, null));
        }

        if (!user.IsActive || !profile.IsActive)
        {
            return Task.FromResult(new ProfileSelectionResult(false, AuthErrorCodes.ProfileDisabled, null));
        }

        return Task.FromResult(new ProfileSelectionResult(true, null, BuildAuthMeResponse(user, profile)));
    }

    public Task<SignInResult> DevSignInAsync(string email)
    {
        lock (_gate)
        {
            var user = _users.SingleOrDefault(x => x.Email.Equals(email, StringComparison.OrdinalIgnoreCase));
            if (user is null)
            {
                return Task.FromResult(new SignInResult(false, AuthErrorCodes.UserNotRegistered, null, null));
            }

            if (!user.IsActive)
            {
                return Task.FromResult(new SignInResult(false, AuthErrorCodes.AccountDisabled, null, null));
            }

            var profiles = GetProfilesForUser(user.Id);
            if (profiles.Count == 0)
            {
                return Task.FromResult(new SignInResult(false, AuthErrorCodes.NoProfiles, null, null));
            }

            return Task.FromResult(new SignInResult(
                false,
                AuthErrorCodes.ProfileSelectionRequired,
                null,
                profiles,
                user.Id));
        }
    }

    public Task<ProfileSelectionResult> SelectProfileAsync(ClaimsPrincipal? principal, Guid profileId)
    {
        var state = ResolvePrincipalState(principal);
        if (state is null)
        {
            return Task.FromResult(new ProfileSelectionResult(false, AuthErrorCodes.SessionExpired, null));
        }

        lock (_gate)
        {
            var user = state.Value.User;
            var profile = _users
                .SelectMany(x => x.Profiles)
                .SingleOrDefault(x => x.Id == profileId);

            if (profile is null || profile.UserId != user.Id)
            {
                return Task.FromResult(new ProfileSelectionResult(false, AuthErrorCodes.ProfileNotFound, null));
            }

            if (!profile.IsActive || !user.IsActive)
            {
                return Task.FromResult(new ProfileSelectionResult(false, AuthErrorCodes.ProfileDisabled, null));
            }

            profile.LastSelectedAt = DateTime.UtcNow;
            user.LastLoginAt = DateTime.UtcNow;

            AddAudit(user.Id, profile.Id, user.Email, "PROFILE_SWITCHED", null, null, new
            {
                profile.ProfileCode,
                profile.ProfileName
            });

            return Task.FromResult(new ProfileSelectionResult(true, null, BuildAuthMeResponse(user, profile)));
        }
    }

    public Task<SignOutResult> SignOutAsync(ClaimsPrincipal? principal)
    {
        var state = ResolvePrincipalState(principal);
        if (state is not null)
        {
            AddAudit(state.Value.User.Id, state.Value.ActiveProfile.Id, state.Value.User.Email, "LOGOUT", null, null, null);
        }

        return Task.FromResult(new SignOutResult(true));
    }

    public Task<bool> HasPermissionAsync(
        ClaimsPrincipal? principal,
        string permissionCode,
        string? resourceOrganizationUnitCode = null)
    {
        var state = ResolvePrincipalState(principal);
        if (state is null)
        {
            return Task.FromResult(false);
        }

        var role = _roles.SingleOrDefault(x => x.Id == state.Value.ActiveProfile.RoleId);
        if (role is null)
        {
            return Task.FromResult(false);
        }

        var permission = _permissions.SingleOrDefault(x => x.Code == permissionCode);
        if (permission is null)
        {
            return Task.FromResult(false);
        }

        var granted = _rolePermissions.Any(x =>
            x.RoleId == role.Id &&
            x.PermissionId == permission.Id &&
            x.IsGranted);

        if (granted && !string.IsNullOrWhiteSpace(resourceOrganizationUnitCode))
        {
            granted = string.IsNullOrWhiteSpace(state.Value.ActiveProfile.OrganizationUnitCode)
                || string.Equals(
                    state.Value.ActiveProfile.OrganizationUnitCode,
                    resourceOrganizationUnitCode,
                    StringComparison.OrdinalIgnoreCase);
        }

        return Task.FromResult(granted);
    }

    private AuthMeResponse BuildAuthMeResponse(User user, UserProfile activeProfile)
    {
        var profiles = GetProfilesForUser(user.Id);
        var userDto = new AuthUserDto(user.Id, user.Email, user.DisplayName, user.AvatarUrl);
        var activeProfileDto = MapProfile(activeProfile);
        return new AuthMeResponse(true, userDto, activeProfileDto, profiles);
    }

    private IReadOnlyList<AuthProfileDto> GetProfilesForUser(Guid userId)
    {
        var user = _users.Single(x => x.Id == userId);
        return user.Profiles
            .Where(x => x.IsActive)
            .Select(MapProfileWithRole)
            .OrderByDescending(x => x.IsDefault)
            .ThenBy(x => x.Name)
            .ToList();
    }

    private AuthProfileDto MapProfile(UserProfile profile)
    {
        var role = _roles.Single(x => x.Id == profile.RoleId);
        return new AuthProfileDto(
            profile.Id,
            profile.ProfileName,
            profile.ProfileCode,
            role.Code,
            profile.OrganizationUnitCode,
            profile.OrganizationUnitName,
            profile.IsDefault);
    }

    private AuthProfileDto MapProfileWithRole(UserProfile profile) => MapProfile(profile);

    private (User User, UserProfile ActiveProfile)? ResolvePrincipalState(ClaimsPrincipal? principal)
    {
        if (principal?.Identity?.IsAuthenticated != true)
        {
            return null;
        }

        var userIdClaim = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var profileIdClaim = principal.FindFirst("active_profile_id")?.Value;

        if (!Guid.TryParse(userIdClaim, out var userId) || !Guid.TryParse(profileIdClaim, out var profileId))
        {
            return null;
        }

        lock (_gate)
        {
            var user = _users.SingleOrDefault(x => x.Id == userId);
            if (user is null || !user.IsActive)
            {
                return null;
            }

            var activeProfile = user.Profiles.SingleOrDefault(x => x.Id == profileId);
            if (activeProfile is null || !activeProfile.IsActive)
            {
                return null;
            }

            return (user, activeProfile);
        }
    }

    private void AddAudit(Guid? userId, Guid? profileId, string? email, string evt, string? ipAddress, string? userAgent, object? metadata)
    {
        _auditLogs.Add(new AuthAuditLog
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ProfileId = profileId,
            Email = email,
            Event = evt,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            Metadata = metadata is null ? null : System.Text.Json.JsonSerializer.Serialize(metadata),
            CreatedAt = DateTime.UtcNow
        });
    }

    private void Seed()
    {
        var admin = new Role { Id = Guid.NewGuid(), Code = "ADMIN", Name = "Administrator", Description = "System admin", IsSystem = true };
        var lecturer = new Role { Id = Guid.NewGuid(), Code = "LECTURER", Name = "Lecturer", Description = "Lecturer profile", IsSystem = true };
        var manager = new Role { Id = Guid.NewGuid(), Code = "DEPARTMENT_MANAGER", Name = "Department manager", Description = "Department manager profile", IsSystem = true };
        var surveyAdmin = new Role { Id = Guid.NewGuid(), Code = "SURVEY_ADMIN", Name = "Survey admin", Description = "Survey admin profile", IsSystem = true };
        _roles.AddRange([admin, lecturer, manager, surveyAdmin]);

        var adminAccess = new Permission { Id = Guid.NewGuid(), Code = "ADMIN_ACCESS", Name = "Admin access", Description = "Access admin actions" };
        var surveyManage = new Permission { Id = Guid.NewGuid(), Code = "SURVEY_MANAGE", Name = "Survey manage", Description = "Manage surveys" };
        _permissions.AddRange([adminAccess, surveyManage]);

        _rolePermissions.AddRange([
            new RolePermission { Id = Guid.NewGuid(), RoleId = admin.Id, PermissionId = adminAccess.Id, IsGranted = true, CreatedAt = DateTime.UtcNow },
            new RolePermission { Id = Guid.NewGuid(), RoleId = surveyAdmin.Id, PermissionId = surveyManage.Id, IsGranted = true, CreatedAt = DateTime.UtcNow }
        ]);

        var user = new User
        {
            Id = Guid.NewGuid(),
            GoogleSubject = "dev-sub-001",
            Email = "abc@vmu.edu.vn",
            DisplayName = "Nguyen Van A",
            IsActive = true,
            FirstLoginAt = null,
            LastLoginAt = null,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var lecturerProfile = new UserProfile
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            RoleId = lecturer.Id,
            ProfileName = "Giang vien",
            ProfileCode = "LECTURER_MAIN",
            OrganizationUnitCode = "CNTT",
            OrganizationUnitName = "Khoa CNTT",
            IsActive = true,
            IsDefault = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var surveyProfile = new UserProfile
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            RoleId = surveyAdmin.Id,
            ProfileName = "Quan tri khao sat",
            ProfileCode = "SURVEY_ADMIN",
            OrganizationUnitCode = "SURVEY",
            OrganizationUnitName = "Phong khao sat",
            IsActive = true,
            IsDefault = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        user.Profiles.AddRange([lecturerProfile, surveyProfile]);
        _users.Add(user);
    }
}
