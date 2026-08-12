using System.Security.Claims;
using API.Auth;
using Application.UserAdministration;

namespace API.UserAdministration;

public static class UserAdministrationEndpoints
{
    public static IEndpointRouteBuilder MapUserAdministrationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints
            .MapGroup("/api/admin")
            .RequireAuthorization(AuthPolicies.AdminAccess);

        group.MapGet("/users", async (
            string? search,
            bool? isActive,
            int page,
            int pageSize,
            IUserAdministrationService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetUsersAsync(search, isActive, page, pageSize, cancellationToken)));

        group.MapPost("/users", async (
            CreateUserRequest request,
            ClaimsPrincipal principal,
            IUserAdministrationService service,
            CancellationToken cancellationToken) =>
        {
            var actorUserId = GetRequiredGuidClaim(principal, ClaimTypes.NameIdentifier);
            var result = await service.CreateUserAsync(
                new CreateAdminUserCommand(request.Email, request.DisplayName),
                actorUserId,
                cancellationToken);
            return ToResult(result);
        }).AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPatch("/users/{userId:guid}/status", async (
            Guid userId,
            SetStatusRequest request,
            ClaimsPrincipal principal,
            IUserAdministrationService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.SetUserStatusAsync(
                userId,
                request.IsActive,
                GetRequiredGuidClaim(principal, ClaimTypes.NameIdentifier),
                cancellationToken);
            return ToResult(result);
        }).AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPost("/users/{userId:guid}/profiles", async (
            Guid userId,
            SaveProfileRequest request,
            ClaimsPrincipal principal,
            IUserAdministrationService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.CreateProfileAsync(
                userId,
                request.ToCommand(),
                GetRequiredGuidClaim(principal, ClaimTypes.NameIdentifier),
                cancellationToken);
            return ToResult(result);
        }).AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPut("/users/{userId:guid}/profiles/{profileId:guid}", async (
            Guid userId,
            Guid profileId,
            SaveProfileRequest request,
            ClaimsPrincipal principal,
            IUserAdministrationService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.UpdateProfileAsync(
                userId,
                profileId,
                request.ToCommand(),
                GetRequiredGuidClaim(principal, ClaimTypes.NameIdentifier),
                GetRequiredGuidClaim(principal, AuthClaimTypes.ActiveProfileId),
                cancellationToken);
            return ToResult(result);
        }).AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPatch("/users/{userId:guid}/profiles/{profileId:guid}/status", async (
            Guid userId,
            Guid profileId,
            SetStatusRequest request,
            ClaimsPrincipal principal,
            IUserAdministrationService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.SetProfileStatusAsync(
                userId,
                profileId,
                request.IsActive,
                GetRequiredGuidClaim(principal, ClaimTypes.NameIdentifier),
                GetRequiredGuidClaim(principal, AuthClaimTypes.ActiveProfileId),
                cancellationToken);
            return ToResult(result);
        }).AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapGet("/roles", async (
            IUserAdministrationService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetRolesAsync(cancellationToken)));

        group.MapGet("/audit-logs", async (
            Guid? userId,
            int page,
            int pageSize,
            IUserAdministrationService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetAuditLogsAsync(userId, page, pageSize, cancellationToken)));

        return endpoints;
    }

    private static IResult ToResult<T>(AdminOperationResult<T> result)
    {
        if (result.Succeeded && result.Value is not null)
        {
            return Results.Ok(result.Value);
        }

        var statusCode = result.ErrorCode switch
        {
            UserAdministrationErrorCodes.UserNotFound => StatusCodes.Status404NotFound,
            UserAdministrationErrorCodes.ProfileNotFound => StatusCodes.Status404NotFound,
            UserAdministrationErrorCodes.RoleNotFound => StatusCodes.Status404NotFound,
            UserAdministrationErrorCodes.UserEmailExists => StatusCodes.Status409Conflict,
            UserAdministrationErrorCodes.ProfileCodeExists => StatusCodes.Status409Conflict,
            UserAdministrationErrorCodes.ProfileAssignmentExists => StatusCodes.Status409Conflict,
            UserAdministrationErrorCodes.CannotDisableSelf => StatusCodes.Status409Conflict,
            UserAdministrationErrorCodes.CannotModifyActiveProfile => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status400BadRequest
        };
        return Results.Json(new { errorCode = result.ErrorCode }, statusCode: statusCode);
    }

    private static Guid GetRequiredGuidClaim(ClaimsPrincipal principal, string claimType) =>
        Guid.TryParse(principal.FindFirst(claimType)?.Value, out var value)
            ? value
            : throw new InvalidOperationException($"Required claim '{claimType}' is missing.");

    public sealed record CreateUserRequest(string Email, string? DisplayName);

    public sealed record SetStatusRequest(bool IsActive);

    public sealed record SaveProfileRequest(
        string Name,
        string Code,
        Guid RoleId,
        string? OrganizationUnitCode,
        string? OrganizationUnitName,
        bool IsDefault)
    {
        public SaveAdminProfileCommand ToCommand() => new(
            Name,
            Code,
            RoleId,
            OrganizationUnitCode,
            OrganizationUnitName,
            IsDefault);
    }
}
