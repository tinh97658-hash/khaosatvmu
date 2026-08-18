namespace UnitTests.ApplicationTests;

using Application.Reports;
using FluentAssertions;
using Xunit;

/// <summary>
/// Kiểm thử tính toán của bảng tổng quan toàn trường (executive survey dashboard):
/// phân bố điểm, xếp hạng Khoa theo điểm TB có trọng số, câu hỏi yếu nhất, so sánh kỳ trước.
/// </summary>
public class SchoolOverviewCalculationTests
{
    // ---- Phân bố điểm theo nhóm (band) -------------------------------------

    private static int ToBand(decimal score) =>
        score >= 4.5m ? 5 : score >= 4.0m ? 4 : score >= 3.0m ? 3 : 2;

    private static string BandLabel(int band) => band switch
    {
        5 => "Xuất sắc",
        4 => "Tốt",
        3 => "Trung bình",
        _ => "Cần cải thiện",
    };

    [Theory]
    [InlineData(4.9, 5)]
    [InlineData(4.5, 5)]
    [InlineData(4.4, 4)]
    [InlineData(4.0, 4)]
    [InlineData(3.9, 3)]
    [InlineData(3.0, 3)]
    [InlineData(2.9, 2)]
    [InlineData(0, 2)]
    public void ScoreToBand_ShouldMapToExpectedBand(decimal score, int expectedBand)
    {
        ToBand(score).Should().Be(expectedBand);
    }

    [Fact]
    public void ScoreDistribution_ShouldSumToTotalResponsesAnd100Percent()
    {
        // Giả lập các phiếu với điểm TB khác nhau để xếp vào 4 nhóm.
        decimal[] scores = [4.8m, 4.6m, 3.5m, 3.2m, 2.4m, 4.1m, 4.7m];
        var bandCounts = scores.GroupBy(ToBand).ToDictionary(g => g.Key, g => g.Count());
        int total = scores.Length;

        var distribution = new List<ScoreBandDto>();
        foreach (var band in new[] { 5, 4, 3, 2 })
        {
            int count = bandCounts.TryGetValue(band, out var c) ? c : 0;
            decimal pct = Math.Round((decimal)count / total * 100, 1);
            distribution.Add(new ScoreBandDto(band, BandLabel(band), count, pct));
        }

        distribution.Sum(x => x.Count).Should().Be(total);
        distribution.Sum(x => x.Percentage).Should().BeApproximately(100.0m, 0.1m);
        distribution[0].Label.Should().Be("Xuất sắc");
        distribution[3].Label.Should().Be("Cần cải thiện");
    }

    // ---- Xếp hạng Khoa theo điểm TB có trọng số ----------------------------

    [Fact]
    public void FacultyOverview_WeightedAverageScore_ShouldBeCorrect()
    {
        // Khoa A: 2 lớp — lớp 1: 50 phiếu, 4.8đ; lớp 2: 30 phiếu, 4.2đ.
        int responses1 = 50, responses2 = 30;
        decimal scoreSum = 4.8m * 50 + 4.2m * 30;

        decimal avg = Math.Round(scoreSum / (responses1 + responses2), 2);

        avg.Should().Be(4.58m);
    }

    [Fact]
    public void SchoolSurveyOverviewDto_ShouldRetainAggregates()
    {
        var faculty = new FacultyOverviewDto(
            1, "Khoa CNTT", 3, 12, 700, 640, 91.43m, 4.55m);
        var dept = new DepartmentOverviewDto(
            10, "Bộ môn Công nghệ phần mềm", 1, "Khoa CNTT", 4, 200, 120, 60.0m, 4.1m);
        var band = new ScoreBandDto(5, "Xuất sắc", 500, 78.1m);
        var comparison = new SemesterComparisonDto(
            2, "Học kỳ 1", "2024-2025", 85.0m, 4.2m, 6.43m, 0.35m);

        var overview = new SchoolSurveyOverviewDto(
            3, "Học kỳ 2", "2025-2026",
            12, 700, 640, 91.43m, 8, 2, 2,
            4.55m, [band],
            4.55m, [faculty],
            [dept],
            [],
            comparison);

        overview.TotalSections.Should().Be(12);
        overview.TotalTargetResponses.Should().Be(700);
        overview.TotalResponses.Should().Be(640);
        overview.CompletionRate.Should().Be(91.43m);
        overview.CompletedSectionCount.Should().Be(8);
        overview.InProgressSectionCount.Should().Be(2);
        overview.LaggingSectionCount.Should().Be(2);
        overview.OverallAverageScore.Should().Be(4.55m);
        overview.SchoolAverageScore.Should().Be(overview.OverallAverageScore);
        overview.Faculties.Should().ContainSingle();
        overview.Departments.Should().ContainSingle();
        overview.SemesterComparison!.CompletionRateDelta.Should().Be(6.43m);
        overview.SemesterComparison!.AverageScoreDelta.Should().Be(0.35m);
    }

    // ---- Câu hỏi yếu nhất toàn trường --------------------------------------

    [Fact]
    public void WeakestQuestions_ShouldOrderByAverageAscending_AndSkipLowAnswerCount()
    {
        const int minAnswers = 10;

        var questions = new List<(int QuestionId, decimal Avg, int TotalAnswers)>
        {
            (1, 3.1m, 40),
            (2, 2.4m, 35),
            (3, 4.6m, 50),
            (4, 2.0m, 5),   // quá ít lượt trả lời → loại bỏ
            (5, 3.9m, 20),
        };

        var weakest = questions
            .Where(x => x.TotalAnswers >= minAnswers)
            .OrderBy(x => x.Avg)
            .ThenByDescending(x => x.TotalAnswers)
            .Take(3)
            .ToList();

        weakest.Select(x => x.QuestionId).Should().Equal(2, 1, 5);
    }

    [Fact]
    public void OptionCount_Percentages_ShouldSumTo100()
    {
        var counts = new[] { 20, 15, 10, 3, 2 };
        int total = counts.Sum();

        var options = new List<OptionCountDto>();
        for (int val = 1; val <= 5; val++)
        {
            decimal pct = Math.Round((decimal)counts[val - 1] / total * 100, 1);
            options.Add(new OptionCountDto(val, $"Mức {val}", counts[val - 1], pct));
        }

        options.Sum(x => x.Percentage).Should().BeApproximately(100.0m, 0.1m);
        options.Count.Should().Be(5);
    }

    // ---- So sánh học kỳ trước ----------------------------------------------

    [Theory]
    [InlineData(95.0, 80.0, 15.0)]
    [InlineData(70.0, 80.0, -10.0)]
    [InlineData(0, 0, 0)]
    public void CompletionRateDelta_ShouldComputeDifference(decimal current, decimal previous, decimal expectedDelta)
    {
        var delta = Math.Round(current - previous, 2);
        delta.Should().Be(expectedDelta);
    }
}
