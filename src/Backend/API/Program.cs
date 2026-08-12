using API.Auth;
using Application.Auth;
using Infrastructure.Auth;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

builder.Services.AddAuthentication("AppCookie")
    .AddCookie("AppCookie", options =>
    {
        options.Cookie.Name = ".khaosatvmu.auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.SlidingExpiration = true;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.LoginPath = "/api/auth/login";
        options.LogoutPath = "/api/auth/logout";
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("PERMISSION_ADMIN_ACCESS", policy =>
        policy.RequireAuthenticatedUser().AddRequirements(new PermissionRequirement("ADMIN_ACCESS")));
});

builder.Services.AddSingleton<IAuthService, InMemoryAuthService>();
builder.Services.AddSingleton<IAuthorizationHandler, PermissionAuthorizationHandler>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/", () => Results.Ok(new
{
    service = "khaosatvmu-api",
    status = "ok"
}));

app.MapAuthEndpoints();

app.MapGet("/api/health", () => Results.Ok(new { status = "healthy" }));

app.Run();
