using System.Security.Claims;
using Application.Auth;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;

namespace API.Auth;

public static class AuthEndpoints
{
    private const string CookieScheme = "AppCookie";

    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/auth");

        group.MapGet("/login", () =>
        {
            return Results.Ok(new
            {
                message = "Google OIDC will be wired here. Use /api/auth/dev/login in Development for now."
            });
        });

        group.MapGet("/me", async (ClaimsPrincipal user, IAuthService authService) =>
        {
            var response = await authService.GetCurrentAsync(user);
            return Results.Ok(response);
        });

        group.MapGet("/profiles", [Authorize] async (ClaimsPrincipal user, IAuthService authService) =>
        {
            var response = await authService.GetCurrentAsync(user);
            return Results.Ok(new
            {
                authenticated = response.Authenticated,
                availableProfiles = response.AvailableProfiles
            });
        });

        group.MapPost("/switch-profile", [Authorize] async (
            ClaimsPrincipal user,
            SwitchProfileRequest request,
            IAuthService authService,
            HttpContext httpContext) =>
        {
            var result = await authService.SelectProfileAsync(user, request.ProfileId);
            if (!result.Succeeded || result.Response is null)
            {
                return Results.Json(new { errorCode = result.ErrorCode }, statusCode: MapErrorStatus(result.ErrorCode));
            }

            await SignInAsync(httpContext, result.Response);
            return Results.Ok(result.Response);
        });

        group.MapPost("/logout", async (ClaimsPrincipal user, IAuthService authService, HttpContext httpContext) =>
        {
            await authService.SignOutAsync(user);
            await httpContext.SignOutAsync(CookieScheme);
            return Results.Ok(new { success = true });
        });

        if (endpoints.ServiceProvider.GetRequiredService<IHostEnvironment>().IsDevelopment())
        {
            group.MapGet("/dev/login", async (
                string email,
                string? profileCode,
                IAuthService authService,
                HttpContext httpContext) =>
            {
                var result = await authService.DevSignInAsync(email, profileCode);
                if (!result.Succeeded || result.Response is null)
                {
                    return Results.Json(new { errorCode = result.ErrorCode, availableProfiles = result.AvailableProfiles }, statusCode: MapErrorStatus(result.ErrorCode));
                }

                await SignInAsync(httpContext, result.Response);
                return Results.Ok(result.Response);
            });
        }

        return endpoints;
    }

    private static async Task SignInAsync(HttpContext httpContext, AuthMeResponse response)
    {
        if (response.User is null || response.ActiveProfile is null)
        {
            throw new InvalidOperationException("Cannot sign in without an active profile.");
        }

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, response.User.Id.ToString()),
            new(ClaimTypes.Email, response.User.Email),
            new(ClaimTypes.Name, response.User.DisplayName ?? response.User.Email),
            new("active_profile_id", response.ActiveProfile.Id.ToString()),
            new("active_profile_code", response.ActiveProfile.Code),
            new("active_role_code", response.ActiveProfile.RoleCode),
            new("active_profile_name", response.ActiveProfile.Name)
        };

        var identity = new ClaimsIdentity(claims, CookieScheme);
        var principal = new ClaimsPrincipal(identity);
        await httpContext.SignInAsync(CookieScheme, principal, new AuthenticationProperties
        {
            IsPersistent = true
        });
    }

    private static int MapErrorStatus(string? errorCode) => errorCode switch
    {
        AuthErrorCodes.UserNotRegistered => StatusCodes.Status403Forbidden,
        AuthErrorCodes.AccountDisabled => StatusCodes.Status403Forbidden,
        AuthErrorCodes.InvalidDomain => StatusCodes.Status403Forbidden,
        AuthErrorCodes.NoProfiles => StatusCodes.Status403Forbidden,
        AuthErrorCodes.ProfileSelectionRequired => StatusCodes.Status409Conflict,
        AuthErrorCodes.ProfileNotFound => StatusCodes.Status404NotFound,
        AuthErrorCodes.ProfileDisabled => StatusCodes.Status403Forbidden,
        AuthErrorCodes.AccountLinkConflict => StatusCodes.Status409Conflict,
        AuthErrorCodes.SessionExpired => StatusCodes.Status401Unauthorized,
        _ => StatusCodes.Status400BadRequest
    };

    public sealed record SwitchProfileRequest(Guid ProfileId);
}
