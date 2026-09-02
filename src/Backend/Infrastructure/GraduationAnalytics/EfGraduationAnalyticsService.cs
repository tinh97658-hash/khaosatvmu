using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Application;
using Application.GraduationAnalytics;
using Domain;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Infrastructure.GraduationAnalytics;

public sealed partial class EfGraduationAnalyticsService(
    AppDbContext db,
    ICurrentUserAccessor currentUser) : IGraduationAnalyticsService
{
    private const int MaximumRows = 5_000;
    private const int MaximumQueryPoints = 500;

    private enum MetricKind
    {
        TotalOutcome,
        ExcellentCount,
        ExcellentRate,
        VeryGoodCount,
        VeryGoodRate,
        GoodCount,
        GoodRate,
        AverageCount,
        AverageRate,
        WorkStudyTransferCount,
        WorkStudyTransferRate,
    }

    private sealed record MetricDefinition(
        string Label,
        string Unit,
        string Aggregation,
        MetricKind Kind,
        IReadOnlyList<string> ChartTypes);

    private sealed class OutcomeAggregate
    {
        public string Group { get; init; } = string.Empty;
        public string? Series { get; init; }
        public int TotalRows { get; init; }
        public int CompleteRows { get; init; }
        public int ExcellentRows { get; init; }
        public int VeryGoodRows { get; init; }
        public int GoodRows { get; init; }
        public int AverageRows { get; init; }
        public int WorkStudyTransferRows { get; init; }
        public decimal TotalOutcome { get; init; }
        public decimal ExcellentCount { get; init; }
        public decimal VeryGoodCount { get; init; }
        public decimal GoodCount { get; init; }
        public decimal AverageCount { get; init; }
        public decimal WorkStudyTransferCount { get; init; }
        public decimal CompleteExcellentCount { get; init; }
        public decimal CompleteVeryGoodCount { get; init; }
        public decimal CompleteGoodCount { get; init; }
        public decimal CompleteAverageCount { get; init; }
        public decimal CompleteWorkStudyTransferCount { get; init; }
    }

    private sealed class CohortYearAggregate
    {
        public int ReviewYear { get; init; }
        public string Cohort { get; init; } = string.Empty;
        public decimal TotalOutcome { get; init; }
        public decimal ExcellentCount { get; init; }
        public decimal VeryGoodCount { get; init; }
        public decimal GoodCount { get; init; }
        public decimal AverageCount { get; init; }
        public decimal WorkStudyTransferCount { get; init; }
        public int IncludedRows { get; init; }
        public int TotalRows { get; init; }
    }

    private static readonly string[] ChartTypes =
        ["bar", "column", "stacked-bar", "stacked-column", "line", "area", "pie", "donut"];

    private static readonly IReadOnlyDictionary<string, MetricDefinition> Metrics =
        new Dictionary<string, MetricDefinition>(StringComparer.OrdinalIgnoreCase)
        {
            ["totalOutcome"] = Count("Tổng số kết quả tốt nghiệp", MetricKind.TotalOutcome),
            ["excellentCount"] = Count("Số SV tốt nghiệp xuất sắc", MetricKind.ExcellentCount),
            ["excellentRate"] = Rate("Tỉ lệ tốt nghiệp xuất sắc", MetricKind.ExcellentRate),
            ["veryGoodCount"] = Count("Số SV tốt nghiệp giỏi", MetricKind.VeryGoodCount),
            ["veryGoodRate"] = Rate("Tỉ lệ tốt nghiệp giỏi", MetricKind.VeryGoodRate),
            ["goodCount"] = Count("Số SV tốt nghiệp khá", MetricKind.GoodCount),
            ["goodRate"] = Rate("Tỉ lệ tốt nghiệp khá", MetricKind.GoodRate),
            ["averageCount"] = Count("Số SV tốt nghiệp trung bình", MetricKind.AverageCount),
            ["averageRate"] = Rate("Tỉ lệ tốt nghiệp trung bình", MetricKind.AverageRate),
            ["workStudyTransferCount"] = Count("Số SV chuyển VHVL", MetricKind.WorkStudyTransferCount),
            ["workStudyTransferRate"] = Rate("Tỉ lệ SV chuyển VHVL", MetricKind.WorkStudyTransferRate),
        };

    private static MetricDefinition Count(string label, MetricKind kind) =>
        new(label, "count", "sum", kind, ChartTypes);

    private static MetricDefinition Rate(string label, MetricKind kind) =>
        new(label, "percent", "ratio-of-sums", kind, ChartTypes);

    public async Task<IReadOnlyList<GraduationPeriodDto>> GetPeriodsAsync(
        CancellationToken cancellationToken) =>
        await db.GraduationAnalyticsDatasets
            .AsNoTracking()
            .OrderByDescending(x => x.ReviewYear)
            .ThenByDescending(x => x.ReviewMonth)
            .Select(x => ToPeriodDto(x))
            .ToListAsync(cancellationToken);

    public async Task<GraduationAnalyticsFacetsDto> GetFacetsAsync(
        string scope,
        long? periodId,
        CancellationToken cancellationToken)
    {
        var source = await ResolveScopeAsync(scope, periodId, cancellationToken);
        var faculties = await source
            .Select(x => x.FacultyName)
            .Distinct()
            .OrderBy(x => x)
            .ToListAsync(cancellationToken);
        var programSource = await source
            .Select(x => new { x.FacultyName, x.ProgramCode, x.ProgramName })
            .Distinct()
            .OrderBy(x => x.FacultyName)
            .ThenBy(x => x.ProgramCode)
            .ThenBy(x => x.ProgramName)
            .ToListAsync(cancellationToken);
        var programs = programSource.Select(x => new GraduationProgramOptionDto(
            string.IsNullOrWhiteSpace(x.ProgramCode) ? x.ProgramName : x.ProgramCode,
            string.IsNullOrWhiteSpace(x.ProgramCode)
                ? x.ProgramName
                : $"{x.ProgramCode} · {x.ProgramName}",
            x.FacultyName)).ToList();
        var cohorts = await source
            .Select(x => x.Cohort)
            .Distinct()
            .OrderBy(x => x)
            .ToListAsync(cancellationToken);
        var years = await source
            .Where(x => x.ReviewYear.HasValue)
            .Select(x => x.ReviewYear!.Value)
            .Distinct()
            .OrderBy(x => x)
            .ToListAsync(cancellationToken);

        return new GraduationAnalyticsFacetsDto(faculties, programs, cohorts, years);
    }

    public async Task<GraduationImportResultDto> ImportPeriodAsync(
        ImportGraduationPeriodCommand command,
        CancellationToken cancellationToken)
    {
        if (command.Rows.Count == 0)
        {
            throw new GraduationAnalyticsException(
                GraduationAnalyticsErrorCodes.InvalidImport,
                "File chưa có dòng dữ liệu nào.");
        }
        if (command.Rows.Count > MaximumRows)
        {
            throw new GraduationAnalyticsException(
                GraduationAnalyticsErrorCodes.TooManyRows,
                $"Mỗi lần chỉ được import tối đa {MaximumRows} dòng.");
        }

        var sourceSheetName = RequiredText(command.SourceSheetName, "Tên sheet");
        var entities = new List<GraduationAnalyticsRow>(command.Rows.Count);
        var sourceRows = new HashSet<int>();
        foreach (var row in command.Rows)
        {
            if (row.SourceRowNumber <= 0 || !sourceRows.Add(row.SourceRowNumber))
            {
                throw InvalidRow(row.SourceRowNumber, "Số dòng nguồn không hợp lệ hoặc bị trùng.");
            }

            var (reviewMonth, reviewYear) = ParseReviewPeriod(row.ReviewPeriodText, row.SourceRowNumber);
            ValidateNonNegativeCounts(row);
            entities.Add(new GraduationAnalyticsRow
            {
                SourceSheetName = sourceSheetName,
                SourceRowNumber = row.SourceRowNumber,
                FacultyName = RequiredText(row.FacultyName, "Tên Khoa", row.SourceRowNumber),
                ProgramCode = OptionalText(row.ProgramCode),
                ProgramName = RequiredText(row.ProgramName, "Tên CTĐT", row.SourceRowNumber),
                Cohort = RequiredText(row.Cohort, "Khóa", row.SourceRowNumber),
                InitialEnrollmentCount = row.InitialEnrollmentCount,
                ReviewPeriodText = RequiredText(row.ReviewPeriodText, "Thời điểm xét Tốt nghiệp", row.SourceRowNumber),
                ReviewMonth = reviewMonth,
                ReviewYear = reviewYear,
                ExcellentCount = row.ExcellentCount,
                ExcellentRate = row.ExcellentRate,
                VeryGoodCount = row.VeryGoodCount,
                VeryGoodRate = row.VeryGoodRate,
                GoodCount = row.GoodCount,
                GoodRate = row.GoodRate,
                AverageCount = row.AverageCount,
                AverageRate = row.AverageRate,
                WorkStudyTransferCount = row.WorkStudyTransferCount,
                WorkStudyTransferRate = row.WorkStudyTransferRate,
            });
        }

        var periods = entities
            .Select(x => new { Month = x.ReviewMonth!.Value, Year = x.ReviewYear!.Value })
            .Distinct()
            .OrderBy(x => x.Year)
            .ThenBy(x => x.Month)
            .ToList();
        if (periods.Count != 1)
        {
            var found = string.Join(", ", periods.Select(x => $"T{x.Month} - {x.Year}"));
            throw new GraduationAnalyticsException(
                GraduationAnalyticsErrorCodes.MultipleReviewPeriods,
                $"Mỗi file chỉ được chứa một đợt tốt nghiệp. Các đợt tìm thấy: {found}.");
        }

        var period = periods[0];
        var periodText = $"T{period.Month} - {period.Year}";
        var existingPeriod = await db.GraduationAnalyticsDatasets
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.ReviewMonth == period.Month && x.ReviewYear == period.Year,
                cancellationToken);
        if (existingPeriod is not null)
        {
            throw PeriodExists(periodText);
        }

        var contentHash = ComputeContentHash(entities);
        var duplicateContent = await db.GraduationAnalyticsDatasets
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.ContentHash == contentHash, cancellationToken);
        if (duplicateContent is not null)
        {
            throw new GraduationAnalyticsException(
                GraduationAnalyticsErrorCodes.PeriodExists,
                $"Nội dung này đã được import trong đợt '{duplicateContent.ReviewPeriodText}'.");
        }

        var importedAt = DateTime.UtcNow;
        var originalFileName = SafeFileName(command.OriginalFileName);
        var dataset = new GraduationAnalyticsDataset
        {
            DatasetName = $"Đợt {periodText}",
            ReviewPeriodText = periodText,
            ReviewMonth = period.Month,
            ReviewYear = period.Year,
            OriginalFileName = originalFileName,
            ContentHash = contentHash,
            ImportedByUserId = currentUser.UserId ?? Guid.Empty,
            ImportedByName = currentUser.UserEmail ?? "Không xác định",
            ImportedAtUtc = importedAt,
            RowCount = entities.Count,
            MinimumReviewDate = new DateOnly(period.Year, period.Month, 1),
            MaximumReviewDate = new DateOnly(period.Year, period.Month, 1),
        };

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            db.GraduationAnalyticsDatasets.Add(dataset);
            await db.SaveChangesAsync(cancellationToken);
            foreach (var entity in entities) entity.DatasetId = dataset.DatasetId;
            db.GraduationAnalyticsRows.AddRange(entities);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (
            exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw PeriodExists(periodText);
        }

        return new GraduationImportResultDto(ToPeriodDto(dataset));
    }

    public GraduationAnalyticsMetadataDto GetMetadata() => new(
        [
            new("faculty", "Khoa", "category"),
            new("program", "Chương trình đào tạo", "category"),
            new("cohort", "Khóa", "category"),
            new("reviewYear", "Năm xét", "time"),
        ],
        Metrics.Select(x => new GraduationMetricDto(
            x.Key,
            x.Value.Label,
            x.Value.Unit,
            x.Value.Aggregation,
            x.Value.ChartTypes)).ToList());

    public async Task<GraduationAnalyticsQueryResultDto> QueryAsync(
        GraduationAnalyticsQueryCommand command,
        CancellationToken cancellationToken)
    {
        if (!Metrics.TryGetValue(command.MetricId, out var metric))
        {
            throw InvalidQuery("Chỉ tiêu không hợp lệ.");
        }
        var rows = await ResolveScopeAsync(command.Scope, command.PeriodId, cancellationToken);
        var allowReviewYear = command.Scope.Trim().Equals(
            GraduationAnalysisScopes.Cumulative,
            StringComparison.OrdinalIgnoreCase);
        ValidateDimension(command.GroupBy, allowReviewYear);
        if (!string.IsNullOrWhiteSpace(command.SeriesBy))
        {
            ValidateDimension(command.SeriesBy, allowReviewYear);
        }
        if (!string.IsNullOrWhiteSpace(command.SeriesBy)
            && command.GroupBy.Equals(command.SeriesBy, StringComparison.OrdinalIgnoreCase))
        {
            throw InvalidQuery("Chiều so sánh và chiều phân chuỗi phải khác nhau.");
        }

        rows = ApplyFilters(rows, command.Faculty, command.Program, command.Cohort);
        var aggregates = await BuildAggregates(rows, command.GroupBy, command.SeriesBy)
            .OrderBy(x => x.Group)
            .ThenBy(x => x.Series)
            .Take(MaximumQueryPoints + 1)
            .ToListAsync(cancellationToken);
        if (aggregates.Count > MaximumQueryPoints)
        {
            throw InvalidQuery(
                $"Biểu đồ tạo hơn {MaximumQueryPoints} điểm. Hãy thu hẹp bộ lọc hoặc bỏ phân chuỗi.");
        }

        var points = aggregates
            .Select(x => ToPoint(x, command.MetricId, metric))
            .ToList();
        return new GraduationAnalyticsQueryResultDto(
            command.MetricId,
            metric.Unit,
            command.GroupBy,
            command.SeriesBy,
            points);
    }

    public async Task<GraduationOverviewDto> GetOverviewAsync(
        GraduationOverviewQuery query,
        CancellationToken cancellationToken)
    {
        ValidateYearRange(query.FromYear, query.ToYear);
        var rows = ApplyFilters(
            db.GraduationAnalyticsRows.AsNoTracking(),
            query.Faculty,
            query.Program,
            query.Cohort);
        if (query.FromYear.HasValue) rows = rows.Where(x => x.ReviewYear >= query.FromYear.Value);
        if (query.ToYear.HasValue) rows = rows.Where(x => x.ReviewYear <= query.ToYear.Value);

        var byCohortAggregates = await BuildAggregates(rows, "cohort", null)
            .OrderBy(x => x.Group)
            .ToListAsync(cancellationToken);
        var cohortYearAggregates = await rows
            .Where(x => x.ReviewYear.HasValue)
            .GroupBy(x => new { x.ReviewYear, x.Cohort })
            .Select(group => new CohortYearAggregate
            {
                ReviewYear = group.Key.ReviewYear!.Value,
                Cohort = group.Key.Cohort,
                TotalOutcome = group.Sum(x =>
                    x.ExcellentCount.HasValue
                    && x.VeryGoodCount.HasValue
                    && x.GoodCount.HasValue
                    && x.AverageCount.HasValue
                    && x.WorkStudyTransferCount.HasValue
                        ? (decimal?)x.ExcellentCount.Value
                          + x.VeryGoodCount.Value
                          + x.GoodCount.Value
                          + x.AverageCount.Value
                          + x.WorkStudyTransferCount.Value
                        : null) ?? 0,
                ExcellentCount = group.Sum(x => (decimal?)x.ExcellentCount) ?? 0,
                VeryGoodCount = group.Sum(x => (decimal?)x.VeryGoodCount) ?? 0,
                GoodCount = group.Sum(x => (decimal?)x.GoodCount) ?? 0,
                AverageCount = group.Sum(x => (decimal?)x.AverageCount) ?? 0,
                WorkStudyTransferCount = group.Sum(x => (decimal?)x.WorkStudyTransferCount) ?? 0,
                IncludedRows = group.Count(x =>
                    x.ExcellentCount.HasValue
                    && x.VeryGoodCount.HasValue
                    && x.GoodCount.HasValue
                    && x.AverageCount.HasValue
                    && x.WorkStudyTransferCount.HasValue),
                TotalRows = group.Count(),
            })
            .OrderBy(x => x.ReviewYear)
            .ThenBy(x => x.Cohort)
            .ToListAsync(cancellationToken);
        var cohortYear = cohortYearAggregates.Select(x => new GraduationCohortYearPointDto(
            x.ReviewYear,
            x.Cohort,
            x.TotalOutcome,
            x.ExcellentCount,
            x.VeryGoodCount,
            x.GoodCount,
            x.AverageCount,
            x.WorkStudyTransferCount,
            x.IncludedRows,
            x.TotalRows)).ToList();

        var periodCount = await rows.Select(x => x.DatasetId).Distinct().CountAsync(cancellationToken);
        var cohortCount = await rows.Select(x => x.Cohort).Distinct().CountAsync(cancellationToken);
        var facultyCount = await rows.Select(x => x.FacultyName).Distinct().CountAsync(cancellationToken);
        var programCount = await rows
            .Select(x => new { x.ProgramCode, x.ProgramName })
            .Distinct()
            .CountAsync(cancellationToken);

        var totalRows = byCohortAggregates.Sum(x => x.TotalRows);
        var includedRows = byCohortAggregates.Sum(x => x.CompleteRows);
        var totalOutcome = byCohortAggregates.Sum(x => x.TotalOutcome);
        var composition = new[]
        {
            OutcomeSummary("excellent", "Xuất sắc", byCohortAggregates.Sum(x => x.ExcellentCount),
                byCohortAggregates.Sum(x => x.CompleteExcellentCount), totalOutcome, includedRows, totalRows),
            OutcomeSummary("veryGood", "Giỏi", byCohortAggregates.Sum(x => x.VeryGoodCount),
                byCohortAggregates.Sum(x => x.CompleteVeryGoodCount), totalOutcome, includedRows, totalRows),
            OutcomeSummary("good", "Khá", byCohortAggregates.Sum(x => x.GoodCount),
                byCohortAggregates.Sum(x => x.CompleteGoodCount), totalOutcome, includedRows, totalRows),
            OutcomeSummary("average", "Trung bình", byCohortAggregates.Sum(x => x.AverageCount),
                byCohortAggregates.Sum(x => x.CompleteAverageCount), totalOutcome, includedRows, totalRows),
            OutcomeSummary("workStudyTransfer", "Chuyển VHVL", byCohortAggregates.Sum(x => x.WorkStudyTransferCount),
                byCohortAggregates.Sum(x => x.CompleteWorkStudyTransferCount), totalOutcome, includedRows, totalRows),
        };
        var byCohort = byCohortAggregates.Select(x => new GraduationOutcomeGroupDto(
            x.Group,
            x.TotalOutcome,
            x.ExcellentCount,
            Ratio(x.CompleteExcellentCount, x.TotalOutcome),
            x.VeryGoodCount,
            Ratio(x.CompleteVeryGoodCount, x.TotalOutcome),
            x.GoodCount,
            Ratio(x.CompleteGoodCount, x.TotalOutcome),
            x.AverageCount,
            Ratio(x.CompleteAverageCount, x.TotalOutcome),
            x.WorkStudyTransferCount,
            Ratio(x.CompleteWorkStudyTransferCount, x.TotalOutcome),
            x.CompleteRows,
            x.TotalRows)).ToList();

        return new GraduationOverviewDto(
            totalOutcome,
            periodCount,
            cohortCount,
            programCount,
            facultyCount,
            includedRows,
            totalRows,
            composition,
            byCohort,
            cohortYear);
    }

    public async Task<GraduationRowsPageDto> GetRowsAsync(
        GraduationRowsQuery query,
        CancellationToken cancellationToken)
    {
        if (!await db.GraduationAnalyticsDatasets
                .AnyAsync(x => x.DatasetId == query.PeriodId, cancellationToken))
        {
            throw new GraduationAnalyticsException(
                GraduationAnalyticsErrorCodes.PeriodNotFound,
                "Không tìm thấy đợt tốt nghiệp.");
        }

        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 10, 100);
        var rows = ApplyFilters(
            db.GraduationAnalyticsRows.AsNoTracking().Where(x => x.DatasetId == query.PeriodId),
            query.Faculty,
            query.Program,
            query.Cohort);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLower();
            rows = rows.Where(x =>
                x.FacultyName.ToLower().Contains(search)
                || x.ProgramName.ToLower().Contains(search)
                || (x.ProgramCode != null && x.ProgramCode.ToLower().Contains(search))
                || x.Cohort.ToLower().Contains(search));
        }

        var totalCount = await rows.CountAsync(cancellationToken);
        var items = await rows
            .OrderBy(x => x.SourceSheetName)
            .ThenBy(x => x.SourceRowNumber)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => ToRowDto(x))
            .ToListAsync(cancellationToken);
        return new GraduationRowsPageDto(items, page, pageSize, totalCount);
    }

    private async Task<IQueryable<GraduationAnalyticsRow>> ResolveScopeAsync(
        string scope,
        long? periodId,
        CancellationToken cancellationToken)
    {
        var normalizedScope = scope?.Trim().ToLowerInvariant();
        if (normalizedScope == GraduationAnalysisScopes.Cumulative)
        {
            if (periodId.HasValue) throw InvalidQuery("Scope tích lũy không nhận periodId.");
            return db.GraduationAnalyticsRows.AsNoTracking();
        }
        if (normalizedScope != GraduationAnalysisScopes.Period || periodId is null or <= 0)
        {
            throw InvalidQuery("Scope phải là cumulative hoặc period kèm periodId hợp lệ.");
        }
        if (!await db.GraduationAnalyticsDatasets
                .AsNoTracking()
                .AnyAsync(x => x.DatasetId == periodId.Value, cancellationToken))
        {
            throw new GraduationAnalyticsException(
                GraduationAnalyticsErrorCodes.PeriodNotFound,
                "Không tìm thấy đợt tốt nghiệp.");
        }
        return db.GraduationAnalyticsRows
            .AsNoTracking()
            .Where(x => x.DatasetId == periodId.Value);
    }

    private static IQueryable<GraduationAnalyticsRow> ApplyFilters(
        IQueryable<GraduationAnalyticsRow> query,
        string? faculty,
        string? program,
        string? cohort)
    {
        if (!string.IsNullOrWhiteSpace(faculty)) query = query.Where(x => x.FacultyName == faculty);
        if (!string.IsNullOrWhiteSpace(program))
            query = query.Where(x => x.ProgramName == program || x.ProgramCode == program);
        if (!string.IsNullOrWhiteSpace(cohort)) query = query.Where(x => x.Cohort == cohort);
        return query;
    }

    private static IQueryable<OutcomeAggregate> BuildAggregates(
        IQueryable<GraduationAnalyticsRow> rows,
        string groupBy,
        string? seriesBy)
    {
        var normalizedGroup = groupBy.ToLowerInvariant();
        var normalizedSeries = seriesBy?.ToLowerInvariant();
        var projected = rows.Select(row => new
        {
            Group = normalizedGroup == "faculty"
                ? row.FacultyName
                : normalizedGroup == "program"
                    ? (row.ProgramCode == null || row.ProgramCode == string.Empty
                        ? row.ProgramName
                        : row.ProgramCode + " · " + row.ProgramName)
                    : normalizedGroup == "reviewyear"
                        ? row.ReviewYear!.Value.ToString()
                        : row.Cohort,
            Series = normalizedSeries == null
                ? null
                : normalizedSeries == "faculty"
                    ? row.FacultyName
                    : normalizedSeries == "program"
                        ? (row.ProgramCode == null || row.ProgramCode == string.Empty
                            ? row.ProgramName
                            : row.ProgramCode + " · " + row.ProgramName)
                        : normalizedSeries == "reviewyear"
                            ? row.ReviewYear!.Value.ToString()
                            : row.Cohort,
            row.ExcellentCount,
            row.VeryGoodCount,
            row.GoodCount,
            row.AverageCount,
            row.WorkStudyTransferCount,
        });

        return projected
            .GroupBy(x => new { x.Group, x.Series })
            .Select(group => new OutcomeAggregate
            {
                Group = group.Key.Group,
                Series = group.Key.Series,
                TotalRows = group.Count(),
                CompleteRows = group.Count(x =>
                    x.ExcellentCount.HasValue
                    && x.VeryGoodCount.HasValue
                    && x.GoodCount.HasValue
                    && x.AverageCount.HasValue
                    && x.WorkStudyTransferCount.HasValue),
                ExcellentRows = group.Count(x => x.ExcellentCount.HasValue),
                VeryGoodRows = group.Count(x => x.VeryGoodCount.HasValue),
                GoodRows = group.Count(x => x.GoodCount.HasValue),
                AverageRows = group.Count(x => x.AverageCount.HasValue),
                WorkStudyTransferRows = group.Count(x => x.WorkStudyTransferCount.HasValue),
                TotalOutcome = group.Sum(x =>
                    x.ExcellentCount.HasValue
                    && x.VeryGoodCount.HasValue
                    && x.GoodCount.HasValue
                    && x.AverageCount.HasValue
                    && x.WorkStudyTransferCount.HasValue
                        ? (decimal?)x.ExcellentCount.Value
                          + x.VeryGoodCount.Value
                          + x.GoodCount.Value
                          + x.AverageCount.Value
                          + x.WorkStudyTransferCount.Value
                        : null) ?? 0,
                ExcellentCount = group.Sum(x => (decimal?)x.ExcellentCount) ?? 0,
                VeryGoodCount = group.Sum(x => (decimal?)x.VeryGoodCount) ?? 0,
                GoodCount = group.Sum(x => (decimal?)x.GoodCount) ?? 0,
                AverageCount = group.Sum(x => (decimal?)x.AverageCount) ?? 0,
                WorkStudyTransferCount = group.Sum(x => (decimal?)x.WorkStudyTransferCount) ?? 0,
                CompleteExcellentCount = group.Sum(x =>
                    x.ExcellentCount.HasValue
                    && x.VeryGoodCount.HasValue
                    && x.GoodCount.HasValue
                    && x.AverageCount.HasValue
                    && x.WorkStudyTransferCount.HasValue
                        ? (decimal?)x.ExcellentCount.Value
                        : null) ?? 0,
                CompleteVeryGoodCount = group.Sum(x =>
                    x.ExcellentCount.HasValue
                    && x.VeryGoodCount.HasValue
                    && x.GoodCount.HasValue
                    && x.AverageCount.HasValue
                    && x.WorkStudyTransferCount.HasValue
                        ? (decimal?)x.VeryGoodCount.Value
                        : null) ?? 0,
                CompleteGoodCount = group.Sum(x =>
                    x.ExcellentCount.HasValue
                    && x.VeryGoodCount.HasValue
                    && x.GoodCount.HasValue
                    && x.AverageCount.HasValue
                    && x.WorkStudyTransferCount.HasValue
                        ? (decimal?)x.GoodCount.Value
                        : null) ?? 0,
                CompleteAverageCount = group.Sum(x =>
                    x.ExcellentCount.HasValue
                    && x.VeryGoodCount.HasValue
                    && x.GoodCount.HasValue
                    && x.AverageCount.HasValue
                    && x.WorkStudyTransferCount.HasValue
                        ? (decimal?)x.AverageCount.Value
                        : null) ?? 0,
                CompleteWorkStudyTransferCount = group.Sum(x =>
                    x.ExcellentCount.HasValue
                    && x.VeryGoodCount.HasValue
                    && x.GoodCount.HasValue
                    && x.AverageCount.HasValue
                    && x.WorkStudyTransferCount.HasValue
                        ? (decimal?)x.WorkStudyTransferCount.Value
                        : null) ?? 0,
            });
    }

    private static GraduationAnalyticsPointDto ToPoint(
        OutcomeAggregate aggregate,
        string metricId,
        MetricDefinition metric)
    {
        var (value, includedRows) = metric.Kind switch
        {
            MetricKind.TotalOutcome => ((decimal?)aggregate.TotalOutcome, aggregate.CompleteRows),
            MetricKind.ExcellentCount => (aggregate.ExcellentCount, aggregate.ExcellentRows),
            MetricKind.VeryGoodCount => (aggregate.VeryGoodCount, aggregate.VeryGoodRows),
            MetricKind.GoodCount => (aggregate.GoodCount, aggregate.GoodRows),
            MetricKind.AverageCount => (aggregate.AverageCount, aggregate.AverageRows),
            MetricKind.WorkStudyTransferCount =>
                (aggregate.WorkStudyTransferCount, aggregate.WorkStudyTransferRows),
            MetricKind.ExcellentRate =>
                (Ratio(aggregate.CompleteExcellentCount, aggregate.TotalOutcome), aggregate.CompleteRows),
            MetricKind.VeryGoodRate =>
                (Ratio(aggregate.CompleteVeryGoodCount, aggregate.TotalOutcome), aggregate.CompleteRows),
            MetricKind.GoodRate =>
                (Ratio(aggregate.CompleteGoodCount, aggregate.TotalOutcome), aggregate.CompleteRows),
            MetricKind.AverageRate =>
                (Ratio(aggregate.CompleteAverageCount, aggregate.TotalOutcome), aggregate.CompleteRows),
            MetricKind.WorkStudyTransferRate =>
                (Ratio(aggregate.CompleteWorkStudyTransferCount, aggregate.TotalOutcome), aggregate.CompleteRows),
            _ => throw InvalidQuery("Chỉ tiêu không hợp lệ."),
        };
        return new GraduationAnalyticsPointDto(
            aggregate.Group,
            aggregate.Series,
            metricId,
            value,
            metric.Aggregation,
            includedRows,
            aggregate.TotalRows);
    }

    private static GraduationOutcomeSummaryDto OutcomeSummary(
        string metricId,
        string label,
        decimal count,
        decimal completeCount,
        decimal totalOutcome,
        int includedRows,
        int totalRows) =>
        new(metricId, label, count, Ratio(completeCount, totalOutcome), includedRows, totalRows);

    private static decimal? Ratio(decimal numerator, decimal denominator) =>
        denominator > 0 ? numerator / denominator * 100 : null;

    private static void ValidateDimension(string dimension, bool allowReviewYear)
    {
        var normalized = dimension.ToLowerInvariant();
        if (normalized is "reviewyear" && !allowReviewYear)
        {
            throw InvalidQuery("Năm xét chỉ dùng được khi phân tích tích lũy tất cả các đợt.");
        }
        if (normalized is not ("faculty" or "program" or "cohort" or "reviewyear"))
        {
            throw InvalidQuery("Chiều phân tích chỉ gồm Khoa, Chương trình đào tạo, Khóa hoặc Năm xét.");
        }
    }

    private static void ValidateYearRange(int? fromYear, int? toYear)
    {
        if (fromYear is < 1900 or > 2200
            || toYear is < 1900 or > 2200
            || fromYear.HasValue && toYear.HasValue && fromYear > toYear)
        {
            throw InvalidQuery("Khoảng năm xét tốt nghiệp không hợp lệ.");
        }
    }

    private static (int Month, int Year) ParseReviewPeriod(string value, int rowNumber)
    {
        var match = ReviewPeriodRegex().Match(value ?? string.Empty);
        if (!match.Success
            || !int.TryParse(match.Groups[1].Value, out var month)
            || !int.TryParse(match.Groups[2].Value, out var year)
            || month is < 1 or > 12
            || year is < 1900 or > 2200)
        {
            throw InvalidRow(rowNumber, "Thời điểm xét tốt nghiệp phải có dạng T7 - 2026.");
        }
        return (month, year);
    }

    private static void ValidateNonNegativeCounts(GraduationImportRowCommand row)
    {
        var values = new int?[]
        {
            row.InitialEnrollmentCount, row.ExcellentCount, row.VeryGoodCount, row.GoodCount,
            row.AverageCount, row.WorkStudyTransferCount,
        };
        if (values.Any(x => x < 0))
        {
            throw InvalidRow(row.SourceRowNumber, "Các cột số lượng không được là số âm.");
        }
    }

    private static string ComputeContentHash(IEnumerable<GraduationAnalyticsRow> rows)
    {
        var builder = new StringBuilder();
        foreach (var row in rows.OrderBy(x => x.SourceSheetName).ThenBy(x => x.SourceRowNumber))
        {
            Append(builder, row.SourceSheetName, row.SourceRowNumber, row.FacultyName, row.ProgramCode,
                row.ProgramName, row.Cohort, row.InitialEnrollmentCount, row.ReviewMonth, row.ReviewYear,
                row.ExcellentCount, row.ExcellentRate, row.VeryGoodCount, row.VeryGoodRate,
                row.GoodCount, row.GoodRate, row.AverageCount, row.AverageRate,
                row.WorkStudyTransferCount, row.WorkStudyTransferRate);
        }
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(builder.ToString()))).ToLowerInvariant();
    }

    private static void Append(StringBuilder builder, params object?[] values)
    {
        foreach (var value in values)
        {
            builder.Append(value switch
            {
                decimal number => number.ToString("G29", CultureInfo.InvariantCulture),
                IFormattable formattable => formattable.ToString(null, CultureInfo.InvariantCulture),
                _ => value?.ToString()?.Trim(),
            });
            builder.Append('\u001f');
        }
        builder.AppendLine();
    }

    private static string RequiredText(string? value, string field, int? rowNumber = null)
    {
        var normalized = OptionalText(value);
        if (normalized is not null) return normalized;
        var prefix = rowNumber.HasValue ? $"Dòng {rowNumber}: " : string.Empty;
        throw new GraduationAnalyticsException(
            GraduationAnalyticsErrorCodes.InvalidImport,
            $"{prefix}{field} không được để trống.");
    }

    private static string? OptionalText(string? value)
    {
        var normalized = value?.Trim();
        return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
    }

    private static string SafeFileName(string value)
    {
        var normalized = RequiredText(value, "Tên file").Replace('\\', '/');
        return normalized.Split('/').Last();
    }

    private static GraduationAnalyticsException PeriodExists(string periodText) =>
        new(GraduationAnalyticsErrorCodes.PeriodExists, $"Đợt {periodText} đã được import.");

    private static GraduationAnalyticsException InvalidRow(int rowNumber, string message) =>
        new(GraduationAnalyticsErrorCodes.InvalidImport, $"Dòng {rowNumber}: {message}");

    private static GraduationAnalyticsException InvalidQuery(string message) =>
        new(GraduationAnalyticsErrorCodes.InvalidQuery, message);

    private static GraduationPeriodDto ToPeriodDto(GraduationAnalyticsDataset x) => new(
        x.DatasetId, x.ReviewPeriodText, x.ReviewMonth, x.ReviewYear, x.OriginalFileName,
        x.ImportedByName, x.ImportedAtUtc, x.RowCount);

    private static GraduationAnalyticsRowDto ToRowDto(GraduationAnalyticsRow x) => new(
        x.RowId, x.DatasetId, x.SourceSheetName, x.SourceRowNumber, x.FacultyName, x.ProgramCode,
        x.ProgramName, x.Cohort, x.InitialEnrollmentCount, x.ReviewPeriodText, x.ReviewMonth,
        x.ReviewYear, x.ExcellentCount, x.ExcellentRate, x.VeryGoodCount, x.VeryGoodRate, x.GoodCount,
        x.GoodRate, x.AverageCount, x.AverageRate, x.WorkStudyTransferCount,
        x.WorkStudyTransferRate);

    [GeneratedRegex(@"^(?:T(?:háng)?\s*)?(\d{1,2})\s*[-/]\s*(\d{4})$", RegexOptions.IgnoreCase)]
    private static partial Regex ReviewPeriodRegex();
}
