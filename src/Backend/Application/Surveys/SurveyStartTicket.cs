using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Application.Surveys;

/// <summary>
/// Vé "đã bấm Bắt đầu làm bài". Server phát vé tại đúng lúc sinh viên bấm nút,
/// trình duyệt giữ hộ rồi gửi lại khi nộp bài để server biết bài làm mất bao lâu.
///
/// Vé KHÔNG lưu xuống cơ sở dữ liệu và không có hạn dùng: bấm bắt đầu lại bao
/// nhiêu lần cũng được, mỗi lần nhận một vé mới với mốc thời gian mới.
///
/// Vé gắn chặt với <c>LinkToken</c> của lớp, nên xin vé ở lớp này rồi đem nộp cho
/// lớp khác thì không đọc được.
///
/// Định dạng: <c>{payload}.{chữ ký}</c>, cả hai đều mã hoá base64url.
/// Nội dung payload là <c>{linkToken}|{giây epoch lúc phát}</c>.
/// </summary>
public sealed class SurveyStartTicket(string signingKey)
{
    private readonly byte[] key = Encoding.UTF8.GetBytes(signingKey);

    /// <summary>Phát một vé mới cho lớp có <paramref name="linkToken"/>.</summary>
    public string Issue(string linkToken, DateTime issuedAtUtc)
    {
        var payload = $"{linkToken}|{new DateTimeOffset(issuedAtUtc, TimeSpan.Zero).ToUnixTimeSeconds()}";
        var payloadBytes = Encoding.UTF8.GetBytes(payload);
        return $"{ToBase64Url(payloadBytes)}.{ToBase64Url(Sign(payloadBytes))}";
    }

    /// <summary>
    /// Đọc mốc thời gian phát vé. Trả về false khi vé thiếu, sai định dạng, sai
    /// chữ ký, hoặc là vé của lớp khác. Bên gọi coi ba trường hợp đó như nhau:
    /// số giây làm bài bằng 0, để luật TOO_FAST tự bắt.
    /// </summary>
    public bool TryRead(string? ticket, string linkToken, out DateTime issuedAtUtc)
    {
        issuedAtUtc = default;
        if (string.IsNullOrWhiteSpace(ticket)) return false;

        var separator = ticket.IndexOf('.');
        if (separator <= 0 || separator == ticket.Length - 1) return false;

        if (!TryFromBase64Url(ticket[..separator], out var payloadBytes)
            || !TryFromBase64Url(ticket[(separator + 1)..], out var signatureBytes))
        {
            return false;
        }

        // So sánh theo thời gian cố định để không lộ chữ ký qua thời gian phản hồi.
        if (!CryptographicOperations.FixedTimeEquals(Sign(payloadBytes), signatureBytes))
        {
            return false;
        }

        var payload = Encoding.UTF8.GetString(payloadBytes);
        var pipe = payload.LastIndexOf('|');
        if (pipe <= 0) return false;

        // Vé của lớp khác: chữ ký vẫn thật nhưng không dùng cho lớp này được.
        if (!string.Equals(payload[..pipe], linkToken, StringComparison.Ordinal)) return false;

        if (!long.TryParse(payload[(pipe + 1)..], NumberStyles.Integer, CultureInfo.InvariantCulture, out var epochSeconds))
        {
            return false;
        }

        issuedAtUtc = DateTimeOffset.FromUnixTimeSeconds(epochSeconds).UtcDateTime;
        return true;
    }

    /// <summary>
    /// Số giây từ lúc phát vé tới <paramref name="nowUtc"/>. Vé không đọc được thì
    /// trả 0. Vé có mốc ở tương lai (lệch đồng hồ) cũng quy về 0 cho an toàn.
    /// </summary>
    public double ElapsedSeconds(string? ticket, string linkToken, DateTime nowUtc)
    {
        if (!TryRead(ticket, linkToken, out var issuedAtUtc)) return 0;
        var elapsed = (nowUtc - issuedAtUtc).TotalSeconds;
        return elapsed > 0 ? elapsed : 0;
    }

    private byte[] Sign(byte[] payloadBytes) => HMACSHA256.HashData(key, payloadBytes);

    private static string ToBase64Url(byte[] value) =>
        Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static bool TryFromBase64Url(string value, out byte[] bytes)
    {
        bytes = [];
        var padded = value.Replace('-', '+').Replace('_', '/');
        padded += (padded.Length % 4) switch { 2 => "==", 3 => "=", 0 => string.Empty, _ => "\0" };
        if (padded.EndsWith('\0')) return false;

        Span<byte> buffer = new byte[padded.Length];
        if (!Convert.TryFromBase64String(padded, buffer, out var written)) return false;

        bytes = buffer[..written].ToArray();
        return true;
    }
}
