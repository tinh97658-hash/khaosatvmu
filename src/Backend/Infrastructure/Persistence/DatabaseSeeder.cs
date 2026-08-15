using Domain;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(
        AppDbContext db,
        bool includeDevelopmentData,
        CancellationToken cancellationToken = default)
    {
        var roles = await EnsureRolesAsync(db, cancellationToken);
        var permissions = await EnsurePermissionsAsync(db, cancellationToken);
        await EnsureRolePermissionsAsync(db, roles, permissions, cancellationToken);
        if (includeDevelopmentData)
        {
            await EnsureDevUserAsync(db, roles, cancellationToken);
        }
    }

    private static async Task<Dictionary<string, Role>> EnsureRolesAsync(
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        var definitions = new[]
        {
            (Code: "ADMIN", Name: "Administrator", Description: "System administrator"),
            (Code: "LECTURER", Name: "Lecturer", Description: "Lecturer profile"),
            (Code: "DEPARTMENT_MANAGER", Name: "Department manager", Description: "Department manager profile"),
            (Code: "SURVEY_ADMIN", Name: "Survey administrator", Description: "Survey administrator profile")
        };

        var roles = new Dictionary<string, Role>(StringComparer.OrdinalIgnoreCase);
        foreach (var definition in definitions)
        {
            var role = await db.Roles.SingleOrDefaultAsync(x => x.Code == definition.Code, cancellationToken);
            if (role is null)
            {
                role = new Role
                {
                    Id = Guid.NewGuid(),
                    Code = definition.Code,
                    Name = definition.Name,
                    Description = definition.Description,
                    IsSystem = true
                };
                db.Roles.Add(role);
            }

            roles[definition.Code] = role;
        }

        await db.SaveChangesAsync(cancellationToken);
        return roles;
    }

    private static async Task<Dictionary<string, Permission>> EnsurePermissionsAsync(
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        var definitions = new[]
        {
            (Code: "ADMIN_ACCESS", Name: "Admin access", Description: "Access administrative actions"),
            (Code: "SURVEY_MANAGE", Name: "Manage surveys", Description: "Create and manage surveys")
        };

        var permissions = new Dictionary<string, Permission>(StringComparer.OrdinalIgnoreCase);
        foreach (var definition in definitions)
        {
            var permission = await db.Permissions.SingleOrDefaultAsync(x => x.Code == definition.Code, cancellationToken);
            if (permission is null)
            {
                permission = new Permission
                {
                    Id = Guid.NewGuid(),
                    Code = definition.Code,
                    Name = definition.Name,
                    Description = definition.Description
                };
                db.Permissions.Add(permission);
            }

            permissions[definition.Code] = permission;
        }

        await db.SaveChangesAsync(cancellationToken);
        return permissions;
    }

    private static async Task EnsureRolePermissionsAsync(
        AppDbContext db,
        IReadOnlyDictionary<string, Role> roles,
        IReadOnlyDictionary<string, Permission> permissions,
        CancellationToken cancellationToken)
    {
        var definitions = new[]
        {
            (RoleCode: "ADMIN", PermissionCode: "ADMIN_ACCESS"),
            (RoleCode: "ADMIN", PermissionCode: "SURVEY_MANAGE"),
            (RoleCode: "SURVEY_ADMIN", PermissionCode: "SURVEY_MANAGE")
        };

        foreach (var definition in definitions)
        {
            var role = roles[definition.RoleCode];
            var permission = permissions[definition.PermissionCode];
            var exists = await db.RolePermissions.AnyAsync(x =>
                x.RoleId == role.Id && x.PermissionId == permission.Id,
                cancellationToken);

            if (!exists)
            {
                db.RolePermissions.Add(new RolePermission
                {
                    Id = Guid.NewGuid(),
                    RoleId = role.Id,
                    PermissionId = permission.Id,
                    IsGranted = true,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsureDevUserAsync(
        AppDbContext db,
        IReadOnlyDictionary<string, Role> roles,
        CancellationToken cancellationToken)
    {
        const string email = "abc@vmu.edu.vn";
        var user = await db.Users.SingleOrDefaultAsync(x => x.Email == email, cancellationToken);
        if (user is null)
        {
            user = new User
            {
                Id = Guid.NewGuid(),
                GoogleSubject = "dev-sub-001",
                Email = email,
                DisplayName = "Nguyen Van A",
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            db.Users.Add(user);
            await db.SaveChangesAsync(cancellationToken);
        }

        await EnsureProfileAsync(
            db,
            user,
            roles["LECTURER"],
            "LECTURER_MAIN",
            "Giang vien",
            "CNTT",
            "Khoa CNTT",
            isDefault: true,
            cancellationToken);

        await EnsureProfileAsync(
            db,
            user,
            roles["SURVEY_ADMIN"],
            "SURVEY_ADMIN",
            "Quan tri khao sat",
            "SURVEY",
            "Phong khao sat",
            isDefault: false,
            cancellationToken);

        await EnsureProfileAsync(
            db,
            user,
            roles["ADMIN"],
            "ADMIN_SYSTEM",
            "Quan tri he thong",
            null,
            null,
            isDefault: false,
            cancellationToken);
    }

    private static async Task EnsureProfileAsync(
        AppDbContext db,
        User user,
        Role role,
        string profileCode,
        string profileName,
        string? organizationUnitCode,
        string? organizationUnitName,
        bool isDefault,
        CancellationToken cancellationToken)
    {
        var profile = await db.UserProfiles.SingleOrDefaultAsync(x => x.ProfileCode == profileCode, cancellationToken);
        if (profile is not null)
        {
            return;
        }

        db.UserProfiles.Add(new UserProfile
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            RoleId = role.Id,
            ProfileName = profileName,
            ProfileCode = profileCode,
            OrganizationUnitCode = organizationUnitCode,
            OrganizationUnitName = organizationUnitName,
            IsActive = true,
            IsDefault = isDefault,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });

        await db.SaveChangesAsync(cancellationToken);
    }
}
