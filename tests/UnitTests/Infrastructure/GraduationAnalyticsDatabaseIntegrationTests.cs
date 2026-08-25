namespace UnitTests.InfrastructureTests;

using Application;
using Application.GraduationAnalytics;
using Domain;
using FluentAssertions;
using global::Infrastructure.GraduationAnalytics;
using global::Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

public sealed class GraduationAnalyticsDatabaseIntegrationTests
{
    [Fact]
    public async Task ImportQueryDuplicateNullZeroAndMultiDataset_WorkEndToEnd()
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString)) return;

        var prefix = $"codex-graduation-{Guid.NewGuid():N}";
        try
        {
            await using var db = CreateContext(connectionString);
            var service = new EfGraduationAnalyticsService(db, new TestCurrentUser());
            var first = await service.ImportDatasetAsync(new ImportGraduationDatasetCommand(
                $"{prefix}-1", "anonymous-1.xlsx", "Sheet1",
                [
                    Row(7, "Khoa A", "A01", "Ngành A1", "K20", "T7 - 2025", 100, 80, 40, 50, averageCount: null, workStudyCount: 0),
                    Row(8, "Khoa A", "A02", "Ngành A2", "K21", "T7 - 2026", 120, 90, 60, 66.7m, averageCount: 3, workStudyCount: 1),
                    Row(9, "Khoa B", "B01", "Ngành B1", "K20", "T7 - 2025", 80, 50, 25, 50, averageCount: 2, workStudyCount: 0),
                ]), CancellationToken.None);
            var second = await service.ImportDatasetAsync(new ImportGraduationDatasetCommand(
                $"{prefix}-2", "anonymous-2.xlsx", "Sheet1",
                [Row(7, "Khoa A", "A01", "Ngành A1", "K22", "T11 - 2027", 60, 40, 30, 75, averageCount: 1, workStudyCount: 0)]),
                CancellationToken.None);

            var faculty = await service.QueryAsync(new GraduationAnalyticsQueryCommand(
                [first.Dataset.DatasetId], "onTimeCount", "faculty", null,
                null, null, null, null, null), CancellationToken.None);
            faculty.Points.Single(x => x.Group == "Khoa A").Value.Should().Be(100);
            faculty.Points.Single(x => x.Group == "Khoa B").Value.Should().Be(25);

            var programInFaculty = await service.QueryAsync(new GraduationAnalyticsQueryCommand(
                [first.Dataset.DatasetId], "onTimeRate", "program", null,
                "Khoa A", null, null, null, null), CancellationToken.None);
            programInFaculty.Points.Should().HaveCount(2);

            var trend = await service.QueryAsync(new GraduationAnalyticsQueryCommand(
                [first.Dataset.DatasetId], "onTimeCount", "reviewYear", null,
                "Khoa A", null, null, null, null), CancellationToken.None);
            trend.Points.Select(x => x.Group).Should().ContainInOrder("2025", "2026");

            var datasets = await service.QueryAsync(new GraduationAnalyticsQueryCommand(
                [first.Dataset.DatasetId, second.Dataset.DatasetId], "onTimeCount", "dataset", null,
                null, null, null, null, null), CancellationToken.None);
            datasets.Points.Should().HaveCount(2);

            var sourceRows = await service.GetRowsAsync(new GraduationRowsQuery(
                first.Dataset.DatasetId, null, "Khoa A", "A01", null, 2025, 1, 25),
                CancellationToken.None);
            sourceRows.Items.Should().ContainSingle();
            sourceRows.Items[0].AverageCount.Should().BeNull();
            sourceRows.Items[0].WorkStudyTransferCount.Should().Be(0);

            var duplicate = () => service.ImportDatasetAsync(new ImportGraduationDatasetCommand(
                $"{prefix}-duplicate", "anonymous-1.xlsx", "Sheet1",
                [
                    Row(7, "Khoa A", "A01", "Ngành A1", "K20", "T7 - 2025", 100, 80, 40, 50, averageCount: null, workStudyCount: 0),
                    Row(8, "Khoa A", "A02", "Ngành A2", "K21", "T7 - 2026", 120, 90, 60, 66.7m, averageCount: 3, workStudyCount: 1),
                    Row(9, "Khoa B", "B01", "Ngành B1", "K20", "T7 - 2025", 80, 50, 25, 50, averageCount: 2, workStudyCount: 0),
                ]), CancellationToken.None);
            var exception = await duplicate.Should().ThrowAsync<GraduationAnalyticsException>();
            exception.Which.ErrorCode.Should().Be(GraduationAnalyticsErrorCodes.DuplicateImport);
        }
        finally
        {
            await DeleteTestDatasetsAsync(connectionString, prefix);
        }
    }

    [Fact]
    public async Task ImportTransaction_RollsBackDatasetWhenRowsSaveFails()
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString)) return;

        var name = $"codex-graduation-rollback-{Guid.NewGuid():N}";
        var interceptor = new FailOnSecondSaveInterceptor();
        await using (var db = CreateContext(connectionString, interceptor))
        {
            var service = new EfGraduationAnalyticsService(db, new TestCurrentUser());
            var action = () => service.ImportDatasetAsync(new ImportGraduationDatasetCommand(
                name, "rollback.xlsx", "Sheet1",
                [Row(7, "Khoa A", "A01", "Ngành A1", "K20", "T7 - 2026", 10, 8, 4, 50, null, 0)]),
                CancellationToken.None);

            await action.Should().ThrowAsync<InvalidOperationException>();
        }

        await using var verification = CreateContext(connectionString);
        (await verification.GraduationAnalyticsDatasets.AnyAsync(x => x.DatasetName == name))
            .Should().BeFalse();
    }

    private static AppDbContext CreateContext(string connectionString, SaveChangesInterceptor? interceptor = null)
    {
        var builder = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connectionString);
        if (interceptor is not null) builder.AddInterceptors(interceptor);
        return new AppDbContext(builder.Options);
    }

    private static async Task DeleteTestDatasetsAsync(string connectionString, string prefix)
    {
        await using var cleanup = CreateContext(connectionString);
        var datasets = await cleanup.GraduationAnalyticsDatasets
            .Where(x => x.DatasetName.StartsWith(prefix))
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
        int eligible,
        int onTime,
        decimal onTimeRate,
        int? averageCount,
        int? workStudyCount) => new(
            rowNumber, faculty, programCode, programName, cohort, initial, reviewPeriod,
            eligible, onTime, onTimeRate,
            1, 1, 2, 2, 3, 3, averageCount, averageCount, workStudyCount, workStudyCount);

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
