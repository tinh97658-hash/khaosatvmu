namespace Infrastructure.Reports;

/// <summary>
/// Bộ đếm phiên bản của cache báo cáo tổng quan toàn trường.
///
/// Khoá cache của báo cáo đó ghép từ bốn tham số (học kỳ, đợt, kỳ đối chiếu, đợt
/// đối chiếu) nên không liệt kê hết được, mà <c>IMemoryCache</c> lại không xoá
/// theo tiền tố. Thay vì cố dò từng khoá, nhét số phiên bản này vào khoá: tăng
/// một cái là mọi khoá cũ thành không ai hỏi tới nữa, TTL 90 giây tự dọn phần rác.
///
/// Đăng ký singleton để cả tiến trình dùng chung một số đếm.
/// </summary>
public sealed class SchoolOverviewCacheVersion
{
    private long _value;

    public long Current => Interlocked.Read(ref _value);

    /// <summary>
    /// Gọi sau mỗi thao tác làm số liệu tổng hợp đổi ngay lập tức — huỷ phiếu của
    /// một lớp chẳng hạn. Không gọi thì thanh tra bấm xong, mở báo cáo vẫn thấy
    /// điểm cũ hơn một phút, trông như hệ thống hỏng.
    /// </summary>
    public void Bump() => Interlocked.Increment(ref _value);
}
