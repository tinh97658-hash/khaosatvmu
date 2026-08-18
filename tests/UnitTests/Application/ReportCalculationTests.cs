namespace UnitTests.ApplicationTests;

using Application.Reports;
using FluentAssertions;
using Xunit;

public class ReportCalculationTests
{
    [Theory]
    [InlineData(80, 100, 80.0, "Hoàn thành")]
    [InlineData(50, 100, 50.0, "Đang thu")]
    [InlineData(20, 100, 20.0, "Chậm tiến độ")]
    [InlineData(0, 0, 0.0, "Chậm tiến độ")]
    public void CalculateProgressStatus_ShouldReturnExpectedStatus(
        int actual, int target, decimal expectedRate, string expectedStatus)
    {
        var rate = target > 0 ? Math.Round((decimal)actual / target * 100, 2) : 0;
        string status;
        if (rate >= 80)
        {
            status = "Hoàn thành";
        }
        else if (rate >= 40)
        {
            status = "Đang thu";
        }
        else
        {
            status = "Chậm tiến độ";
        }

        rate.Should().Be(expectedRate);
        status.Should().Be(expectedStatus);
    }

    [Fact]
    public void OperationalProgressReportDto_ShouldRetainAggregates()
    {
        var section = new SectionProgressDetailDto(
            1, "19783", "Kỹ thuật lập trình", "N01", "TS. Nguyễn Văn A", 60, 54, 90.0m, "Hoàn thành"
        );

        var report = new OperationalProgressReportDto(
            1, "Học kỳ 1", "2025-2026", 60, 54, 90.0m, 1, 0, 0, [section]
        );

        report.TotalTargetResponses.Should().Be(60);
        report.TotalActualResponses.Should().Be(54);
        report.OverallCompletionRate.Should().Be(90.0m);
        report.CompletedSectionCount.Should().Be(1);
        report.SectionDetails.Should().HaveCount(1);
    }

    [Fact]
    public void LecturerPerformanceReportDto_CalculatesAveragesCorrectly()
    {
        var section1 = new LecturerSectionSummaryDto(1, "19783", "Kỹ thuật lập trình", "N01", 60, 50, 4.8m);
        var section2 = new LecturerSectionSummaryDto(2, "19784", "Cơ sở dữ liệu", "N02", 50, 40, 4.4m);

        var totalResponses = section1.ResponseCount + section2.ResponseCount;
        var weightedAvg = Math.Round(((section1.AverageScore * section1.ResponseCount) + (section2.AverageScore * section2.ResponseCount)) / totalResponses, 2);

        var report = new LecturerPerformanceReportDto(
            10,
            "TS. Trần Văn B",
            "Công nghệ thông tin",
            "Khoa CNTT",
            weightedAvg,
            totalResponses,
            2,
            weightedAvg,
            weightedAvg,
            [section1, section2],
            []
        );

        report.TotalResponses.Should().Be(90);
        report.AverageScore.Should().Be(4.62m);
        report.Sections.Should().HaveCount(2);
    }
}
