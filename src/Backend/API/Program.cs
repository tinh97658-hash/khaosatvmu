using API.Auth;
using Application.Auth;
using Infrastructure.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddApplicationAuthentication(builder.Configuration, builder.Environment);

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

app.MapGet("/api/health", () => Results.Ok(new { status = "healthy" }));

app.Run();
