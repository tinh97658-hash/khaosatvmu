namespace UnitTests.InfrastructureTests;

using Application;
using Application.GraduationAnalytics;
using FluentAssertions;
using global::Infrastructure.GraduationAnalytics;
using global::Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

public sealed class GraduationAnalyticsDatabaseIntegrationTests
{
    [Fact]
    public async Task ImportQueryDuplicateNullZeroAndMultiplePeriods_WorkEndToEnd()
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString)) return;

        var prefix = $"codex-graduation-{Guid.NewGuid():N}";
        try
        {
            await using var db = CreateContext(connectionString);
            var periods = await FindAvailablePeriodsAsync(db, 2);
            var firstPeriod = periods[0];
            var secondPeriod = periods[1];
            var service = new EfGraduationAnalyticsService(db, new TestCurrentUser());
            var first = await service.ImportPeriodAsync(new ImportGraduationPeriodCommand(
                $"{prefix}-1.xlsx", "Sheet1",
                [
                    Row(7, "Khoa A", "A01", "Ngành A1", "K20", firstPeriod.Text, 100, 40, 50, averageCount: null, workStudyCount: 0),
                    Row(8, "Khoa A", "A02", "Ngành A2", "K21", firstPeriod.Text, 120, 60, 66.7m, averageCount: 3, workStudyCount: 1),
                    Row(9, "Khoa B", "B01", "Ngành B1", "K20", firstPeriod.Text, 80, 25, 50, averageCount: 2, workStudyCount: 0),
                ]), CancellationToken.None);
            var second = await service.ImportPeriodAsync(new ImportGraduationPeriodCommand(
                $"{prefix}-2.xlsx", "Sheet1",
                [Row(7, "Khoa A", "A01", "Ngành A1", "K22", secondPeriod.Text, 60, 30, 75, averageCount: 1, workStudyCount: 0)]),
                CancellationToken.None);

            first.Period.Label.Should().Be(firstPeriod.Text);
            first.Period.ReviewMonth.Should().Be(firstPeriod.Month);
            first.Period.ReviewYear.Should().Be(firstPeriod.Year);

            var faculty = await service.QueryAsync(new GraduationAnalyticsQueryCommand(
                [first.Period.PeriodId], "excellentCount", "faculty", null,
                null, null, null, null, null), CancellationToken.None);
            faculty.Points.Single(x => x.Group == "Khoa A").Value.Should().Be(100);
            faculty.Points.Single(x => x.Group == "Khoa B").Value.Should().Be(25);

            var programInFaculty = await service.QueryAsync(new GraduationAnalyticsQueryCommand(
                [first.Period.PeriodId], "excellentRate", "program", null,
                "Khoa A", null, null, null, null), CancellationToken.None);
            programInFaculty.Points.Should().HaveCount(2);

            var datasets = await service.QueryAsync(new GraduationAnalyticsQueryCommand(
                [first.Period.PeriodId, second.Period.PeriodId], "excellentCount", "dataset", null,
                null, null, null, null, null), CancellationToken.None);
            datasets.Points.Should().HaveCount(2);

            var sourceRows = await service.GetRowsAsync(new GraduationRowsQuery(
                first.Period.PeriodId, null, "Khoa A", "A01", null, 1, 25),
                CancellationToken.None);
            sourceRows.Items.Should().ContainSingle();
            sourceRows.Items[0].AverageCount.Should().BeNull();
            sourceRows.Items[0].WorkStudyTransferCount.Should().Be(0);

            var duplicate = () => service.ImportPeriodAsync(new ImportGraduationPeriodCommand(
                $"{prefix}-duplicate.xlsx", "Sheet1",
                [Row(7, "Khoa C", "C01", "Ngành C1", "K20", firstPeriod.Text, 50, 5, 10, 1, 0)]),
                CancellationToken.None);
            var exception = await duplicate.Should().ThrowAsync<GraduationAnalyticsException>();
            exception.Which.ErrorCode.Should().Be(GraduationAnalyticsErrorCodes.PeriodExists);
        }
        finally
        {
            await DeleteTestPeriodsAsync(connectionString, prefix);
        }
    }

    [Fact]
    public async Task ImportTransaction_RollsBackPeriodWhenRowsSaveFails()
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString)) return;

        var prefix = $"codex-graduation-rollback-{Guid.NewGuid():N}";
        var interceptor = new FailOnSecondSaveInterceptor();
        await using (var db = CreateContext(connectionString, interceptor))
        {
            var period = (await FindAvailablePeriodsAsync(db, 1))[0];
            var service = new EfGraduationAnalyticsService(db, new TestCurrentUser());
            var action = () => service.ImportPeriodAsync(new ImportGraduationPeriodCommand(
                $"{prefix}.xlsx", "Sheet1",
                [Row(7, "Khoa A", "A01", "Ngành A1", "K20", period.Text, 10, 4, 50, null, 0)]),
                CancellationToken.None);

            await action.Should().ThrowAsync<InvalidOperationException>();
        }

        await using var verification = CreateContext(connectionString);
        (await verification.GraduationAnalyticsDatasets.AnyAsync(x => x.OriginalFileName.StartsWith(prefix)))
            .Should().BeFalse();
    }

    private static AppDbContext CreateContext(string connectionString, SaveChangesInterceptor? interceptor = null)
    {
        var builder = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connectionString);
        if (interceptor is not null) builder.AddInterceptors(interceptor);
        return new AppDbContext(builder.Options);
    }

    private static async Task<IReadOnlyList<TestPeriod>> FindAvailablePeriodsAsync(AppDbContext db, int count)
    {
        var occupied = await db.GraduationAnalyticsDatasets
            .Select(x => new { x.ReviewYear, x.ReviewMonth })
            .ToListAsync();
        var occupiedKeys = occupied.Select(x => (x.ReviewYear, x.ReviewMonth)).ToHashSet();
        var available = new List<TestPeriod>();
        for (var year = 2200; year >= 1900 && available.Count < count; year--)
        {
            for (var month = 12; month >= 1 && available.Count < count; month--)
            {
                if (!occupiedKeys.Contains((year, month))) available.Add(new TestPeriod(month, year));
            }
        }
        available.Should().HaveCount(count);
        return available;
    }

    private static async Task DeleteTestPeriodsAsync(string connectionString, string prefix)
    {
        await using var cleanup = CreateContext(connectionString);
        var datasets = await cleanup.GraduationAnalyticsDatasets
            .Where(x => x.OriginalFileName.StartsWith(prefix))
            .ToListAsync();
        cleanup.GraduationAnalyticsDatasets.RemoveRange(datasets);
        await cleanup.SaveChangesAsync();
    }

    private static GraduationImportRowCommand Row(
        int rowNumber,
        string faculty,
        string programCode,
        string programName,
        string cohort,
        string reviewPeriod,
        int initial,
        int excellentCount,
        decimal excellentRate,
        int? averageCount,
        int? workStudyCount) => new(
            rowNumber, faculty, programCode, programName, cohort, initial, reviewPeriod,
            excellentCount, excellentRate, 2, 2, 3, 3, averageCount, averageCount,
            workStudyCount, workStudyCount);

    private sealed record TestPeriod(int Month, int Year)
    {
        public string Text => $"T{Month} - {Year}";
    }

    private sealed class TestCurrentUser : ICurrentUserAccessor
    {
        public Guid? UserId { get; } = Guid.Parse("11111111-1111-1111-1111-111111111111");
        public string? UserEmail { get; } = "graduation-test@local";
        public Guid? ProfileId => null;
    }

    private sealed class FailOnSecondSaveInterceptor : SaveChangesInterceptor
    {
        private int saveCount;

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            saveCount += 1;
            if (saveCount == 2) throw new InvalidOperationException("Simulated row save failure.");
            return ValueTask.FromResult(result);
        }
    }
}
