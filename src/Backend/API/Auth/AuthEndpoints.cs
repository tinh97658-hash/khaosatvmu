using System.Security.Claims;
using Application.Auth;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;

namespace API.Auth;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/auth");

        group.MapGet("/login", (GoogleAuthConfiguration googleAuth) =>
        {
            if (!googleAuth.IsConfigured)
            {
                return Results.Problem(
                    title: "Google authentication is not configured.",
                    statusCode: StatusCodes.Status503ServiceUnavailable,
                    extensions: new Dictionary<string, object?> { ["errorCode"] = "AUTH_GOOGLE_NOT_CONFIGURED" });
            }

            var properties = new AuthenticationProperties
            {
                RedirectUri = "/api/auth/google-complete"
            };
            return Results.Challenge(properties, [AuthSchemes.Google]);
        });

        group.MapGet("/google-complete", async (
            HttpContext httpContext,
            IAuthService authService,
            GoogleAuthConfiguration googleAuth) =>
        {
            var pending = await httpContext.AuthenticateAsync(AuthSchemes.Pending);
            if (!pending.Succeeded || pending.Principal is null)
            {
                return RedirectWithError(googleAuth, AuthErrorCodes.InvalidGoogleIdentity);
            }

            var principal = pending.Principal;
            var identity = new GoogleIdentity(
                principal.FindFirst("sub")?.Value ?? string.Empty,
                principal.FindFirst("email")?.Value ?? string.Empty,
                principal.FindFirst("name")?.Value,
                principal.FindFirst("picture")?.Value,
                bool.TryParse(principal.FindFirst("email_verified")?.Value, out var verified) && verified,
                principal.FindFirst("hd")?.Value);

            var result = await authService.GoogleSignInAsync(identity, googleAuth.AllowedDomain);
            if (result.Succeeded && result.Response is not null)
            {
                await SignInAsync(httpContext, result.Response);
                await httpContext.SignOutAsync(AuthSchemes.Pending);
                return Results.Redirect(googleAuth.FrontendBaseUrl);
            }

            if (result.ErrorCode == AuthErrorCodes.ProfileSelectionRequired && result.PendingUserId is not null)
            {
                await SignInPendingProfileAsync(httpContext, result.PendingUserId.Value);
                return Results.Redirect($"{googleAuth.FrontendBaseUrl.TrimEnd('/')}/select-profile");
            }

            await httpContext.SignOutAsync(AuthSchemes.Pending);
            return RedirectWithError(googleAuth, result.ErrorCode);
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

        group.MapGet("/pending-profiles", async (HttpContext httpContext, IAuthService authService) =>
        {
            var userId = await GetPendingUserIdAsync(httpContext);
            if (userId is null)
            {
                return Results.Json(new { errorCode = AuthErrorCodes.SessionExpired }, statusCode: StatusCodes.Status401Unauthorized);
            }

            return Results.Ok(new { availableProfiles = await authService.GetAvailableProfilesAsync(userId.Value) });
        });

        group.MapPost("/select-profile", async (
            SelectProfileRequest request,
            HttpContext httpContext,
            IAuthService authService) =>
        {
            var userId = await GetPendingUserIdAsync(httpContext);
            if (userId is null)
            {
                return Results.Json(new { errorCode = AuthErrorCodes.SessionExpired }, statusCode: StatusCodes.Status401Unauthorized);
            }

            var result = await authService.SelectInitialProfileAsync(userId.Value, request.ProfileId);
            if (!result.Succeeded || result.Response is null)
            {
                return Results.Json(new { errorCode = result.ErrorCode }, statusCode: MapErrorStatus(result.ErrorCode));
            }

            await SignInAsync(httpContext, result.Response);
            await httpContext.SignOutAsync(AuthSchemes.Pending);
            return Results.Ok(result.Response);
        });

        group.MapPost("/switch-profile", [Authorize] async (
            ClaimsPrincipal user,
            SelectProfileRequest request,
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
            await httpContext.SignOutAsync(AuthSchemes.Application);
            await httpContext.SignOutAsync(AuthSchemes.Pending);
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

        var identity = new ClaimsIdentity(claims, AuthSchemes.Application);
        var principal = new ClaimsPrincipal(identity);
        await httpContext.SignInAsync(AuthSchemes.Application, principal, new AuthenticationProperties
        {
            IsPersistent = true
        });
    }

    private static async Task SignInPendingProfileAsync(HttpContext httpContext, Guid userId)
    {
        var identity = new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, userId.ToString())],
            AuthSchemes.Pending);
        await httpContext.SignInAsync(
            AuthSchemes.Pending,
            new ClaimsPrincipal(identity),
            new AuthenticationProperties { IsPersistent = false });
    }

    private static async Task<Guid?> GetPendingUserIdAsync(HttpContext httpContext)
    {
        var pending = await httpContext.AuthenticateAsync(AuthSchemes.Pending);
        return Guid.TryParse(pending.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId)
            ? userId
            : null;
    }

    private static IResult RedirectWithError(GoogleAuthConfiguration configuration, string? errorCode) =>
        Results.Redirect($"{configuration.FrontendBaseUrl.TrimEnd('/')}/login?error={Uri.EscapeDataString(errorCode ?? AuthErrorCodes.InvalidGoogleIdentity)}");

    private static int MapErrorStatus(string? errorCode) => errorCode switch
    {
        AuthErrorCodes.UserNotRegistered => StatusCodes.Status403Forbidden,
        AuthErrorCodes.AccountDisabled => StatusCodes.Status403Forbidden,
        AuthErrorCodes.InvalidDomain => StatusCodes.Status403Forbidden,
        AuthErrorCodes.EmailNotVerified => StatusCodes.Status403Forbidden,
        AuthErrorCodes.InvalidGoogleIdentity => StatusCodes.Status401Unauthorized,
        AuthErrorCodes.NoProfiles => StatusCodes.Status403Forbidden,
        AuthErrorCodes.ProfileSelectionRequired => StatusCodes.Status409Conflict,
        AuthErrorCodes.ProfileNotFound => StatusCodes.Status404NotFound,
        AuthErrorCodes.ProfileDisabled => StatusCodes.Status403Forbidden,
        AuthErrorCodes.AccountLinkConflict => StatusCodes.Status409Conflict,
        AuthErrorCodes.SessionExpired => StatusCodes.Status401Unauthorized,
        _ => StatusCodes.Status400BadRequest
    };

    public sealed record SelectProfileRequest(Guid ProfileId);
}
