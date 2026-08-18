using API.Auth;
using API.Catalog;
using API.Middleware;
using API.Reports;
using API.Surveys;
using API.UserAdministration;
using Application.Auth;
using Application.Catalog;
using Application.Common.Interfaces;
using Application.Reports;
using Application.Surveys;
using Application.UserAdministration;
using Infrastructure.Auth;
using Infrastructure.Catalog;
using Infrastructure.Persistence;
using Infrastructure.Reports;
using Infrastructure.Services;
using Infrastructure.Surveys;
using Infrastructure.UserAdministration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using System.Threading.RateLimiting;

// High-Concurrency ThreadPool Warmup for 1,000+ Concurrent Requests
ThreadPool.SetMinThreads(300, 300);

var builder = WebApplication.CreateBuilder(args);

// Exception Handling & Problem Details
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

builder.Services.AddOpenApi();
builder.Services.AddMemoryCache();
builder.Services.AddHttpContextAccessor();
builder.Services.AddPersistence(builder.Configuration);

// Health Checks with Database Readiness
builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>("database", HealthStatus.Unhealthy);

// CORS Policy for Frontend Integration
var frontendBaseUrl = builder.Configuration["Authentication:FrontendBaseUrl"] ?? "http://localhost:5173";
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy.WithOrigins(frontendBaseUrl, "http://localhost:5173", "http://127.0.0.1:5173")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

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
    options.AddPolicy("PublicSurveySubmission", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
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

builder.Services.AddHttpClient<IAgentMemoryService, AgentMemoryService>();
builder.Services.AddScoped<IAuthService, EfAuthService>();
builder.Services.AddScoped<IAuthSessionService, EfAuthSessionService>();
builder.Services.AddScoped<IUserAdministrationService, EfUserAdministrationService>();
builder.Services.AddScoped<ICatalogService, EfCatalogService>();
builder.Services.AddScoped<ISurveyService, EfSurveyService>();
builder.Services.AddScoped<IReportService, EfReportService>();
builder.Services.AddScoped<ApplicationCookieEvents>();
builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();

var app = builder.Build();

app.UseExceptionHandler();
app.UseForwardedHeaders();

await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    await DatabaseSeeder.SeedAsync(db, app.Environment.IsDevelopment());
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors("FrontendPolicy");
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

app.MapHealthChecks("/healthz");
app.MapHealthChecks("/api/health");

app.Run();
