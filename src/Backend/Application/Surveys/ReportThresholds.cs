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
    /// <summary>
    /// Dưới mức này thì lớp bị coi là cần cảnh báo. Dùng chung cho cột "Lớp cảnh
    /// báo" của bảng bộ môn và "số lớp dưới ngưỡng" của dashboard, để hai màn
    /// hình không bao giờ nói ngược nhau.
    /// </summary>
    public const decimal LowScore = 3.20m;

    /// <summary>Từ mức này trở lên thì coi là tốt, dùng cho kết luận "nên nhân rộng".</summary>
    public const decimal GoodScore = 4.00m;

    /// <summary>
    /// Chênh lệch giữa lớp cao nhất và thấp nhất trong cùng một học phần, vượt
    /// mức này thì khác biệt được quy cho giảng viên chứ không phải học phần.
    /// </summary>
    public const decimal WideSpread = 0.80m;

    /// <summary>Z vượt mức này (theo cả hai chiều) mới coi là lệch đáng kể.</summary>
    public const decimal NotableZScore = 1.00m;

    /// <summary>
    /// Khoa có ít hơn số lớp này thì không chuẩn hoá. Nhóm một lớp thì độ lệch
    /// chuẩn không tồn tại; nhóm hai lớp thì Z luôn ra đúng ±0.71 bất kể điểm
    /// thật, tức một con số trông chính xác nhưng vô nghĩa.
    /// </summary>
    public const int MinimumSectionsForNormalization = 5;
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
