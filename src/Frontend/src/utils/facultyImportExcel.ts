import type { CellValue } from 'read-excel-file/browser';
import type { SheetData } from 'write-excel-file/browser';

const maximumFileSize = 5 * 1024 * 1024;
const maximumRows = 500;
const facultyNameHeaders = new Set([
  'ten khoa vien',
  'ten khoa/vien',
  'ten khoa / vien',
  'ten khoa',
  'khoa vien',
  'facultyname',
  'faculty name',
]);

export interface ImportFacultyRow {
  rowNumber: number;
  facultyName: string;
}

export type FacultyImportFileErrorCode =
  | 'FILE_TYPE'
  | 'FILE_SIZE'
  | 'FILE_EMPTY'
  | 'NAME_HEADER_MISSING'
  | 'NO_DATA_ROWS'
  | 'TOO_MANY_ROWS'
  | 'READ_FAILED';

export class FacultyImportFileError extends Error {
  public readonly code: FacultyImportFileErrorCode;

  constructor(code: FacultyImportFileErrorCode) {
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

export const facultyTemplateFileName = 'mau-import-khoa-vien.xlsx';

/**
 * Tạo và tải tệp Excel mẫu: một cột "Tên khoa viện" kèm vài dòng ví dụ, đúng
 * định dạng mà parseFacultyImportFile đọc được.
 */
export async function downloadFacultyImportTemplate(): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');

  const data: SheetData = [
    [{ value: 'Tên khoa viện', type: String, fontWeight: 'bold' }],
    [{ value: 'Khoa Công nghệ Thông tin', type: String }],
    [{ value: 'Khoa Điện - Điện tử', type: String }],
    [{ value: 'Viện Đào tạo Quốc tế', type: String }],
  ];

  await writeXlsxFile(data, {
    sheet: 'Khoa vien',
    columns: [{ width: 42 }],
  }).toFile(facultyTemplateFileName);
}

/** Đọc tệp .xlsx và lấy cột tên khoa viện. Mỗi dòng dữ liệu là một khoa / viện. */
export async function parseFacultyImportFile(file: File): Promise<ImportFacultyRow[]> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new FacultyImportFileError('FILE_TYPE');
  }
  if (file.size > maximumFileSize) {
    throw new FacultyImportFileError('FILE_SIZE');
  }

  let sheet;
  try {
    const { readSheet } = await import('read-excel-file/browser');
    sheet = await readSheet(file);
  } catch {
    throw new FacultyImportFileError('READ_FAILED');
  }

  if (sheet.length === 0) {
    throw new FacultyImportFileError('FILE_EMPTY');
  }

  const headers = sheet[0].map((value) => normalizeHeader(cellText(value)));
  const nameIndex = headers.findIndex((header) => facultyNameHeaders.has(header));
  if (nameIndex < 0) {
    throw new FacultyImportFileError('NAME_HEADER_MISSING');
  }

  const rows = sheet
    .slice(1)
    .map((row, index) => ({
      rowNumber: index + 2,
      facultyName: cellText(row[nameIndex]),
    }))
    .filter((row) => row.facultyName.length > 0);

  if (rows.length === 0) {
    throw new FacultyImportFileError('NO_DATA_ROWS');
  }
  if (rows.length > maximumRows) {
    throw new FacultyImportFileError('TOO_MANY_ROWS');
  }

  return rows;
}
