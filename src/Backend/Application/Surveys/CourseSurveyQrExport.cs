namespace Application.Surveys;

/// <summary>Tệp Excel đã dựng xong, sẵn sàng trả về cho trình duyệt.</summary>
public sealed record CourseSurveyQrExportDto(
    string FileName,
    byte[] Content,
    /// <summary>Số lớp có trong tệp, dùng cho thông báo phía giao diện.</summary>
    int SectionCount);

/// <summary>
/// Dựng tệp Excel danh sách lớp của một đợt khảo sát, kèm ảnh mã QR từng lớp.
///
/// Việc này nằm ở server chứ không ở trình duyệt: một đợt có thể tới vài nghìn
/// lớp, sinh chừng ấy ảnh QR rồi nén thành workbook trên luồng chính của trình
/// duyệt là treo tab vài giây.
/// </summary>
public interface ICourseSurveyQrExporter
{
    Task<SurveyOperationResult<CourseSurveyQrExportDto>> ExportAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken = default);
}
