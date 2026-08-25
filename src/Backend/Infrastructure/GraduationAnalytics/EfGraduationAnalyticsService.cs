using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Application;
using Application.GraduationAnalytics;
using Domain;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.GraduationAnalytics;

public sealed partial class EfGraduationAnalyticsService(
    AppDbContext db,
    ICurrentUserAccessor currentUser) : IGraduationAnalyticsService
{
    private const int MaximumRows = 5_000;
    private const int MaximumDatasetsPerQuery = 12;

    private sealed record MetricDefinition(
        string Label,
        string Unit,
        string Aggregation,
        Func<GraduationAnalyticsRow, decimal?> Value,
        Func<GraduationAnalyticsRow, decimal?>? Weight,
        IReadOnlyList<string> ChartTypes);

    private static readonly IReadOnlyDictionary<string, MetricDefinition> Metrics =
        new Dictionary<string, MetricDefinition>(StringComparer.OrdinalIgnoreCase)
        {
            ["initialEnrollment"] = Count("Số SV nhập học ban đầu", x => x.InitialEnrollmentCount),
            ["eligible"] = Count("Số SV được xét tốt nghiệp", x => x.EligibleGraduateCount),
            ["onTimeCount"] = Count("Số SV tốt nghiệp đúng hạn", x => x.OnTimeGraduateCount),
            ["onTimeRate"] = Rate("Tỉ lệ tốt nghiệp đúng hạn", x => x.OnTimeGraduateRate, x => x.InitialEnrollmentCount),
            ["excellentCount"] = Count("Số SV tốt nghiệp xuất sắc", x => x.ExcellentCount),
            ["excellentRate"] = Rate("Tỉ lệ tốt nghiệp xuất sắc", x => x.ExcellentRate, x => x.EligibleGraduateCount),
            ["veryGoodCount"] = Count("Số SV tốt nghiệp giỏi", x => x.VeryGoodCount),
            ["veryGoodRate"] = Rate("Tỉ lệ tốt nghiệp giỏi", x => x.VeryGoodRate, x => x.EligibleGraduateCount),
            ["goodCount"] = Count("Số SV tốt nghiệp khá", x => x.GoodCount),
            ["goodRate"] = Rate("Tỉ lệ tốt nghiệp khá", x => x.GoodRate, x => x.EligibleGraduateCount),
            ["averageCount"] = Count("Số SV tốt nghiệp trung bình", x => x.AverageCount),
            ["averageRate"] = Rate("Tỉ lệ tốt nghiệp trung bình", x => x.AverageRate, x => x.EligibleGraduateCount),
            ["workStudyTransferCount"] = Count("Số SV chuyển VHVL", x => x.WorkStudyTransferCount),
            ["workStudyTransferRate"] = Rate("Tỉ lệ SV chuyển VHVL", x => x.WorkStudyTransferRate, x => x.EligibleGraduateCount),
        };

    private static MetricDefinition Count(
        string label,
        Func<GraduationAnalyticsRow, int?> selector) =>
        new(label, "count", "sum", x => selector(x), null,
            ["bar", "column", "stacked-bar", "stacked-column", "line", "area", "pie", "donut"]);

    private static MetricDefinition Rate(
        string label,
        Func<GraduationAnalyticsRow, decimal?> selector,
        Func<GraduationAnalyticsRow, int?> weightSelector) =>
        new(label, "percent", "weighted-average", x => selector(x), x => weightSelector(x),
            ["bar", "column", "stacked-bar", "stacked-column", "line", "area", "pie", "donut"]);

    public async Task<IReadOnlyList<GraduationDatasetDto>> GetDatasetsAsync(
        CancellationToken cancellationToken) =>
        await db.GraduationAnalyticsDatasets
            .AsNoTracking()
            .OrderByDescending(x => x.ImportedAtUtc)
            .Select(x => ToDatasetDto(x))
            .ToListAsync(cancellationToken);

    public async Task<GraduationAnalyticsFacetsDto> GetFacetsAsync(
        long datasetId,
        CancellationToken cancellationToken)
    {
        if (!await db.GraduationAnalyticsDatasets
                .AsNoTracking()
                .AnyAsync(x => x.DatasetId == datasetId, cancellationToken))
        {
            throw new GraduationAnalyticsException(
                GraduationAnalyticsErrorCodes.DatasetNotFound,
                "Không tìm thấy bộ dữ liệu.");
        }

        var source = await db.GraduationAnalyticsRows
            .AsNoTracking()
            .Where(x => x.DatasetId == datasetId)
            .Select(x => new
            {
                x.FacultyName,
                x.ProgramCode,
                x.ProgramName,
                x.Cohort,
                x.ReviewYear,
            })
            .ToListAsync(cancellationToken);

        var faculties = source
            .Select(x => x.FacultyName)
            .Distinct(StringComparer.CurrentCultureIgnoreCase)
            .OrderBy(x => x, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
        var programs = source
            .GroupBy(x => new { x.FacultyName, x.ProgramCode, x.ProgramName })
            .Select(x => new GraduationProgramOptionDto(
                string.IsNullOrWhiteSpace(x.Key.ProgramCode) ? x.Key.ProgramName : x.Key.ProgramCode,
                string.IsNullOrWhiteSpace(x.Key.ProgramCode)
                    ? x.Key.ProgramName
                    : $"{x.Key.ProgramCode} · {x.Key.ProgramName}",
                x.Key.FacultyName))
            .OrderBy(x => x.FacultyName, StringComparer.CurrentCultureIgnoreCase)
            .ThenBy(x => x.Label, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
        var cohorts = source
            .Select(x => x.Cohort)
            .Distinct(StringComparer.CurrentCultureIgnoreCase)
            .OrderBy(x => x, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
        var years = source
            .Where(x => x.ReviewYear.HasValue)
            .Select(x => x.ReviewYear!.Value)
            .Distinct()
            .OrderBy(x => x)
            .ToList();

        return new GraduationAnalyticsFacetsDto(faculties, programs, cohorts, years);
    }

    public async Task<GraduationImportResultDto> ImportDatasetAsync(
        ImportGraduationDatasetCommand command,
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
                EligibleGraduateCount = row.EligibleGraduateCount,
                OnTimeGraduateCount = row.OnTimeGraduateCount,
                OnTimeGraduateRate = row.OnTimeGraduateRate,
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

        var contentHash = ComputeContentHash(entities);
        var existing = await db.GraduationAnalyticsDatasets
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.ContentHash == contentHash, cancellationToken);
        if (existing is not null)
        {
            throw new GraduationAnalyticsException(
                GraduationAnalyticsErrorCodes.DuplicateImport,
                $"Nội dung này đã được import trong bộ dữ liệu '{existing.DatasetName}'.");
        }

        var importedAt = DateTime.UtcNow;
        var originalFileName = SafeFileName(command.OriginalFileName);
        var dataset = new GraduationAnalyticsDataset
        {
            DatasetName = OptionalText(command.DatasetName)
                ?? $"{Path.GetFileNameWithoutExtension(originalFileName)} · {importedAt:dd/MM/yyyy HH:mm}",
            OriginalFileName = originalFileName,
            ContentHash = contentHash,
            ImportedByUserId = currentUser.UserId ?? Guid.Empty,
            ImportedByName = currentUser.UserEmail ?? "Không xác định",
            ImportedAtUtc = importedAt,
            RowCount = entities.Count,
            MinimumReviewDate = entities.Min(x => new DateOnly(x.ReviewYear!.Value, x.ReviewMonth!.Value, 1)),
            MaximumReviewDate = entities.Max(x => new DateOnly(x.ReviewYear!.Value, x.ReviewMonth!.Value, 1)),
        };

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.GraduationAnalyticsDatasets.Add(dataset);
        await db.SaveChangesAsync(cancellationToken);
        foreach (var entity in entities)
        {
            entity.DatasetId = dataset.DatasetId;
        }
        db.GraduationAnalyticsRows.AddRange(entities);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return new GraduationImportResultDto(ToDatasetDto(dataset));
    }

    public GraduationAnalyticsMetadataDto GetMetadata() => new(
        [
            new("all", "Toàn bộ", "category"),
            new("faculty", "Khoa", "category"),
            new("program", "Chương trình đào tạo", "category"),
            new("cohort", "Khóa", "category"),
            new("reviewYear", "Năm xét tốt nghiệp", "time"),
            new("reviewPeriod", "Thời điểm xét tốt nghiệp", "time"),
            new("dataset", "Bộ dữ liệu", "dataset"),
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
        var datasetIds = command.DatasetIds.Distinct().ToList();
        if (datasetIds.Count == 0 || datasetIds.Count > MaximumDatasetsPerQuery)
        {
            throw new GraduationAnalyticsException(
                GraduationAnalyticsErrorCodes.InvalidQuery,
                $"Hãy chọn từ 1 đến {MaximumDatasetsPerQuery} bộ dữ liệu.");
        }
        if (!Metrics.TryGetValue(command.MetricId, out var metric))
        {
            throw new GraduationAnalyticsException(
                GraduationAnalyticsErrorCodes.InvalidQuery,
                "Chỉ tiêu không hợp lệ.");
        }
        ValidateDimension(command.GroupBy);
        if (!string.IsNullOrWhiteSpace(command.SeriesBy)) ValidateDimension(command.SeriesBy);
        if (!string.IsNullOrWhiteSpace(command.SeriesBy)
            && command.GroupBy.Equals(command.SeriesBy, StringComparison.OrdinalIgnoreCase))
        {
            throw new GraduationAnalyticsException(
                GraduationAnalyticsErrorCodes.InvalidQuery,
                "Chiều so sánh và chiều phân chuỗi phải khác nhau.");
        }

        var datasets = await db.GraduationAnalyticsDatasets
            .AsNoTracking()
            .Where(x => datasetIds.Contains(x.DatasetId))
            .ToDictionaryAsync(x => x.DatasetId, x => x.DatasetName, cancellationToken);
        if (datasets.Count != datasetIds.Count)
        {
            throw new GraduationAnalyticsException(
                GraduationAnalyticsErrorCodes.DatasetNotFound,
                "Không tìm thấy một hoặc nhiều bộ dữ liệu.");
        }

        var rowsQuery = ApplyFilters(
            db.GraduationAnalyticsRows.AsNoTracking().Where(x => datasetIds.Contains(x.DatasetId)),
            command.Faculty,
            command.Program,
            command.Cohort,
            command.ReviewYear,
            command.ReviewMonth);
        var rows = await rowsQuery.ToListAsync(cancellationToken);

        var points = rows
            .GroupBy(x => new
            {
                Group = DimensionValue(x, command.GroupBy, datasets),
                GroupSort = DimensionSortValue(x, command.GroupBy, datasets),
                Series = string.IsNullOrWhiteSpace(command.SeriesBy)
                    ? null
                    : DimensionValue(x, command.SeriesBy, datasets),
                SeriesSort = string.IsNullOrWhiteSpace(command.SeriesBy)
                    ? null
                    : DimensionSortValue(x, command.SeriesBy, datasets),
            })
            .Select(group => new
            {
                Point = Aggregate(group.Key.Group, group.Key.Series, command.MetricId, metric, group),
                group.Key.GroupSort,
                group.Key.SeriesSort,
            })
            .OrderBy(x => x.GroupSort, StringComparer.CurrentCultureIgnoreCase)
            .ThenBy(x => x.SeriesSort, StringComparer.CurrentCultureIgnoreCase)
            .Select(x => x.Point)
            .ToList();

        return new GraduationAnalyticsQueryResultDto(
            command.MetricId,
            metric.Unit,
            command.GroupBy,
            command.SeriesBy,
            points);
    }

    public async Task<GraduationRowsPageDto> GetRowsAsync(
        GraduationRowsQuery query,
        CancellationToken cancellationToken)
    {
        if (!await db.GraduationAnalyticsDatasets.AnyAsync(x => x.DatasetId == query.DatasetId, cancellationToken))
        {
            throw new GraduationAnalyticsException(
                GraduationAnalyticsErrorCodes.DatasetNotFound,
                "Không tìm thấy bộ dữ liệu.");
        }

        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 10, 100);
        var rows = ApplyFilters(
            db.GraduationAnalyticsRows.AsNoTracking().Where(x => x.DatasetId == query.DatasetId),
            query.Faculty,
            query.Program,
            query.Cohort,
            query.ReviewYear,
            null);
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
            .OrderBy(x => x.SourceRowNumber)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => ToRowDto(x))
            .ToListAsync(cancellationToken);
        return new GraduationRowsPageDto(items, page, pageSize, totalCount);
    }

    private static IQueryable<GraduationAnalyticsRow> ApplyFilters(
        IQueryable<GraduationAnalyticsRow> query,
        string? faculty,
        string? program,
        string? cohort,
        int? reviewYear,
        int? reviewMonth)
    {
        if (!string.IsNullOrWhiteSpace(faculty)) query = query.Where(x => x.FacultyName == faculty);
        if (!string.IsNullOrWhiteSpace(program))
            query = query.Where(x => x.ProgramName == program || x.ProgramCode == program);
        if (!string.IsNullOrWhiteSpace(cohort)) query = query.Where(x => x.Cohort == cohort);
        if (reviewYear.HasValue) query = query.Where(x => x.ReviewYear == reviewYear);
        if (reviewMonth.HasValue) query = query.Where(x => x.ReviewMonth == reviewMonth);
        return query;
    }

    private static GraduationAnalyticsPointDto Aggregate(
        string groupName,
        string? series,
        string metricId,
        MetricDefinition metric,
        IEnumerable<GraduationAnalyticsRow> source)
    {
        var rows = source.ToList();
        var values = rows.Select(x => metric.Value(x)).Where(x => x.HasValue).Select(x => x!.Value).ToList();
        if (values.Count == 0)
        {
            return new(groupName, series, metricId, null, metric.Aggregation, 0, rows.Count);
        }

        if (rows.Count == 1)
        {
            return new(groupName, series, metricId, values[0], "source", 1, 1);
        }

        if (metric.Weight is null)
        {
            return new(groupName, series, metricId, values.Sum(), "sum", values.Count, rows.Count);
        }

        var weightedRows = rows
            .Select(x => new { Value = metric.Value(x), Weight = metric.Weight(x) })
            .Where(x => x.Value.HasValue && x.Weight is > 0)
            .ToList();
        var totalWeight = weightedRows.Sum(x => x.Weight!.Value);
        var value = totalWeight > 0
            ? weightedRows.Sum(x => x.Value!.Value * x.Weight!.Value) / totalWeight
            : (decimal?)null;
        return new(groupName, series, metricId, value, "weighted-average", weightedRows.Count, rows.Count);
    }

    private static string DimensionValue(
        GraduationAnalyticsRow row,
        string dimension,
        IReadOnlyDictionary<long, string> datasetNames) =>
        dimension.ToLowerInvariant() switch
        {
            "all" => "Toàn bộ",
            "faculty" => row.FacultyName,
            "program" => string.IsNullOrWhiteSpace(row.ProgramCode)
                ? row.ProgramName
                : $"{row.ProgramCode} · {row.ProgramName}",
            "cohort" => row.Cohort,
            "reviewyear" => row.ReviewYear?.ToString(CultureInfo.InvariantCulture) ?? "Chưa xác định",
            "reviewperiod" => row.ReviewPeriodText,
            "dataset" => datasetNames[row.DatasetId],
            _ => throw new GraduationAnalyticsException(
                GraduationAnalyticsErrorCodes.InvalidQuery,
                "Chiều phân tích không hợp lệ."),
        };

    private static string DimensionSortValue(
        GraduationAnalyticsRow row,
        string dimension,
        IReadOnlyDictionary<long, string> datasetNames) =>
        dimension.ToLowerInvariant() switch
        {
            "reviewyear" => row.ReviewYear?.ToString("D4", CultureInfo.InvariantCulture) ?? "9999",
            "reviewperiod" => row.ReviewYear.HasValue && row.ReviewMonth.HasValue
                ? $"{row.ReviewYear:D4}-{row.ReviewMonth:D2}"
                : "9999-99",
            _ => DimensionValue(row, dimension, datasetNames),
        };

    private static void ValidateDimension(string dimension)
    {
        if (dimension.ToLowerInvariant() is not
            ("all" or "faculty" or "program" or "cohort" or "reviewyear" or "reviewperiod" or "dataset"))
        {
            throw new GraduationAnalyticsException(
                GraduationAnalyticsErrorCodes.InvalidQuery,
                "Chiều phân tích không hợp lệ.");
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
            row.InitialEnrollmentCount, row.EligibleGraduateCount, row.OnTimeGraduateCount,
            row.ExcellentCount, row.VeryGoodCount, row.GoodCount, row.AverageCount,
            row.WorkStudyTransferCount,
        };
        if (values.Any(x => x < 0))
        {
            throw InvalidRow(row.SourceRowNumber, "Các cột số lượng không được là số âm.");
        }
    }

    private static string ComputeContentHash(IEnumerable<GraduationAnalyticsRow> rows)
    {
        var builder = new StringBuilder();
        foreach (var row in rows.OrderBy(x => x.SourceRowNumber))
        {
            Append(builder, row.SourceSheetName, row.SourceRowNumber, row.FacultyName, row.ProgramCode,
                row.ProgramName, row.Cohort, row.InitialEnrollmentCount, row.ReviewPeriodText,
                row.EligibleGraduateCount, row.OnTimeGraduateCount, row.OnTimeGraduateRate,
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

    private static GraduationAnalyticsException InvalidRow(int rowNumber, string message) =>
        new(GraduationAnalyticsErrorCodes.InvalidImport, $"Dòng {rowNumber}: {message}");

    private static GraduationDatasetDto ToDatasetDto(GraduationAnalyticsDataset x) => new(
        x.DatasetId, x.DatasetName, x.OriginalFileName, x.ImportedByName, x.ImportedAtUtc,
        x.RowCount, x.MinimumReviewDate, x.MaximumReviewDate);

    private static GraduationAnalyticsRowDto ToRowDto(GraduationAnalyticsRow x) => new(
        x.RowId, x.DatasetId, x.SourceSheetName, x.SourceRowNumber, x.FacultyName, x.ProgramCode,
        x.ProgramName, x.Cohort, x.InitialEnrollmentCount, x.ReviewPeriodText, x.ReviewMonth,
        x.ReviewYear, x.EligibleGraduateCount, x.OnTimeGraduateCount, x.OnTimeGraduateRate,
        x.ExcellentCount, x.ExcellentRate, x.VeryGoodCount, x.VeryGoodRate, x.GoodCount,
        x.GoodRate, x.AverageCount, x.AverageRate, x.WorkStudyTransferCount,
        x.WorkStudyTransferRate);

    [GeneratedRegex(@"(?:T(?:háng)?\s*)?(\d{1,2})\s*[-/]\s*(\d{4})", RegexOptions.IgnoreCase)]
    private static partial Regex ReviewPeriodRegex();
}
