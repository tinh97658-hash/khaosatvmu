using System.Security.Claims;
using Application.Auth;
using Microsoft.AspNetCore.Authorization;

namespace API.Auth;

public static class AuthPolicies
{
    public const string UserAdminAccess = "PERMISSION_USER_ADMIN_ACCESS";
    public const string CatalogAccess = "PERMISSION_CATALOG_ACCESS";
    public const string CourseQuestionSetsAccess = "PERMISSION_COURSE_QUESTION_SETS_ACCESS";
    public const string CourseCampaignsAccess = "PERMISSION_COURSE_CAMPAIGNS_ACCESS";
    public const string ProgramCampaignsAccess = "PERMISSION_PROGRAM_CAMPAIGNS_ACCESS";
    public const string ProgramCriteriaAccess = "PERMISSION_PROGRAM_CRITERIA_ACCESS";
    public const string ProgressAccess = "PERMISSION_PROGRESS_ACCESS";
    public const string ReportsAccess = "PERMISSION_REPORTS_ACCESS";
    public const string SurveyOperationalRead = "PERMISSION_SURVEY_OPERATIONAL_READ";
}

public sealed record PermissionRequirement(
    string PermissionCode,
    string? OrganizationUnitRouteValue = null) : IAuthorizationRequirement;

public sealed record AnyPermissionRequirement(params string[] PermissionCodes) : IAuthorizationRequirement;

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

public sealed class AnyPermissionAuthorizationHandler : AuthorizationHandler<AnyPermissionRequirement>
{
    private readonly IAuthService _authService;

    public AnyPermissionAuthorizationHandler(IAuthService authService)
    {
        _authService = authService;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        AnyPermissionRequirement requirement)
    {
        if (context.User.Identity?.IsAuthenticated != true)
        {
            return;
        }

        foreach (var permissionCode in requirement.PermissionCodes)
        {
            if (await _authService.HasPermissionAsync(context.User, permissionCode))
            {
                context.Succeed(requirement);
                return;
            }
        }
    }
}
