using System.Globalization;
using System.Text;
using ClosedXML.Excel;
using ClosedXML.Excel.Drawings;
using Application.Surveys;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using QRCoder;

namespace Infrastructure.Surveys;

/// <summary>
/// Dựng tệp Excel danh sách lớp kèm ảnh mã QR bằng ClosedXML.
///
/// Danh sách lớp lấy qua <see cref="ISurveyService.GetCourseSectionSurveysAsync(int, CancellationToken)"/>
/// nên phạm vi xem của người dùng được áp đúng như khi họ mở bảng trên giao diện:
/// giảng viên chỉ xuất ra lớp mình dạy.
/// </summary>
public sealed class ClosedXmlCourseSurveyQrExporter(
    AppDbContext db,
    ISurveyService surveyService,
    IConfiguration configuration) : ICourseSurveyQrExporter
{
    /// <summary>Bề rộng cột QR (đơn vị ký tự) và chiều cao hàng (điểm).</summary>
    private const double QrColumnWidth = 12;
    private const double QrRowHeight = 64;

    /// <summary>Số pixel mỗi ô vuông của mã QR. Ảnh to hơn ô để phóng cột vẫn nét.</summary>
    private const int QrPixelsPerModule = 6;

    public async Task<SurveyOperationResult<CourseSurveyQrExportDto>> ExportAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken = default)
    {
        var survey = await db.SemesterSurveys
            .AsNoTracking()
            .Where(x => x.SemesterSurveyId == semesterSurveyId)
            .Select(x => new { x.SemesterSurveyId, x.SurveyName, x.SemesterId })
            .FirstOrDefaultAsync(cancellationToken);
        if (survey is null)
        {
            return new SurveyOperationResult<CourseSurveyQrExportDto>(
                false, SurveyErrorCodes.SemesterSurveyNotFound, default);
        }

        var semester = await db.Semesters.AsNoTracking()
            .Where(x => x.SemesterId == survey.SemesterId)
            .Select(x => new { x.SemesterName, x.AcademicYearId })
            .FirstOrDefaultAsync(cancellationToken);
        var academicYearName = semester is null
            ? string.Empty
            : await db.AcademicYears.AsNoTracking()
                .Where(x => x.AcademicYearId == semester.AcademicYearId)
                .Select(x => x.AcademicYearName)
                .FirstOrDefaultAsync(cancellationToken) ?? string.Empty;

        var sections = await surveyService.GetCourseSectionSurveysAsync(
            semesterSurveyId, cancellationToken);
        if (sections.Count == 0)
        {
            return new SurveyOperationResult<CourseSurveyQrExportDto>(
                false, SurveyErrorCodes.SemesterSurveyHasNoSections, default);
        }

        // Link sinh viên bấm vào phải là địa chỉ của giao diện, không phải của API.
        var frontendBaseUrl =
            (configuration["Authentication:FrontendBaseUrl"] ?? "http://localhost:5173")
            .TrimEnd('/');

        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add("Ma QR lop hoc phan");

        double[] columnWidths = [34, 26, 26, 9, 52, 30, QrColumnWidth];
        for (var i = 0; i < columnWidths.Length; i++)
        {
            sheet.Column(i + 1).Width = columnWidths[i];
        }

        const int lastColumn = 7;
        sheet.Range(1, 1, 1, lastColumn).Merge();
        var titleCell = sheet.Cell(1, 1);
        titleCell.Value = "DANH SÁCH MÃ QR KHẢO SÁT LỚP HỌC PHẦN";
        titleCell.Style.Font.Bold = true;
        titleCell.Style.Font.FontSize = 14;
        titleCell.Style.Font.FontColor = XLColor.FromHtml("#0F4C81");
        titleCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        sheet.Row(1).Height = 24;

        sheet.Range(2, 1, 2, lastColumn).Merge();
        var subtitleCell = sheet.Cell(2, 1);
        subtitleCell.Value = semester is null
            ? survey.SurveyName
            : $"{survey.SurveyName} · {semester.SemesterName} · {academicYearName}";
        subtitleCell.Style.Font.FontSize = 11;
        subtitleCell.Style.Font.FontColor = XLColor.FromHtml("#52616B");
        subtitleCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

        string[] headers =
        [
            "Lớp học phần",
            "Bộ môn",
            "Giảng viên",
            "Sĩ số",
            "Đường dẫn riêng",
            "Thời gian mở",
            "Mã QR",
        ];
        const int headerRowNumber = 4;
        for (var i = 0; i < headers.Length; i++)
        {
            var cell = sheet.Cell(headerRowNumber, i + 1);
            cell.Value = headers[i];
            cell.Style.Font.Bold = true;
            cell.Style.Font.FontSize = 11;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#F2F5F7");
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            cell.Style.Alignment.WrapText = true;
            cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            cell.Style.Border.OutsideBorderColor = XLColor.FromHtml("#CFD7DC");
        }
        sheet.Row(headerRowNumber).Height = 22;
        sheet.SheetView.FreezeRows(headerRowNumber);

        using var qrGenerator = new QRCodeGenerator();
        var rowNumber = headerRowNumber;

        foreach (var section in sections)
        {
            rowNumber++;
            var link = $"{frontendBaseUrl}/survey/{section.LinkToken}";

            sheet.Cell(rowNumber, 1).Value =
                $"{section.CourseCode} - {section.CourseName} ({section.SectionName})";
            sheet.Cell(rowNumber, 2).Value = section.DepartmentName;
            sheet.Cell(rowNumber, 3).Value = string.IsNullOrWhiteSpace(section.LecturerName)
                ? "Chưa phân công"
                : section.LecturerName;
            sheet.Cell(rowNumber, 4).Value = section.ClassSize;
            sheet.Cell(rowNumber, 5).Value = link;
            sheet.Cell(rowNumber, 6).Value = FormatRange(section.StartTime, section.EndTime);

            var rowRange = sheet.Range(rowNumber, 1, rowNumber, lastColumn);
            rowRange.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            rowRange.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            rowRange.Style.Border.InsideBorder = XLBorderStyleValues.Thin;
            rowRange.Style.Border.OutsideBorderColor = XLColor.FromHtml("#E3E7EA");
            rowRange.Style.Border.InsideBorderColor = XLColor.FromHtml("#E3E7EA");
            sheet.Range(rowNumber, 1, rowNumber, 3).Style.Alignment.WrapText = true;
            sheet.Cell(rowNumber, 4).Style.Alignment.Horizontal =
                XLAlignmentHorizontalValues.Center;
            sheet.Row(rowNumber).Height = QrRowHeight;

            using var qrData = qrGenerator.CreateQrCode(link, QRCodeGenerator.ECCLevel.M);
            using var pngQr = new PngByteQRCode(qrData);
            var png = pngQr.GetGraphic(QrPixelsPerModule);

            using var stream = new MemoryStream(png);
            var picture = sheet.AddPicture(stream, XLPictureFormat.Png);

            // MoveAndSize là mấu chốt: nó ghi ra twoCellAnchor editAs="twoCell",
            // tức ảnh CO GIÃN theo ô. Mặc định của thư viện là Move — ảnh trôi theo
            // ô nhưng giữ nguyên kích thước, kéo rộng cột thì QR vẫn cỡ cũ.
            picture.Placement = XLPicturePlacement.MoveAndSize;
            picture.MoveTo(
                sheet.Cell(rowNumber, lastColumn),
                sheet.Cell(rowNumber + 1, lastColumn + 1));
        }

        using var output = new MemoryStream();
        workbook.SaveAs(output);

        return new SurveyOperationResult<CourseSurveyQrExportDto>(
            true,
            null,
            new CourseSurveyQrExportDto(
                $"ma-qr-{Slugify(survey.SurveyName)}.xlsx",
                output.ToArray(),
                sections.Count));
    }

    private static string FormatRange(DateTime startTime, DateTime endTime)
    {
        var culture = CultureInfo.GetCultureInfo("vi-VN");
        return $"{startTime.ToString("HH:mm dd/MM/yy", culture)} → "
            + $"{endTime.ToString("HH:mm dd/MM/yy", culture)}";
    }

    /// <summary>Bỏ dấu và ký tự lạ để tên tệp an toàn trên mọi hệ điều hành.</summary>
    private static string Slugify(string value)
    {
        var normalized = value.ToLowerInvariant().Replace("đ", "d").Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);
        foreach (var character in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }
            builder.Append(char.IsAsciiLetterOrDigit(character) ? character : '-');
        }

        var slug = string.Join('-', builder.ToString().Split('-', StringSplitOptions.RemoveEmptyEntries));
        return slug.Length == 0 ? "dot-khao-sat" : slug;
    }
}
