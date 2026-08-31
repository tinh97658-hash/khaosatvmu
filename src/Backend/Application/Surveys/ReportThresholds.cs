namespace Application.Surveys;

/// <summary>
/// Các ngưỡng dùng chung cho báo cáo phân tích. Rút từ bản mô phỏng Excel của
/// đơn vị nghiệp vụ, xem docs/plans/phan-tich-mo-phong-bao-cao-nang-cao.md.
///
/// Viết cứng ở đây thay vì đưa vào cấu hình vì đổi ngưỡng là đổi cách đọc số
/// liệu của cả trường; nên là một quyết định có bàn bạc chứ không phải một ô
/// nhập trên giao diện.
/// </summary>
public static class ReportThresholds
{
    /// <summary>Từ mức này trở lên thì coi là tốt, dùng cho kết luận "nên nhân rộng".</summary>
    public const decimal GoodScore = 4.00m;

    /// <summary>
    /// Chênh lệch giữa lớp cao nhất và thấp nhất trong cùng một học phần, vượt
    /// mức này thì khác biệt được quy cho giảng viên chứ không phải học phần.
    /// </summary>
    public const decimal WideSpread = 0.80m;

    /// <summary>
    /// Ba bậc của quy tắc thực nghiệm 68-95-99.7. Với phân phối chuẩn thì ngoài
    /// ±1σ còn 31.7% số trường hợp, ngoài ±2σ còn 4.6%, ngoài ±3σ còn 0.3%. Chia
    /// bậc để danh sách cần soi ngay tách khỏi danh sách chỉ cần biết.
    /// </summary>
    public const decimal NotableZScore = 1.00m;

    /// <summary>Bậc 2: lệch rõ, chỉ khoảng 4.6% trường hợp rơi vào.</summary>
    public const decimal StrongZScore = 2.00m;

    /// <summary>Bậc 3: lệch rất mạnh, khoảng 0.3% trường hợp.</summary>
    public const decimal ExtremeZScore = 3.00m;

    /// <summary>
    /// Nhóm có ít hơn số lớp này thì không chuẩn hoá. Một lớp thì độ lệch chuẩn
    /// không tồn tại (mẫu số n−1 bằng 0), nên hai là mức thấp nhất còn tính được.
    /// </summary>
    public const int MinimumSectionsForNormalization = 2;

    /// <summary>
    /// Tỷ lệ PHIẾU HỢP LỆ trên sĩ số để một lớp được coi là thu đủ. Dùng cho cả
    /// hai việc, vì thực chất là cùng một câu hỏi "lớp này đã đủ phiếu để tin
    /// chưa": nhãn "Hoàn thành" trên bảng tiến độ, và điều kiện để lớp được tính
    /// vào điểm.
    ///
    /// Mẫu số là sĩ số chứ không phải số phiếu nộp, và tử số chỉ đếm phiếu qua
    /// được bộ lọc nhiễu — phiếu bị loại vẫn là một lượt nộp nhưng không dùng
    /// được vào kết quả nào.
    /// </summary>
    public const decimal CompletedCompletionRate = 50m;

    /// <summary>
    /// Dưới mức này thì lớp bị coi là chậm tiến độ, cần đôn đốc. Giữa hai mốc là
    /// "đang thu". Chỉ dùng để gắn nhãn tiến độ, không dính gì tới việc lớp có
    /// được tính điểm hay không.
    /// </summary>
    public const decimal LaggingCompletionRate = 20m;

    /// <summary>
    /// Lớp thu đủ phiếu hay không quyết định lớp đó có được gộp vào điểm hay
    /// không. Điểm của một lớp hai người đánh giá không so được với lớp ba mươi
    /// người, gộp chung là kéo lệch mọi con số tổng hợp phía trên.
    ///
    /// Vế thứ hai <paramref name="totalResponseCount"/> ≥ sĩ số là lưới an toàn
    /// cho lớp nộp đủ nhưng phần lớn phiếu bị bộ lọc loại: cả lớp đã làm rồi thì
    /// không còn ai để thu thêm, chờ nữa cũng vô ích.
    /// </summary>
    public static bool HasEnoughResponsesToScore(
        int classSize,
        int totalResponseCount,
        int validResponseCount)
    {
        if (classSize <= 0) return false;
        if (totalResponseCount >= classSize) return true;
        return (decimal)validResponseCount / classSize * 100 >= CompletedCompletionRate;
    }
}

/// <summary>Mã kết luận chẩn đoán khi so các lớp trong cùng một học phần.</summary>
public static class CourseDiagnosisVerdicts
{
    /// <summary>Lớp cao điểm nhất vẫn dưới ngưỡng — vấn đề nằm ở học phần.</summary>
    public const string CourseIssue = "COURSE_ISSUE";

    /// <summary>Biên độ giữa các lớp quá rộng — khác biệt nằm ở giảng viên.</summary>
    public const string LecturerVariance = "LECTURER_VARIANCE";

    /// <summary>Lớp thấp điểm nhất vẫn trên ngưỡng tốt — nên nhân rộng.</summary>
    public const string AllGood = "ALL_GOOD";

    public const string Inconclusive = "INCONCLUSIVE";
}

/// <summary>Mã diễn giải kết quả chuẩn hoá điểm của một lớp.</summary>
public static class NormalizationVerdicts
{
    /// <summary>So toàn trường và so trong khoa cho hai kết luận trái ngược nhau.</summary>
    public const string ConclusionFlips = "CONCLUSION_FLIPS";

    public const string AboveFaculty = "ABOVE_FACULTY";
    public const string BelowFaculty = "BELOW_FACULTY";
    public const string Normal = "NORMAL";

    /// <summary>Khoa quá ít lớp nên không tính Z trong khoa.</summary>
    public const string FacultyTooSmall = "FACULTY_TOO_SMALL";
}
