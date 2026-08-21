using Application.Surveys;
using FluentAssertions;
using Xunit;

namespace UnitTests.ApplicationTests;

public class SurveyStartTicketTests
{
    private const string Key = "khoa-ky-chi-danh-cho-test-khong-dung-that";
    private const string Token = "7fK2mQ9x";

    private static readonly DateTime IssuedAt = new(2026, 8, 20, 9, 0, 0, DateTimeKind.Utc);

    private static SurveyStartTicket NewTicket(string? key = null) => new(key ?? Key);

    [Fact]
    public void VePhatRa_ThiDocLaiDuocDungMocThoiGian()
    {
        var ticket = NewTicket();
        var value = ticket.Issue(Token, IssuedAt);

        ticket.TryRead(value, Token, out var issuedAt).Should().BeTrue();
        issuedAt.Should().Be(IssuedAt);
    }

    [Fact]
    public void VeGomHaiPhanNganCachBangDauCham()
    {
        var value = NewTicket().Issue(Token, IssuedAt);

        value.Split('.').Should().HaveCount(2);
        value.Should().NotContain("+").And.NotContain("/").And.NotContain("=");
    }

    [Fact]
    public void ThieuVe_ThiKhongDocDuoc()
    {
        var ticket = NewTicket();

        ticket.TryRead(null, Token, out _).Should().BeFalse();
        ticket.TryRead("", Token, out _).Should().BeFalse();
        ticket.TryRead("   ", Token, out _).Should().BeFalse();
    }

    [Fact]
    public void VeSaiDinhDang_ThiKhongDocDuoc()
    {
        var ticket = NewTicket();

        ticket.TryRead("khongcodaucham", Token, out _).Should().BeFalse();
        ticket.TryRead(".chiCoChuKy", Token, out _).Should().BeFalse();
        ticket.TryRead("chiCoNoiDung.", Token, out _).Should().BeFalse();
    }

    [Fact]
    public void SuaMocThoiGianTrongVe_ThiChuKyKhongConKhop()
    {
        // Đúng kịch bản mở DevTools sửa localStorage cho ra vẻ đã làm rất lâu.
        var ticket = NewTicket();
        var honest = ticket.Issue(Token, IssuedAt);
        var forgedPayload = ticket.Issue(Token, IssuedAt.AddHours(-2)).Split('.')[0];
        var forged = $"{forgedPayload}.{honest.Split('.')[1]}";

        ticket.TryRead(forged, Token, out _).Should().BeFalse();
    }

    [Fact]
    public void VeCuaLopKhac_ThiKhongDungDuoc()
    {
        // Chữ ký vẫn thật vì chính server ký, nhưng token bên trong là lớp khác.
        var ticket = NewTicket();
        var value = ticket.Issue("lop-khac", IssuedAt);

        ticket.TryRead(value, Token, out _).Should().BeFalse();
    }

    [Fact]
    public void DoiKhoaKy_ThiVeCuHetHieuLuc()
    {
        var value = NewTicket().Issue(Token, IssuedAt);

        NewTicket("mot-khoa-ky-hoan-toan-khac").TryRead(value, Token, out _).Should().BeFalse();
    }

    [Fact]
    public void ElapsedSeconds_TinhDungKhoangCach()
    {
        var ticket = NewTicket();
        var value = ticket.Issue(Token, IssuedAt);

        ticket.ElapsedSeconds(value, Token, IssuedAt.AddSeconds(150))
            .Should().BeApproximately(150, 0.001);
    }

    [Fact]
    public void ElapsedSeconds_VeKhongDocDuocThiTraKhong()
    {
        var ticket = NewTicket();

        ticket.ElapsedSeconds(null, Token, IssuedAt).Should().Be(0);
        ticket.ElapsedSeconds("rac.rac", Token, IssuedAt).Should().Be(0);
        ticket.ElapsedSeconds(ticket.Issue("lop-khac", IssuedAt), Token, IssuedAt.AddSeconds(999))
            .Should().Be(0);
    }

    [Fact]
    public void ElapsedSeconds_MocOTuongLaiThiQuyVeKhong()
    {
        // Đồng hồ máy chủ lệch hoặc vé phát sau thời điểm nộp.
        var ticket = NewTicket();
        var value = ticket.Issue(Token, IssuedAt.AddMinutes(5));

        ticket.ElapsedSeconds(value, Token, IssuedAt).Should().Be(0);
    }

    [Fact]
    public void PhatVeHaiLan_ThiMocSauMoiHon()
    {
        var ticket = NewTicket();
        var first = ticket.Issue(Token, IssuedAt);
        var second = ticket.Issue(Token, IssuedAt.AddMinutes(3));

        first.Should().NotBe(second);
        ticket.ElapsedSeconds(second, Token, IssuedAt.AddMinutes(4)).Should().Be(60);
    }
}
