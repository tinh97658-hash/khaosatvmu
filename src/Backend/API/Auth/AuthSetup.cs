using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;

namespace API.Auth;

public static class AuthSchemes
{
    public const string Application = "AppCookie";
    public const string Pending = "PendingAuthCookie";
    public const string Google = "GoogleOIDC";
}

public static class AuthClaimTypes
{
    public const string SessionId = "session_id";
    public const string ActiveProfileId = "active_profile_id";
}

public sealed record GoogleAuthConfiguration(
    bool IsConfigured,
    string AllowedDomain,
    string FrontendBaseUrl);

public static class AuthSetup
{
    public static IServiceCollection AddApplicationAuthentication(
        this IServiceCollection services,
        IConfiguration configuration,
        IWebHostEnvironment environment)
    {
        var clientId = configuration["Authentication:Google:ClientId"];
        var clientSecret = configuration["Authentication:Google:ClientSecret"];
        var allowedDomain = configuration["Authentication:Google:AllowedDomain"] ?? string.Empty;
        var frontendBaseUrl = configuration["Authentication:FrontendBaseUrl"] ?? "http://localhost:5173";
        var googleConfigured = !string.IsNullOrWhiteSpace(clientId)
            && !string.IsNullOrWhiteSpace(clientSecret)
            && !string.IsNullOrWhiteSpace(allowedDomain);

        services.AddSingleton(new GoogleAuthConfiguration(googleConfigured, allowedDomain, frontendBaseUrl));

        var authentication = services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = AuthSchemes.Application;
                options.DefaultSignInScheme = AuthSchemes.Application;
                options.DefaultChallengeScheme = AuthSchemes.Application;
            })
            .AddCookie(AuthSchemes.Application, options =>
            {
                options.Cookie.Name = ".khaosatvmu.auth";
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = SameSiteMode.Lax;
                options.Cookie.SecurePolicy = environment.IsDevelopment()
                    ? CookieSecurePolicy.SameAsRequest
                    : CookieSecurePolicy.Always;
                options.SlidingExpiration = false;
                options.ExpireTimeSpan = TimeSpan.FromHours(8);
                options.LoginPath = "/api/auth/login";
                options.LogoutPath = "/api/auth/logout";
                options.EventsType = typeof(ApplicationCookieEvents);
            })
            .AddCookie(AuthSchemes.Pending, options =>
            {
                options.Cookie.Name = ".khaosatvmu.pending-auth";
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = SameSiteMode.Lax;
                options.Cookie.SecurePolicy = environment.IsDevelopment()
                    ? CookieSecurePolicy.SameAsRequest
                    : CookieSecurePolicy.Always;
                options.ExpireTimeSpan = TimeSpan.FromMinutes(10);
            });

        if (googleConfigured)
        {
            authentication.AddOpenIdConnect(AuthSchemes.Google, options =>
            {
                options.Authority = "https://accounts.google.com";
                options.ClientId = clientId!;
                options.ClientSecret = clientSecret!;
                options.SignInScheme = AuthSchemes.Pending;
                options.CallbackPath = "/signin-google";
                options.ResponseType = OpenIdConnectResponseType.Code;
                options.UsePkce = true;
                options.SaveTokens = false;
                options.GetClaimsFromUserInfoEndpoint = true;
                options.MapInboundClaims = false;
                options.Scope.Clear();
                options.Scope.Add("openid");
                options.Scope.Add("profile");
                options.Scope.Add("email");
                options.TokenValidationParameters.NameClaimType = "name";
                options.Events = new OpenIdConnectEvents
                {
                    OnRedirectToIdentityProvider = context =>
                    {
                        context.ProtocolMessage.SetParameter("hd", allowedDomain);
                        return Task.CompletedTask;
                    },
                    OnRemoteFailure = context =>
                    {
                        context.HandleResponse();
                        context.Response.Redirect($"{frontendBaseUrl.TrimEnd('/')}/login?error=AUTH_GOOGLE_REMOTE_FAILURE");
                        return Task.CompletedTask;
                    }
                };
            });
        }

        return services;
    }
}
