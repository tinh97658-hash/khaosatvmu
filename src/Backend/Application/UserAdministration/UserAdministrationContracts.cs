namespace Application.UserAdministration;

public sealed record AdminProfileDto(
    Guid Id,
    string Name,
    string Code,
    Guid RoleId,
    string RoleCode,
    string RoleName,
    string? OrganizationUnitCode,
    string? OrganizationUnitName,
    bool IsActive,
    bool IsDefault,
    DateTime? LastSelectedAt,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record AdminUserDto(
    Guid Id,
    string Email,
    string? DisplayName,
    bool IsActive,
    DateTime? FirstLoginAt,
    DateTime? LastLoginAt,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    IReadOnlyList<AdminProfileDto> Profiles);

public sealed record AdminRoleDto(Guid Id, string Code, string Name, string? Description);

public sealed record AdminAuditLogDto(
    Guid Id,
    Guid? UserId,
    Guid? ProfileId,
    string? Email,
    string Event,
    string? Metadata,
    DateTime CreatedAt);

public sealed record AdminPage<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount);

public sealed record CreateAdminUserCommand(string Email, string? DisplayName);

public sealed record ImportAdminUserRowCommand(int RowNumber, string Email, string? DisplayName);

public sealed record AdminUserImportItemDto(
    int RowNumber,
    string Email,
    bool Succeeded,
    string? ErrorCode);

public sealed record AdminUserImportDto(
    int TotalCount,
    int CreatedCount,
    int SkippedCount,
    IReadOnlyList<AdminUserImportItemDto> Items);

public sealed record SaveAdminProfileCommand(
    string Name,
    string Code,
    Guid RoleId,
    string? OrganizationUnitCode,
    string? OrganizationUnitName,
    bool IsDefault);

public sealed record AdminOperationResult<T>(bool Succeeded, string? ErrorCode, T? Value);

public interface IUserAdministrationService
{
    Task<AdminPage<AdminUserDto>> GetUsersAsync(
        string? search,
        bool? isActive,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<AdminOperationResult<AdminUserDto>> CreateUserAsync(
        CreateAdminUserCommand command,
        Guid actorUserId,
        CancellationToken cancellationToken = default);

    Task<AdminOperationResult<AdminUserImportDto>> ImportUsersAsync(
        IReadOnlyList<ImportAdminUserRowCommand> commands,
        Guid actorUserId,
        CancellationToken cancellationToken = default);

    Task<AdminOperationResult<AdminUserDto>> SetUserStatusAsync(
        Guid userId,
        bool isActive,
        Guid actorUserId,
        CancellationToken cancellationToken = default);

    Task<AdminOperationResult<AdminProfileDto>> CreateProfileAsync(
        Guid userId,
        SaveAdminProfileCommand command,
        Guid actorUserId,
        CancellationToken cancellationToken = default);

    Task<AdminOperationResult<AdminProfileDto>> UpdateProfileAsync(
        Guid userId,
        Guid profileId,
        SaveAdminProfileCommand command,
        Guid actorUserId,
        Guid actorProfileId,
        CancellationToken cancellationToken = default);

    Task<AdminOperationResult<AdminProfileDto>> SetProfileStatusAsync(
        Guid userId,
        Guid profileId,
        bool isActive,
        Guid actorUserId,
        Guid actorProfileId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AdminRoleDto>> GetRolesAsync(CancellationToken cancellationToken = default);

    Task<AdminPage<AdminAuditLogDto>> GetAuditLogsAsync(
        Guid? userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);
}

public static class UserAdministrationErrorCodes
{
    public const string InvalidRequest = "ADMIN_INVALID_REQUEST";
    public const string UserNotFound = "ADMIN_USER_NOT_FOUND";
    public const string UserEmailExists = "ADMIN_USER_EMAIL_EXISTS";
    public const string ImportTooManyRows = "ADMIN_IMPORT_TOO_MANY_ROWS";
    public const string ImportEmailRequired = "ADMIN_IMPORT_EMAIL_REQUIRED";
    public const string ImportEmailInvalid = "ADMIN_IMPORT_EMAIL_INVALID";
    public const string ImportDisplayNameInvalid = "ADMIN_IMPORT_DISPLAY_NAME_INVALID";
    public const string ImportDuplicateEmail = "ADMIN_IMPORT_DUPLICATE_EMAIL";
    public const string CannotDisableSelf = "ADMIN_CANNOT_DISABLE_SELF";
    public const string ProfileNotFound = "ADMIN_PROFILE_NOT_FOUND";
    public const string ProfileCodeExists = "ADMIN_PROFILE_CODE_EXISTS";
    public const string ProfileAssignmentExists = "ADMIN_PROFILE_ASSIGNMENT_EXISTS";
    public const string RoleNotFound = "ADMIN_ROLE_NOT_FOUND";
    public const string CannotModifyActiveProfile = "ADMIN_CANNOT_MODIFY_ACTIVE_PROFILE";
}
