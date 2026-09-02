namespace UnitTests.ApplicationTests;

using Application.Surveys;
using FluentAssertions;
using Xunit;

/// <summary>
/// Điều kiện để một lớp được tính vào điểm. Quy tắc này quyết định lớp nào có mặt
/// trong mọi con số tổng hợp, nên khoá lại bằng test thay vì tin vào trí nhớ.
/// </summary>
public class ScoringThresholdTests
{
    [Theory]
    // Đủ tỷ lệ phiếu hợp lệ.
    [InlineData(40, 20, 20, true)]   // đúng 50%
    [InlineData(40, 25, 21, true)]   // trên 50%
    [InlineData(40, 30, 19, false)]  // nộp nhiều nhưng hợp lệ mới 47.5%
    // Vế lưới an toàn: cả lớp đã nộp thì không còn ai để thu thêm.
    [InlineData(10, 10, 3, true)]
    [InlineData(10, 12, 1, true)]    // nộp vượt sĩ số (sĩ số nhập thiếu)
    [InlineData(10, 9, 3, false)]    // thiếu một người, và hợp lệ mới 30%
    // Trường hợp biên.
    [InlineData(0, 5, 5, false)]     // sĩ số 0 thì không có mẫu số nào để chia
    [InlineData(30, 0, 0, false)]    // chưa ai làm
    public void HasEnoughResponsesToScore_ShouldFollowTheRule(
        int classSize,
        int totalResponseCount,
        int validResponseCount,
        bool expected)
    {
        ReportThresholds
            .HasEnoughResponsesToScore(classSize, totalResponseCount, validResponseCount)
            .Should().Be(expected);
    }

    [Fact]
    public void CompletedCompletionRate_ShouldStayInSyncWithTheFrontend()
    {
        // Bản sao ở src/Frontend/src/utils/reportThresholds.ts phải cùng con số này.
        // Lệch nhau thì một lớp được gắn nhãn "Hoàn thành" ở trang tiến độ nhưng lại
        // bị bỏ khỏi điểm ở trang báo cáo, không ai hiểu nổi tại sao.
        ReportThresholds.CompletedCompletionRate.Should().Be(50m);
    }

    [Fact]
    public void AClassJustUnderTheThreshold_ShouldNotBeScored()
    {
        // 49% không được làm tròn lên thành đạt.
        ReportThresholds.HasEnoughResponsesToScore(100, 49, 49).Should().BeFalse();
        ReportThresholds.HasEnoughResponsesToScore(100, 50, 50).Should().BeTrue();
    }
}
