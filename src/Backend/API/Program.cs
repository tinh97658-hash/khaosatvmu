using System.Text.Json.Serialization;
using Application.Common.Interfaces;
using Infrastructure.Persistence;
using Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddOpenApi();
builder.Services.AddHttpClient<IAgentMemoryService, AgentMemoryService>();

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
});

// Entity Framework Core 9 PostgreSQL Setup
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString, b => b.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName)));

builder.Services.AddScoped<IApplicationDbContext>(provider => provider.GetRequiredService<ApplicationDbContext>());
builder.Services.AddScoped<ApplicationDbContextInitialiser>();

var app = builder.Build();

// Auto-Apply Migrations and Seed Domain Data
using (var scope = app.Services.CreateScope())
{
    var initialiser = scope.ServiceProvider.GetRequiredService<ApplicationDbContextInitialiser>();
    await initialiser.InitialiseAsync();
    await initialiser.SeedAsync();
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// EF Core Survey Data Endpoints
app.MapGet("/api/surveys/tree", async (IApplicationDbContext db) =>
{
    var tree = await db.AcademicYears
        .Include(ay => ay.Semesters)
            .ThenInclude(s => s.SurveyCampaigns)
                .ThenInclude(sc => sc.SurveyForms)
                    .ThenInclude(sf => sf.Questions)
                        .ThenInclude(q => q.Options)
        .AsNoTracking()
        .ToListAsync();

    return Results.Ok(tree);
})
.WithName("GetSurveyTree");

app.MapGet("/api/academic-years", async (IApplicationDbContext db) =>
{
    var years = await db.AcademicYears
        .Include(ay => ay.Semesters)
        .AsNoTracking()
        .ToListAsync();

    return Results.Ok(years);
})
.WithName("GetAcademicYears");

app.MapGet("/api/survey-campaigns", async (IApplicationDbContext db) =>
{
    var campaigns = await db.SurveyCampaigns
        .Include(sc => sc.Semester)
        .Include(sc => sc.SurveyForms)
        .AsNoTracking()
        .ToListAsync();

    return Results.Ok(campaigns);
})
.WithName("GetSurveyCampaigns");

// AgentMemory API Endpoints
app.MapGet("/api/agentmemory/health", async (IAgentMemoryService memoryService) =>
{
    var healthy = await memoryService.IsHealthyAsync();
    return Results.Ok(new { status = healthy ? "online" : "offline", timestamp = DateTime.UtcNow });
})
.WithName("GetAgentMemoryHealth");

app.MapPost("/api/agentmemory/save", async (MemorySaveRequest req, IAgentMemoryService memoryService) =>
{
    var success = await memoryService.SaveMemoryAsync(req);
    return success ? Results.Ok(new { message = "Memory saved successfully" }) : Results.BadRequest(new { error = "Failed to save memory" });
})
.WithName("SaveAgentMemory");

app.MapPost("/api/agentmemory/recall", async (MemoryRecallRequest req, IAgentMemoryService memoryService) =>
{
    var memories = await memoryService.RecallMemoryAsync(req);
    return Results.Ok(memories);
})
.WithName("RecallAgentMemory");

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast =  Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast");

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
