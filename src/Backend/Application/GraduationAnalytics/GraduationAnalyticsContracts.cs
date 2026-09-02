namespace Application.GraduationAnalytics;

public static class GraduationAnalyticsErrorCodes
{
    public const string InvalidImport = "GRADUATION_IMPORT_INVALID";
    public const string TooManyRows = "GRADUATION_IMPORT_TOO_LARGE";
    public const string MultipleReviewPeriods = "MULTIPLE_REVIEW_PERIODS";
    public const string LegacyStructureUnsupported = "LEGACY_STRUCTURE_UNSUPPORTED";
    public const string PeriodExists = "GRADUATION_PERIOD_EXISTS";
    public const string PeriodNotFound = "GRADUATION_PERIOD_NOT_FOUND";
    public const string InvalidQuery = "GRADUATION_QUERY_INVALID";
}

public sealed class GraduationAnalyticsException(string errorCode, string message)
    : Exception(message)
{
    public string ErrorCode { get; } = errorCode;
}

public static class GraduationAnalysisScopes
{
    public const string Cumulative = "cumulative";
    public const string Period = "period";
}

public sealed record GraduationImportRowCommand(
    int SourceRowNumber,
    string FacultyName,
    string? ProgramCode,
    string ProgramName,
    string Cohort,
    int? InitialEnrollmentCount,
    string ReviewPeriodText,
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

public sealed record ImportGraduationPeriodCommand(
    string OriginalFileName,
    string SourceSheetName,
    IReadOnlyList<GraduationImportRowCommand> Rows);

public sealed record GraduationPeriodDto(
    long PeriodId,
    string Label,
    int ReviewMonth,
    int ReviewYear,
    string OriginalFileName,
    string ImportedByName,
    DateTime ImportedAtUtc,
    int RowCount);

public sealed record GraduationImportResultDto(GraduationPeriodDto Period);

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
    long PeriodId,
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
    long PeriodId,
    string? Search,
    string? Faculty,
    string? Program,
    string? Cohort,
    int Page,
    int PageSize);

public sealed record GraduationRowsPageDto(
    IReadOnlyList<GraduationAnalyticsRowDto> Items,
    int Page,
    int PageSize,
    int TotalCount);

public sealed record GraduationAnalyticsQueryCommand(
    string Scope,
    long? PeriodId,
    string MetricId,
    string GroupBy,
    string? SeriesBy,
    string? Faculty,
    string? Program,
    string? Cohort);

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

public sealed record GraduationOverviewQuery(
    string? Faculty,
    string? Program,
    string? Cohort,
    int? FromYear,
    int? ToYear);

public sealed record GraduationOutcomeSummaryDto(
    string MetricId,
    string Label,
    decimal Count,
    decimal? Rate,
    int IncludedRows,
    int TotalRows);

public sealed record GraduationOutcomeGroupDto(
    string Group,
    decimal TotalOutcome,
    decimal ExcellentCount,
    decimal? ExcellentRate,
    decimal VeryGoodCount,
    decimal? VeryGoodRate,
    decimal GoodCount,
    decimal? GoodRate,
    decimal AverageCount,
    decimal? AverageRate,
    decimal WorkStudyTransferCount,
    decimal? WorkStudyTransferRate,
    int IncludedRows,
    int TotalRows);

public sealed record GraduationCohortYearPointDto(
    int ReviewYear,
    string Cohort,
    decimal TotalOutcome,
    decimal ExcellentCount,
    decimal VeryGoodCount,
    decimal GoodCount,
    decimal AverageCount,
    decimal WorkStudyTransferCount,
    int IncludedRows,
    int TotalRows);

public sealed record GraduationOverviewDto(
    decimal TotalOutcome,
    int PeriodCount,
    int CohortCount,
    int ProgramCount,
    int FacultyCount,
    int IncludedRows,
    int TotalRows,
    IReadOnlyList<GraduationOutcomeSummaryDto> Composition,
    IReadOnlyList<GraduationOutcomeGroupDto> ByCohort,
    IReadOnlyList<GraduationCohortYearPointDto> CohortYear);

public interface IGraduationAnalyticsService
{
    Task<IReadOnlyList<GraduationPeriodDto>> GetPeriodsAsync(CancellationToken cancellationToken);
    Task<GraduationAnalyticsFacetsDto> GetFacetsAsync(
        string scope,
        long? periodId,
        CancellationToken cancellationToken);
    Task<GraduationImportResultDto> ImportPeriodAsync(
        ImportGraduationPeriodCommand command,
        CancellationToken cancellationToken);
    GraduationAnalyticsMetadataDto GetMetadata();
    Task<GraduationAnalyticsQueryResultDto> QueryAsync(
        GraduationAnalyticsQueryCommand command,
        CancellationToken cancellationToken);
    Task<GraduationOverviewDto> GetOverviewAsync(
        GraduationOverviewQuery query,
        CancellationToken cancellationToken);
    Task<GraduationRowsPageDto> GetRowsAsync(
        GraduationRowsQuery query,
        CancellationToken cancellationToken);
}
