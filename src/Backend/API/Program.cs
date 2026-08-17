using API.Auth;
using API.Catalog;
using API.Reports;
using API.Surveys;
using API.UserAdministration;
using Application.Auth;
using Application.Catalog;
using Application.Reports;
using Application.Surveys;
using Application.UserAdministration;
using Infrastructure.Auth;
using Infrastructure.Catalog;
using Infrastructure.Persistence;
using Infrastructure.Reports;
using Infrastructure.Surveys;
using Infrastructure.UserAdministration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

var environmentName = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
    ?? Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT");
if (string.Equals(environmentName, Environments.Development, StringComparison.OrdinalIgnoreCase))
{
    DotNetEnv.Env.NoClobber().TraversePath().Load();
}

// High-Concurrency ThreadPool Warmup for 1,000+ Concurrent Requests
ThreadPool.SetMinThreads(300, 300);

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddMemoryCache();
builder.Services.AddHttpContextAccessor();
builder.Services.AddPersistence(builder.Configuration);

// High-Throughput Rate Limiter for 1000+ Concurrent Students
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddConcurrencyLimiter("PublicSurveyConcurrency", limiterOptions =>
    {
        limiterOptions.PermitLimit = 800;
        limiterOptions.QueueProcessingOrder = System.Threading.RateLimiting.QueueProcessingOrder.OldestFirst;
        limiterOptions.QueueLimit = 500;
    });
});

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
    options.AddPolicy(AuthPolicies.ViewReports, policy =>
        policy.RequireAuthenticatedUser().AddRequirements(new PermissionRequirement("VIEW_REPORTS")));
});

builder.Services.AddScoped<IAuthService, EfAuthService>();
builder.Services.AddScoped<IAuthSessionService, EfAuthSessionService>();
builder.Services.AddScoped<IUserAdministrationService, EfUserAdministrationService>();
builder.Services.AddScoped<ICatalogService, EfCatalogService>();
builder.Services.AddScoped<ISurveyService, EfSurveyService>();
builder.Services.AddScoped<IReportService, EfReportService>();
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
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/", () => Results.Ok(new
{
    service = "khaosatvmu-api",
    status = "ok"
}));

app.MapAuthEndpoints();
app.MapUserAdministrationEndpoints();
app.MapCatalogEndpoints();
app.MapSurveyEndpoints();
app.MapReportEndpoints();

app.MapGet("/api/health", () => Results.Ok(new { status = "healthy" }));

app.Run();
