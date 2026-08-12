using System.Security.Claims;
using Application.Auth;
using Microsoft.AspNetCore.Authorization;

namespace API.Auth;

public sealed record PermissionRequirement(string PermissionCode) : IAuthorizationRequirement;

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

        var allowed = await _authService.HasPermissionAsync(context.User, requirement.PermissionCode);
        if (allowed)
        {
            context.Succeed(requirement);
        }
    }
}
