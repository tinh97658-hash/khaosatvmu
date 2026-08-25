namespace Application.GraduationAnalytics;

public static class GraduationAnalyticsErrorCodes
{
    public const string InvalidImport = "GRADUATION_IMPORT_INVALID";
    public const string DuplicateImport = "GRADUATION_IMPORT_DUPLICATE";
    public const string TooManyRows = "GRADUATION_IMPORT_TOO_LARGE";
    public const string DatasetNotFound = "GRADUATION_DATASET_NOT_FOUND";
    public const string InvalidQuery = "GRADUATION_QUERY_INVALID";
}

public sealed class GraduationAnalyticsException(string errorCode, string message)
    : Exception(message)
{
    public string ErrorCode { get; } = errorCode;
}

public sealed record GraduationImportRowCommand(
    int SourceRowNumber,
    string FacultyName,
    string? ProgramCode,
    string ProgramName,
    string Cohort,
    int? InitialEnrollmentCount,
    string ReviewPeriodText,
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
    decimal? WorkStudyTransferRate);

public sealed record ImportGraduationDatasetCommand(
    string DatasetName,
    string OriginalFileName,
    string SourceSheetName,
    IReadOnlyList<GraduationImportRowCommand> Rows);

public sealed record GraduationDatasetDto(
    long DatasetId,
    string DatasetName,
    string OriginalFileName,
    string ImportedByName,
    DateTime ImportedAtUtc,
    int RowCount,
    DateOnly? MinimumReviewDate,
    DateOnly? MaximumReviewDate);

public sealed record GraduationImportResultDto(GraduationDatasetDto Dataset);

public sealed record GraduationProgramOptionDto(
    string Value,
    string Label,
    string FacultyName);

public sealed record GraduationAnalyticsFacetsDto(
    IReadOnlyList<string> Faculties,
    IReadOnlyList<GraduationProgramOptionDto> Programs,
    IReadOnlyList<string> Cohorts,
    IReadOnlyList<int> ReviewYears);

public sealed record GraduationAnalyticsRowDto(
    long RowId,
    long DatasetId,
    string SourceSheetName,
    int SourceRowNumber,
    string FacultyName,
    string? ProgramCode,
    string ProgramName,
    string Cohort,
    int? InitialEnrollmentCount,
    string ReviewPeriodText,
    int? ReviewMonth,
    int? ReviewYear,
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
    decimal? WorkStudyTransferRate);

public sealed record GraduationRowsQuery(
    long DatasetId,
    string? Search,
    string? Faculty,
    string? Program,
    string? Cohort,
    int? ReviewYear,
    int Page,
    int PageSize);

public sealed record GraduationRowsPageDto(
    IReadOnlyList<GraduationAnalyticsRowDto> Items,
    int Page,
    int PageSize,
    int TotalCount);

public sealed record GraduationAnalyticsQueryCommand(
    IReadOnlyList<long> DatasetIds,
    string MetricId,
    string GroupBy,
    string? SeriesBy,
    string? Faculty,
    string? Program,
    string? Cohort,
    int? ReviewYear,
    int? ReviewMonth);

public sealed record GraduationAnalyticsPointDto(
    string Group,
    string? Series,
    string MetricId,
    decimal? Value,
    string Aggregation,
    int IncludedRows,
    int TotalRows);

public sealed record GraduationAnalyticsQueryResultDto(
    string MetricId,
    string Unit,
    string GroupBy,
    string? SeriesBy,
    IReadOnlyList<GraduationAnalyticsPointDto> Points);

public sealed record GraduationDimensionDto(string Id, string Label, string Type);
public sealed record GraduationMetricDto(
    string Id,
    string Label,
    string Unit,
    string Aggregation,
    IReadOnlyList<string> ChartTypes);
public sealed record GraduationAnalyticsMetadataDto(
    IReadOnlyList<GraduationDimensionDto> Dimensions,
    IReadOnlyList<GraduationMetricDto> Metrics);

public interface IGraduationAnalyticsService
{
    Task<IReadOnlyList<GraduationDatasetDto>> GetDatasetsAsync(CancellationToken cancellationToken);
    Task<GraduationAnalyticsFacetsDto> GetFacetsAsync(
        long datasetId,
        CancellationToken cancellationToken);
    Task<GraduationImportResultDto> ImportDatasetAsync(
        ImportGraduationDatasetCommand command,
        CancellationToken cancellationToken);
    GraduationAnalyticsMetadataDto GetMetadata();
    Task<GraduationAnalyticsQueryResultDto> QueryAsync(
        GraduationAnalyticsQueryCommand command,
        CancellationToken cancellationToken);
    Task<GraduationRowsPageDto> GetRowsAsync(
        GraduationRowsQuery query,
        CancellationToken cancellationToken);
}
