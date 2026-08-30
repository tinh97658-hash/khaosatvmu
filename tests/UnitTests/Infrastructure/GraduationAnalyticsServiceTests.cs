namespace UnitTests.InfrastructureTests;

using Application;
using Application.GraduationAnalytics;
using FluentAssertions;
using global::Infrastructure.GraduationAnalytics;
using global::Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

public sealed class GraduationAnalyticsServiceTests
{
    [Fact]
    public void Metadata_ContainsOnlySupportedDimensionsAndOutcomeMetrics()
    {
        using var db = CreateContext();
        var service = new EfGraduationAnalyticsService(db, Mock.Of<ICurrentUserAccessor>());

        var metadata = service.GetMetadata();

        metadata.Dimensions.Select(x => x.Id).Should().BeEquivalentTo(
            "all", "faculty", "program", "cohort");
        metadata.Metrics.Should().HaveCount(11);
        metadata.Metrics.Should().Contain(x =>
            x.Id == "excellentRate"
            && x.Unit == "percent"
            && x.Aggregation == "weighted-average");
        metadata.Metrics.Select(x => x.Id).Should().NotContain(
            ["initialEnrollment", "eligible", "onTimeCount", "onTimeRate"]);
    }

    [Fact]
    public async Task Query_RejectsUsingTheSameDimensionForGroupAndSeries()
    {
        await using var db = CreateContext();
        var service = new EfGraduationAnalyticsService(db, Mock.Of<ICurrentUserAccessor>());
        var command = new GraduationAnalyticsQueryCommand(
            [1], "excellentRate", "faculty", "faculty",
            null, null, null, null, null);

        var action = () => service.QueryAsync(command, CancellationToken.None);

        var exception = await action.Should().ThrowAsync<GraduationAnalyticsException>();
        exception.Which.ErrorCode.Should().Be(GraduationAnalyticsErrorCodes.InvalidQuery);
    }

    [Fact]
    public async Task Import_RejectsEmptyPeriodBeforeTouchingTheDatabase()
    {
        await using var db = CreateContext();
        var service = new EfGraduationAnalyticsService(db, Mock.Of<ICurrentUserAccessor>());
        var command = new ImportGraduationPeriodCommand("file.xlsx", "Sheet1", []);

        var action = () => service.ImportPeriodAsync(command, CancellationToken.None);

        var exception = await action.Should().ThrowAsync<GraduationAnalyticsException>();
        exception.Which.ErrorCode.Should().Be(GraduationAnalyticsErrorCodes.InvalidImport);
    }

    [Fact]
    public async Task Import_RejectsRowsFromMultipleReviewPeriodsBeforeTouchingTheDatabase()
    {
        await using var db = CreateContext();
        var service = new EfGraduationAnalyticsService(db, Mock.Of<ICurrentUserAccessor>());
        var command = new ImportGraduationPeriodCommand(
            "file.xlsx",
            "Sheet1",
            [Row(7, "T7 - 2026"), Row(8, "T11/2026")]);

        var action = () => service.ImportPeriodAsync(command, CancellationToken.None);

        var exception = await action.Should().ThrowAsync<GraduationAnalyticsException>();
        exception.Which.ErrorCode.Should().Be(GraduationAnalyticsErrorCodes.MultipleReviewPeriods);
        exception.Which.Message.Should().Contain("T7 - 2026").And.Contain("T11 - 2026");
    }

    private static GraduationImportRowCommand Row(int rowNumber, string period) => new(
        rowNumber, "Khoa A", "A01", "Ngành A", "K62", 100, period,
        1, 10, 2, 20, 3, 30, 4, 40, 0, 0);

    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=unused;Username=unused;Password=unused")
            .Options;
        return new AppDbContext(options);
    }
}
