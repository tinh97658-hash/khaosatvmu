import type { CourseSectionSurvey } from '../types';

/**
 * Xuất danh sách lớp của một đợt khảo sát ra Excel, kèm ảnh mã QR của từng lớp.
 *
 * Dùng ExcelJS chứ không dùng `write-excel-file` như các bảng khác: thư viện kia
 * không nhúng được ảnh vào tệp .xlsx.
 *
 * Ảnh neo theo hai góc ô (`tl` + `br`) nên nó CO GIÃN theo ô — kéo rộng cột hay
 * kéo cao hàng thì mã QR to nhỏ theo. Nếu chỉ đặt `tl` thì ảnh nổi trên bảng, đổi
 * kích thước ô bao nhiêu ảnh vẫn nguyên một cỡ.
 */

/** Bề rộng cột QR (đơn vị ký tự của Excel) và chiều cao hàng (điểm). */
const qrColumnWidth = 12;
const qrRowHeight = 64;

/** Cạnh ảnh QR sinh ra, tính bằng pixel. To hơn ô để phóng cột vẫn còn nét. */
const qrPixelSize = 240;

function formatRange(startTime: string, endTime: string): string {
  const formatter = new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  return `${formatter.format(new Date(startTime))} → ${formatter.format(new Date(endTime))}`;
}

export interface CourseSurveyQrExportOptions {
  /** Tên đợt khảo sát, dùng cho tiêu đề và tên tệp. */
  surveyName: string;
  semesterLabel: string;
  sections: CourseSectionSurvey[];
  /** Dựng đường dẫn công khai từ mã link của lớp. */
  surveyLinkOf: (linkToken: string) => string;
}

export async function exportCourseSurveyQrExcel({
  surveyName,
  semesterLabel,
  sections,
  surveyLinkOf,
}: CourseSurveyQrExportOptions): Promise<void> {
  const [{ default: ExcelJS }, { default: QRCode }] = await Promise.all([
    import('exceljs'),
    import('qrcode'),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hệ thống Khảo sát VMU';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Ma QR lop hoc phan', {
    views: [{ state: 'frozen', ySplit: 4 }],
  });

  sheet.columns = [
    { key: 'sectionName', width: 34 },
    { key: 'departmentName', width: 26 },
    { key: 'lecturerName', width: 26 },
    { key: 'classSize', width: 9 },
    { key: 'link', width: 52 },
    { key: 'schedule', width: 30 },
    { key: 'qr', width: qrColumnWidth },
  ];

  const lastColumn = 7;
  const titleRow = sheet.addRow(['DANH SÁCH MÃ QR KHẢO SÁT LỚP HỌC PHẦN']);
  sheet.mergeCells(titleRow.number, 1, titleRow.number, lastColumn);
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF0F4C81' } };
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.height = 24;

  const subtitleRow = sheet.addRow([`${surveyName} · ${semesterLabel}`]);
  sheet.mergeCells(subtitleRow.number, 1, subtitleRow.number, lastColumn);
  subtitleRow.getCell(1).font = { size: 11, color: { argb: 'FF52616B' } };
  subtitleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.addRow([]);

  const headerRow = sheet.addRow([
    'Lớp học phần',
    'Bộ môn',
    'Giảng viên',
    'Sĩ số',
    'Đường dẫn riêng',
    'Thời gian mở',
    'Mã QR',
  ]);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F5F7' } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCFD7DC' } },
      left: { style: 'thin', color: { argb: 'FFCFD7DC' } },
      bottom: { style: 'thin', color: { argb: 'FFCFD7DC' } },
      right: { style: 'thin', color: { argb: 'FFCFD7DC' } },
    };
  });

  for (const section of sections) {
    const link = surveyLinkOf(section.linkToken);
    const row = sheet.addRow([
      `${section.courseCode} - ${section.courseName} (${section.sectionName})`,
      section.departmentName,
      section.lecturerName || 'Chưa phân công',
      section.classSize,
      link,
      formatRange(section.startTime, section.endTime),
      '',
    ]);
    row.height = qrRowHeight;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.alignment = {
        vertical: 'middle',
        horizontal: columnNumber === 4 ? 'center' : 'left',
        wrapText: columnNumber <= 3,
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE3E7EA' } },
        left: { style: 'thin', color: { argb: 'FFE3E7EA' } },
        bottom: { style: 'thin', color: { argb: 'FFE3E7EA' } },
        right: { style: 'thin', color: { argb: 'FFE3E7EA' } },
      };
    });

    const dataUrl = await QRCode.toDataURL(link, {
      width: qrPixelSize,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
    const imageId = workbook.addImage({ base64: dataUrl, extension: 'png' });

    // Neo hai góc: ô QR là cột thứ 7 (chỉ số 6) của đúng hàng này. `br` là góc
    // dưới-phải nên trỏ sang ô kế tiếp, tức ảnh phủ trọn một ô.
    //
    // `editAs: 'twoCell'` là mấu chốt. Mặc định ExcelJS ghi ra editAs="oneCell",
    // tức Excel hiểu là "di chuyển theo ô nhưng KHÔNG đổi kích thước" — kéo rộng
    // cột thì ô to ra mà mã QR vẫn nguyên cỡ cũ. Với "twoCell" thì ảnh bám cả hai
    // góc nên co giãn đúng theo ô.
    //
    // Ép kiểu vì khai báo `Anchor` của ExcelJS đòi đủ nativeCol/nativeRow…, còn
    // dạng {col, row} mới là API trong tài liệu.
    sheet.addImage(imageId, {
      tl: { col: 6, row: row.number - 1 } as never,
      br: { col: 7, row: row.number } as never,
      editAs: 'twoCell' as never,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const safeName = surveyName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'dot-khao-sat';

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `ma-qr-${safeName}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
