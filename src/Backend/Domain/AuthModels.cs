namespace Domain;

public sealed class User
{
    public Guid Id { get; set; }
    public string? GoogleSubject { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? AvatarUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? FirstLoginAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<UserProfile> Profiles { get; set; } = [];
}

public sealed class UserProfile
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid RoleId { get; set; }
    public string ProfileName { get; set; } = string.Empty;
    public string ProfileCode { get; set; } = string.Empty;
    public string? OrganizationUnitCode { get; set; }
    public string? OrganizationUnitName { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsDefault { get; set; }
    public DateTime? LastSelectedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class Role
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsSystem { get; set; }
}

public sealed class Permission
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public sealed class RolePermission
{
    public Guid Id { get; set; }
    public Guid RoleId { get; set; }
    public Guid PermissionId { get; set; }
    public bool IsGranted { get; set; } = true;
    public DateTime CreatedAt { get; set; }
}

public sealed class AuthAuditLog
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public Guid? ProfileId { get; set; }
    public string? Email { get; set; }
    public string Event { get; set; } = string.Empty;
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? Metadata { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class AuthSession
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid ActiveProfileId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? RevokedReason { get; set; }
}
