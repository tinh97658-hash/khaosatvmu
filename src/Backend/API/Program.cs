using API.Auth;
using API.UserAdministration;
using Application.Auth;
using Application.UserAdministration;
using Infrastructure.Auth;
using Infrastructure.UserAdministration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddApplicationAuthentication(builder.Configuration, builder.Environment);
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.Name = ".khaosatvmu.csrf";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
});

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(AuthPolicies.AdminAccess, policy =>
        policy.RequireAuthenticatedUser().AddRequirements(new PermissionRequirement("ADMIN_ACCESS")));
    options.AddPolicy(AuthPolicies.SurveyManage, policy =>
        policy.RequireAuthenticatedUser().AddRequirements(new PermissionRequirement("SURVEY_MANAGE")));
    options.AddPolicy(AuthPolicies.SurveyManageInOrganization, policy =>
        policy.RequireAuthenticatedUser().AddRequirements(
            new PermissionRequirement("SURVEY_MANAGE", "organizationUnitCode")));
});

builder.Services.AddScoped<IAuthService, EfAuthService>();
builder.Services.AddScoped<IAuthSessionService, EfAuthSessionService>();
builder.Services.AddScoped<IUserAdministrationService, EfUserAdministrationService>();
builder.Services.AddScoped<ApplicationCookieEvents>();
builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();

var app = builder.Build();

await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await DatabaseSeeder.SeedAsync(db, app.Environment.IsDevelopment());
}

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
app.MapUserAdministrationEndpoints();

app.MapGet("/api/health", () => Results.Ok(new { status = "healthy" }));

app.Run();
