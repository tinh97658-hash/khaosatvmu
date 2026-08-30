using API.Auth;
using Application.GraduationAnalytics;

namespace API.GraduationAnalytics;

public static class GraduationAnalyticsEndpoints
{
    public static IEndpointRouteBuilder MapGraduationAnalyticsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/graduation-analytics")
            .RequireAuthorization(AuthPolicies.GraduationAnalyticsAccess);

        group.MapGet("/periods", async (IGraduationAnalyticsService service, CancellationToken ct) =>
            Results.Ok(await service.GetPeriodsAsync(ct)));

        group.MapGet("/metadata", (IGraduationAnalyticsService service) =>
            Results.Ok(service.GetMetadata()));

        group.MapGet("/facets", async (
            string? scope,
            long? periodId,
            IGraduationAnalyticsService service,
            CancellationToken ct) =>
        {
            try { return Results.Ok(await service.GetFacetsAsync(scope ?? string.Empty, periodId, ct)); }
            catch (GraduationAnalyticsException exception) { return ToError(exception); }
        });

        group.MapPost("/periods", async (
            ImportGraduationPeriodRequest request,
            IGraduationAnalyticsService service,
            CancellationToken ct) =>
        {
            try
            {
                var command = new ImportGraduationPeriodCommand(
                    request.OriginalFileName ?? string.Empty,
                    request.SourceSheetName ?? string.Empty,
                    request.Rows?.Select(x => x.ToCommand()).ToList() ?? []);
                return Results.Ok(await service.ImportPeriodAsync(command, ct));
            }
            catch (GraduationAnalyticsException exception) { return ToError(exception); }
        }).AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPost("/query", async (
            GraduationAnalyticsQueryRequest request,
            IGraduationAnalyticsService service,
            CancellationToken ct) =>
        {
            try { return Results.Ok(await service.QueryAsync(request.ToCommand(), ct)); }
            catch (GraduationAnalyticsException exception) { return ToError(exception); }
        }).AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPost("/overview", async (
            GraduationOverviewRequest request,
            IGraduationAnalyticsService service,
            CancellationToken ct) =>
        {
            try { return Results.Ok(await service.GetOverviewAsync(request.ToQuery(), ct)); }
            catch (GraduationAnalyticsException exception) { return ToError(exception); }
        }).AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapGet("/periods/{periodId:long}/rows", async (
            long periodId,
            string? search,
            string? faculty,
            string? program,
            string? cohort,
            int page,
            int pageSize,
            IGraduationAnalyticsService service,
            CancellationToken ct) =>
        {
            try
            {
                return Results.Ok(await service.GetRowsAsync(
                    new GraduationRowsQuery(periodId, search, faculty, program, cohort, page, pageSize),
                    ct));
            }
            catch (GraduationAnalyticsException exception) { return ToError(exception); }
        });

        return app;
    }

    private static IResult ToError(GraduationAnalyticsException exception)
    {
        var statusCode = exception.ErrorCode switch
        {
            GraduationAnalyticsErrorCodes.PeriodExists => StatusCodes.Status409Conflict,
            GraduationAnalyticsErrorCodes.PeriodNotFound => StatusCodes.Status404NotFound,
            _ => StatusCodes.Status400BadRequest,
        };
        return Results.Json(new { errorCode = exception.ErrorCode, message = exception.Message }, statusCode: statusCode);
    }

    public sealed record ImportGraduationPeriodRequest(
        string? OriginalFileName,
        string? SourceSheetName,
        IReadOnlyList<GraduationImportRowRequest>? Rows);

    public sealed record GraduationImportRowRequest(
        int SourceRowNumber,
        string? FacultyName,
        string? ProgramCode,
        string? ProgramName,
        string? Cohort,
        int? InitialEnrollmentCount,
        string? ReviewPeriodText,
        int? EligibleGraduateCount,
        int? OnTimeGraduateCount,
        decimal? OnTimeGraduateRate,
        int? ExcellentCount,
        decimal? ExcellentRate,
        int? VeryGoodCount,
        decimal? VeryGoodRate,
        int? GoodCount,
        decimal? GoodRate,
        int? AverageCount,
        decimal? AverageRate,
        int? WorkStudyTransferCount,
        decimal? WorkStudyTransferRate)
    {
        public GraduationImportRowCommand ToCommand()
        {
            if (EligibleGraduateCount.HasValue || OnTimeGraduateCount.HasValue || OnTimeGraduateRate.HasValue)
            {
                throw new GraduationAnalyticsException(
                    GraduationAnalyticsErrorCodes.LegacyStructureUnsupported,
                    "File còn cấu trúc 19 cột cũ (cột 7–9). Hãy dùng biểu mẫu mới 16 cột.");
            }

            return new(
                SourceRowNumber, FacultyName ?? string.Empty, ProgramCode, ProgramName ?? string.Empty,
                Cohort ?? string.Empty, InitialEnrollmentCount, ReviewPeriodText ?? string.Empty,
                ExcellentCount, ExcellentRate, VeryGoodCount, VeryGoodRate, GoodCount, GoodRate, AverageCount,
                AverageRate, WorkStudyTransferCount, WorkStudyTransferRate);
        }
    }

    public sealed record GraduationAnalyticsQueryRequest(
        string? Scope,
        long? PeriodId,
        string? MetricId,
        string? GroupBy,
        string? SeriesBy,
        string? Faculty,
        string? Program,
        string? Cohort)
    {
        public GraduationAnalyticsQueryCommand ToCommand() => new(
            Scope ?? string.Empty, PeriodId, MetricId ?? string.Empty, GroupBy ?? string.Empty,
            SeriesBy, Faculty, Program, Cohort);
    }

    public sealed record GraduationOverviewRequest(
        string? Faculty,
        string? Program,
        string? Cohort,
        int? FromYear,
        int? ToYear)
    {
        public GraduationOverviewQuery ToQuery() => new(Faculty, Program, Cohort, FromYear, ToYear);
    }
}
