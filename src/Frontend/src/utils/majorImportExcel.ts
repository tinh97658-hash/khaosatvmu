import type { CellValue } from 'read-excel-file/browser';
import type { SheetData } from 'write-excel-file/browser';

const maximumFileSize = 5 * 1024 * 1024;
const maximumRows = 500;
const majorNameHeaders = new Set([
  'ten nganh hoc',
  'ten nganh',
  'nganh hoc',
  'majorname',
  'major name',
]);
const facultyNameHeaders = new Set([
  'ten khoa vien',
  'ten khoa/vien',
  'ten khoa / vien',
  'ten khoa',
  'khoa vien',
  'facultyname',
  'faculty name',
]);

export interface ImportMajorRow {
  rowNumber: number;
  majorName: string;
  /** Tên khoa viện trong tệp; App tra tên này ra "Majors"."FacultyId". */
  facultyName: string;
}

export type MajorImportFileErrorCode =
  | 'FILE_TYPE'
  | 'FILE_SIZE'
  | 'FILE_EMPTY'
  | 'NAME_HEADER_MISSING'
  | 'FACULTY_HEADER_MISSING'
  | 'NO_DATA_ROWS'
  | 'TOO_MANY_ROWS'
  | 'READ_FAILED';

export class MajorImportFileError extends Error {
  public readonly code: MajorImportFileErrorCode;

  constructor(code: MajorImportFileErrorCode) {
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

export const majorTemplateFileName = 'mau-import-nganh-hoc.xlsx';

/**
 * Tạo và tải tệp Excel mẫu: cột "Tên ngành học" và cột "Tên khoa viện".
 * Khi import, tên khoa viện được tra ngược ra FacultyId.
 */
export async function downloadMajorImportTemplate(): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');

  const data: SheetData = [
    [
      { value: 'Tên ngành học', type: String, fontWeight: 'bold' },
      { value: 'Tên khoa viện', type: String, fontWeight: 'bold' },
    ],
    [
      { value: 'Công nghệ Thông tin', type: String },
      { value: 'Khoa Công nghệ Thông tin', type: String },
    ],
    [
      { value: 'Kỹ thuật Phần mềm', type: String },
      { value: 'Khoa Công nghệ Thông tin', type: String },
    ],
    [
      { value: 'Kỹ thuật Điện tử - Viễn thông', type: String },
      { value: 'Khoa Điện - Điện tử', type: String },
    ],
  ];

  await writeXlsxFile(data, {
    sheet: 'Nganh hoc',
    columns: [{ width: 38 }, { width: 38 }],
  }).toFile(majorTemplateFileName);
}

/** Đọc tệp .xlsx và lấy cột tên ngành học kèm tên khoa viện. */
export async function parseMajorImportFile(file: File): Promise<ImportMajorRow[]> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new MajorImportFileError('FILE_TYPE');
  }
  if (file.size > maximumFileSize) {
    throw new MajorImportFileError('FILE_SIZE');
  }

  let sheet;
  try {
    const { readSheet } = await import('read-excel-file/browser');
    sheet = await readSheet(file);
  } catch {
    throw new MajorImportFileError('READ_FAILED');
  }

  if (sheet.length === 0) {
    throw new MajorImportFileError('FILE_EMPTY');
  }

  const headers = sheet[0].map((value) => normalizeHeader(cellText(value)));
  const nameIndex = headers.findIndex((header) => majorNameHeaders.has(header));
  if (nameIndex < 0) {
    throw new MajorImportFileError('NAME_HEADER_MISSING');
  }
  const facultyIndex = headers.findIndex((header) => facultyNameHeaders.has(header));
  if (facultyIndex < 0) {
    throw new MajorImportFileError('FACULTY_HEADER_MISSING');
  }

  const rows = sheet
    .slice(1)
    .map((row, index) => ({
      rowNumber: index + 2,
      majorName: cellText(row[nameIndex]),
      facultyName: cellText(row[facultyIndex]),
    }))
    .filter((row) => row.majorName.length > 0 || row.facultyName.length > 0);

  if (rows.length === 0) {
    throw new MajorImportFileError('NO_DATA_ROWS');
  }
  if (rows.length > maximumRows) {
    throw new MajorImportFileError('TOO_MANY_ROWS');
  }

  return rows;
}
