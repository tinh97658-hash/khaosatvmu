using System.Security.Claims;
using Application.Auth;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

namespace API.Auth;

public sealed class ApplicationCookieEvents(IAuthSessionService sessions) : CookieAuthenticationEvents
{
    public override async Task ValidatePrincipal(CookieValidatePrincipalContext context)
    {
        var sessionId = GetGuidClaim(context.Principal, AuthClaimTypes.SessionId);
        var userId = GetGuidClaim(context.Principal, ClaimTypes.NameIdentifier);
        var profileId = GetGuidClaim(context.Principal, AuthClaimTypes.ActiveProfileId);
        var valid = sessionId is not null
            && userId is not null
            && profileId is not null
            && await sessions.ValidateAsync(sessionId.Value, userId.Value, profileId.Value);

        if (valid)
        {
            return;
        }

        context.RejectPrincipal();
        await context.HttpContext.SignOutAsync(AuthSchemes.Application);
    }

    public override Task RedirectToLogin(RedirectContext<CookieAuthenticationOptions> context)
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    }

    public override Task RedirectToAccessDenied(RedirectContext<CookieAuthenticationOptions> context)
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    }

    private static Guid? GetGuidClaim(ClaimsPrincipal? principal, string claimType) =>
        Guid.TryParse(principal?.FindFirst(claimType)?.Value, out var value) ? value : null;
}
