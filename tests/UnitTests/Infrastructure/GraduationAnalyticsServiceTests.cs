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
    public void Metadata_ContainsAllSupportedDimensionsAndSourceMetrics()
    {
        using var db = CreateContext();
        var service = new EfGraduationAnalyticsService(db, Mock.Of<ICurrentUserAccessor>());

        var metadata = service.GetMetadata();

        metadata.Dimensions.Select(x => x.Id).Should().BeEquivalentTo(
            "all", "faculty", "program", "cohort", "reviewYear", "reviewPeriod", "dataset");
        metadata.Metrics.Should().HaveCount(14);
        metadata.Metrics.Should().Contain(x =>
            x.Id == "onTimeRate"
            && x.Unit == "percent"
            && x.Aggregation == "weighted-average");
    }

    [Fact]
    public async Task Query_RejectsUsingTheSameDimensionForGroupAndSeries()
    {
        await using var db = CreateContext();
        var service = new EfGraduationAnalyticsService(db, Mock.Of<ICurrentUserAccessor>());
        var command = new GraduationAnalyticsQueryCommand(
            [1], "onTimeRate", "faculty", "faculty",
            null, null, null, null, null);

        var action = () => service.QueryAsync(command, CancellationToken.None);

        var exception = await action.Should().ThrowAsync<GraduationAnalyticsException>();
        exception.Which.ErrorCode.Should().Be(GraduationAnalyticsErrorCodes.InvalidQuery);
    }

    [Fact]
    public async Task Import_RejectsEmptyDatasetBeforeTouchingTheDatabase()
    {
        await using var db = CreateContext();
        var service = new EfGraduationAnalyticsService(db, Mock.Of<ICurrentUserAccessor>());
        var command = new ImportGraduationDatasetCommand("Bộ dữ liệu", "file.xlsx", "Sheet1", []);

        var action = () => service.ImportDatasetAsync(command, CancellationToken.None);

        var exception = await action.Should().ThrowAsync<GraduationAnalyticsException>();
        exception.Which.ErrorCode.Should().Be(GraduationAnalyticsErrorCodes.InvalidImport);
    }

    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=unused;Username=unused;Password=unused")
            .Options;
        return new AppDbContext(options);
    }
}
