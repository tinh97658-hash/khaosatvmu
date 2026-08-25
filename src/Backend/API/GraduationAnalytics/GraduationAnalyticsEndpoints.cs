using API.Auth;
using Application.GraduationAnalytics;

namespace API.GraduationAnalytics;

public static class GraduationAnalyticsEndpoints
{
    public static IEndpointRouteBuilder MapGraduationAnalyticsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/graduation-analytics")
            .RequireAuthorization(AuthPolicies.GraduationAnalyticsAccess);

        group.MapGet("/datasets", async (IGraduationAnalyticsService service, CancellationToken ct) =>
            Results.Ok(await service.GetDatasetsAsync(ct)));

        group.MapGet("/metadata", (IGraduationAnalyticsService service) =>
            Results.Ok(service.GetMetadata()));

        group.MapPost("/datasets", async (
            ImportGraduationDatasetRequest request,
            IGraduationAnalyticsService service,
            CancellationToken ct) =>
        {
            try
            {
                var command = new ImportGraduationDatasetCommand(
                    request.DatasetName ?? string.Empty,
                    request.OriginalFileName ?? string.Empty,
                    request.SourceSheetName ?? string.Empty,
                    request.Rows?.Select(x => x.ToCommand()).ToList() ?? []);
                return Results.Ok(await service.ImportDatasetAsync(command, ct));
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

        group.MapGet("/datasets/{datasetId:long}/rows", async (
            long datasetId,
            string? search,
            string? faculty,
            string? program,
            string? cohort,
            int? reviewYear,
            int page,
            int pageSize,
            IGraduationAnalyticsService service,
            CancellationToken ct) =>
        {
            try
            {
                return Results.Ok(await service.GetRowsAsync(
                    new GraduationRowsQuery(datasetId, search, faculty, program, cohort, reviewYear, page, pageSize),
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
            GraduationAnalyticsErrorCodes.DuplicateImport => StatusCodes.Status409Conflict,
            GraduationAnalyticsErrorCodes.DatasetNotFound => StatusCodes.Status404NotFound,
            _ => StatusCodes.Status400BadRequest,
        };
        return Results.Json(new { errorCode = exception.ErrorCode, message = exception.Message }, statusCode: statusCode);
    }

    public sealed record ImportGraduationDatasetRequest(
        string? DatasetName,
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
        public GraduationImportRowCommand ToCommand() => new(
            SourceRowNumber, FacultyName ?? string.Empty, ProgramCode, ProgramName ?? string.Empty,
            Cohort ?? string.Empty, InitialEnrollmentCount, ReviewPeriodText ?? string.Empty,
            EligibleGraduateCount, OnTimeGraduateCount, OnTimeGraduateRate, ExcellentCount,
            ExcellentRate, VeryGoodCount, VeryGoodRate, GoodCount, GoodRate, AverageCount,
            AverageRate, WorkStudyTransferCount, WorkStudyTransferRate);
    }

    public sealed record GraduationAnalyticsQueryRequest(
        IReadOnlyList<long>? DatasetIds,
        string? MetricId,
        string? GroupBy,
        string? SeriesBy,
        string? Faculty,
        string? Program,
        string? Cohort,
        int? ReviewYear,
        int? ReviewMonth)
    {
        public GraduationAnalyticsQueryCommand ToCommand() => new(
            DatasetIds ?? [], MetricId ?? string.Empty, GroupBy ?? string.Empty, SeriesBy,
            Faculty, Program, Cohort, ReviewYear, ReviewMonth);
    }
}
