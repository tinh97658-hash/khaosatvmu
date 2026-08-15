using System.Security.Claims;
using Application.Auth;
using Microsoft.AspNetCore.Authorization;

namespace API.Auth;

public static class AuthPolicies
{
    public const string AdminAccess = "PERMISSION_ADMIN_ACCESS";
    public const string SurveyManage = "PERMISSION_SURVEY_MANAGE";
    public const string SurveyManageInOrganization = "PERMISSION_SURVEY_MANAGE_IN_ORGANIZATION";
    public const string ViewReports = "PERMISSION_VIEW_REPORTS";
}

public sealed record PermissionRequirement(
    string PermissionCode,
    string? OrganizationUnitRouteValue = null) : IAuthorizationRequirement;

public sealed class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    private readonly IAuthService _authService;

    public PermissionAuthorizationHandler(IAuthService authService)
    {
        _authService = authService;
    }

    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        if (context.User.Identity?.IsAuthenticated != true)
        {
            return;
        }

        var organizationUnitCode = requirement.OrganizationUnitRouteValue is not null
            && context.Resource is HttpContext httpContext
            ? httpContext.Request.RouteValues[requirement.OrganizationUnitRouteValue]?.ToString()
            : null;
        var allowed = await _authService.HasPermissionAsync(
            context.User,
            requirement.PermissionCode,
            organizationUnitCode);
        if (allowed)
        {
            context.Succeed(requirement);
        }
    }
}
