namespace Application.Surveys;

/// <summary>
/// Hai vòng loại quyết định một lớp có được tính vào điểm hay không. Khác với
/// <see cref="ReportThresholds"/> viết cứng trong mã, cặp ngưỡng này do quản trị
/// đặt trên giao diện và lưu trong bảng "SurveyScoringSettings", vì mỗi đợt khảo
/// sát có thể cần siết hay nới khác nhau.
///
/// Đổi ngưỡng là đổi tập lớp được tính, nên sau khi đổi phải bấm "Tính lại điểm"
/// thì các bảng đọc từ điểm đã chốt mới khớp với các bảng tính sống.
/// </summary>
public readonly record struct ScoringThresholds(
    /// <summary>Vòng 1 — Số phiếu đã thu ÷ Sĩ số, tính theo phần trăm.</summary>
    decimal MinimumResponseRate,
    /// <summary>Vòng 2 — Số phiếu hợp lệ ÷ Số phiếu đã thu, tính theo phần trăm.</summary>
    decimal MinimumValidRate)
{
    /// <summary>Mặc định của hệ thống khi bảng cấu hình chưa có dòng nào.</summary>
    public static readonly ScoringThresholds Default = new(50m, 80m);

    /// <summary>Ngưỡng nằm ngoài 0–100 là vô nghĩa, chặn ngay ở tầng ứng dụng.</summary>
    public bool IsValid =>
        MinimumResponseRate is >= 0m and <= 100m
        && MinimumValidRate is >= 0m and <= 100m;

    /// <summary>
    /// Lớp phải qua CẢ HAI vòng mới được gộp vào điểm.
    ///
    /// Vòng 1 loại lớp quá ít người trả lời: điểm của lớp hai người đánh giá không
    /// so được với lớp ba mươi người, gộp vào là kéo lệch mọi con số phía trên.
    /// Vòng 2 loại lớp nộp nhiều nhưng phần lớn phiếu bị bộ lọc nhiễu đánh rớt —
    /// đủ số lượng mà không đủ chất lượng thì cũng không tin được.
    /// </summary>
    public bool HasEnoughResponsesToScore(
        int classSize,
        int totalResponseCount,
        int validResponseCount)
    {
        if (classSize <= 0 || totalResponseCount <= 0) return false;

        var responseRate = (decimal)totalResponseCount / classSize * 100;
        if (responseRate < MinimumResponseRate) return false;

        var validRate = (decimal)validResponseCount / totalResponseCount * 100;
        return validRate >= MinimumValidRate;
    }
}

/// <summary>Đọc và ghi cặp ngưỡng tính điểm đang áp dụng cho toàn hệ thống.</summary>
public interface IScoringThresholdProvider
{
    Task<ScoringThresholds> GetAsync(CancellationToken cancellationToken = default);

    /// <summary>Chỉ quản trị mới đổi được; trả về giá trị sau khi ghi.</summary>
    Task<SurveyOperationResult<ScoringThresholds>> UpdateAsync(
        ScoringThresholds thresholds,
        CancellationToken cancellationToken = default);
}
