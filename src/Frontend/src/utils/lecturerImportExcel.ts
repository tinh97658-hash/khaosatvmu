import type { CellValue } from 'read-excel-file/browser';
import type { SheetData } from 'write-excel-file/browser';

const maximumFileSize = 5 * 1024 * 1024;
const maximumRows = 500;

const fullNameHeaders = new Set([
  'ho va ten',
  'ho ten',
  'ten giang vien',
  'fullname',
  'full name',
]);
const emailHeaders = new Set(['email', 'email cong vu', 'gmail']);
const phoneHeaders = new Set(['so dien thoai', 'dien thoai', 'sdt', 'phonenumber', 'phone number']);
const facultyNameHeaders = new Set([
  'ten khoa vien',
  'ten khoa/vien',
  'ten khoa / vien',
  'ten khoa',
  'khoa vien',
  'facultyname',
  'faculty name',
]);
const departmentNameHeaders = new Set([
  'ten bo mon',
  'bo mon',
  'departmentname',
  'department name',
]);

export interface ImportLecturerRow {
  rowNumber: number;
  fullName: string;
  email: string;
  phoneNumber: string;
  /** Tra ngược ra "Lecturers"."FacultyId". */
  facultyName: string;
  /** Tra ngược ra "Lecturers"."DepartmentId". */
  departmentName: string;
}

export type LecturerImportFileErrorCode =
  | 'FILE_TYPE'
  | 'FILE_SIZE'
  | 'FILE_EMPTY'
  | 'NAME_HEADER_MISSING'
  | 'EMAIL_HEADER_MISSING'
  | 'NO_DATA_ROWS'
  | 'TOO_MANY_ROWS'
  | 'READ_FAILED';

export class LecturerImportFileError extends Error {
  public readonly code: LecturerImportFileErrorCode;

  constructor(code: LecturerImportFileErrorCode) {
    super(code);
    this.code = code;
  }
}

// Dấu thanh tiếng Việt sau khi normalize('NFD') nằm trong dải U+0300..U+036F.
const combiningMarks = new RegExp('[\\u0300-\\u036f]', 'g');

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(combiningMarks, '')
    .replace(/đ/gi, 'd')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function cellText(value: CellValue | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

export const lecturerTemplateFileName = 'mau-import-giang-vien.xlsx';

/**
 * Tạo và tải tệp Excel mẫu cho giảng viên. Khoa viện và bộ môn ghi theo tên,
 * khi import được tra ngược ra id.
 */
export async function downloadLecturerImportTemplate(): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');

  const header = ['Họ và tên', 'Email', 'Số điện thoại', 'Tên khoa viện', 'Tên bộ môn'];

  const rows = [
    ['Nguyễn Văn Hải', 'hainv@vimaru.edu.vn', '0912345678', 'Khoa Công nghệ Thông tin', 'Bộ môn Công nghệ Phần mềm'],
    ['Trần Thị Bình', 'binhtt@vimaru.edu.vn', '0987654321', 'Khoa Công nghệ Thông tin', ''],
    ['Lê Văn Cường', 'cuonglv@vimaru.edu.vn', '', 'Khoa Điện - Điện tử', ''],
  ];

  const data: SheetData = [
    header.map((value) => ({ value, type: String, fontWeight: 'bold' as const })),
    ...rows.map((row) => row.map((value) => ({ value, type: String }))),
  ];

  await writeXlsxFile(data, {
    sheet: 'Giang vien',
    columns: [{ width: 26 }, { width: 30 }, { width: 18 }, { width: 30 }, { width: 30 }],
  }).toFile(lecturerTemplateFileName);
}

/** Đọc tệp .xlsx của danh mục giảng viên. */
export async function parseLecturerImportFile(file: File): Promise<ImportLecturerRow[]> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new LecturerImportFileError('FILE_TYPE');
  }
  if (file.size > maximumFileSize) {
    throw new LecturerImportFileError('FILE_SIZE');
  }

  let sheet;
  try {
    const { readSheet } = await import('read-excel-file/browser');
    sheet = await readSheet(file);
  } catch {
    throw new LecturerImportFileError('READ_FAILED');
  }

  if (sheet.length === 0) {
    throw new LecturerImportFileError('FILE_EMPTY');
  }

  const headers = sheet[0].map((value) => normalizeHeader(cellText(value)));
  const indexOf = (candidates: Set<string>) =>
    headers.findIndex((header) => candidates.has(header));

  const nameIndex = indexOf(fullNameHeaders);
  if (nameIndex < 0) {
    throw new LecturerImportFileError('NAME_HEADER_MISSING');
  }
  // Cột Email là tùy chọn: "Lecturers"."Email" cho phép NULL.
  const emailIndex = indexOf(emailHeaders);
  const phoneIndex = indexOf(phoneHeaders);
  const facultyIndex = indexOf(facultyNameHeaders);
  const departmentIndex = indexOf(departmentNameHeaders);

  const pick = (row: readonly (CellValue | null)[], index: number) =>
    index < 0 ? '' : cellText(row[index]);

  const rows = sheet
    .slice(1)
    .map((row, index) => ({
      rowNumber: index + 2,
      fullName: cellText(row[nameIndex]),
      email: pick(row, emailIndex),
      phoneNumber: pick(row, phoneIndex),
      facultyName: pick(row, facultyIndex),
      departmentName: pick(row, departmentIndex),
    }))
    .filter((row) => row.fullName.length > 0 || row.email.length > 0);

  if (rows.length === 0) {
    throw new LecturerImportFileError('NO_DATA_ROWS');
  }
  if (rows.length > maximumRows) {
    throw new LecturerImportFileError('TOO_MANY_ROWS');
  }

  return rows;
}
