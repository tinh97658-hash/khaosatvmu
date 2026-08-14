import type { CellValue } from 'read-excel-file/browser';
import type { SheetData } from 'write-excel-file/browser';

const maximumFileSize = 5 * 1024 * 1024;
const maximumRows = 500;

const courseCodeHeaders = new Set(['ma hoc phan', 'ma mon hoc', 'coursecode', 'course code']);
const courseNameHeaders = new Set(['ten hoc phan', 'ten mon hoc', 'coursename', 'course name']);
const creditsHeaders = new Set(['so tin chi', 'tin chi', 'credits']);
const courseTypeHeaders = new Set(['loai hoc phan', 'loai mon hoc', 'coursetype', 'course type']);
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
const prerequisiteHeaders = new Set([
  'ma hoc phan tien quyet',
  'hoc phan tien quyet',
  'tien quyet',
  'prerequisitecoursecode',
  'prerequisite course code',
]);

export interface ImportCourseRow {
  rowNumber: number;
  courseCode: string;
  courseName: string;
  credits: string;
  courseType: string;
  /** Tra ngược ra "Courses"."FacultyId". */
  facultyName: string;
  /** Tra ngược ra "Courses"."DepartmentId". */
  departmentName: string;
  /** Tra ngược ra "Courses"."PrerequisiteCourseId". */
  prerequisiteCourseCode: string;
}

export type CourseImportFileErrorCode =
  | 'FILE_TYPE'
  | 'FILE_SIZE'
  | 'FILE_EMPTY'
  | 'CODE_HEADER_MISSING'
  | 'NAME_HEADER_MISSING'
  | 'NO_DATA_ROWS'
  | 'TOO_MANY_ROWS'
  | 'READ_FAILED';

export class CourseImportFileError extends Error {
  public readonly code: CourseImportFileErrorCode;

  constructor(code: CourseImportFileErrorCode) {
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

export const courseTemplateFileName = 'mau-import-hoc-phan.xlsx';

/**
 * Tạo và tải tệp Excel mẫu cho học phần. Khoa viện, bộ môn và học phần tiên
 * quyết ghi theo tên / mã, khi import được tra ngược ra id.
 */
export async function downloadCourseImportTemplate(): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');

  const header = [
    'Mã học phần',
    'Tên học phần',
    'Số tín chỉ',
    'Loại học phần',
    'Tên khoa viện',
    'Tên bộ môn',
    'Mã học phần tiên quyết',
  ];

  const rows = [
    ['19783', 'Lập trình Web nâng cao', '3', 'Bắt buộc', 'Khoa Công nghệ Thông tin', 'Bộ môn Công nghệ Phần mềm', ''],
    ['19784', 'Trí tuệ nhân tạo', '3', 'Tự chọn', 'Khoa Công nghệ Thông tin', 'Bộ môn Công nghệ Phần mềm', '19783'],
    ['20101', 'Kỹ thuật điện tử', '4', 'Bắt buộc', 'Khoa Điện - Điện tử', '', ''],
  ];

  const data: SheetData = [
    header.map((value) => ({ value, type: String, fontWeight: 'bold' as const })),
    ...rows.map((row) => row.map((value) => ({ value, type: String }))),
  ];

  await writeXlsxFile(data, {
    sheet: 'Hoc phan',
    columns: [
      { width: 16 },
      { width: 34 },
      { width: 12 },
      { width: 16 },
      { width: 30 },
      { width: 30 },
      { width: 22 },
    ],
  }).toFile(courseTemplateFileName);
}

/** Đọc tệp .xlsx của danh mục học phần. */
export async function parseCourseImportFile(file: File): Promise<ImportCourseRow[]> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new CourseImportFileError('FILE_TYPE');
  }
  if (file.size > maximumFileSize) {
    throw new CourseImportFileError('FILE_SIZE');
  }

  let sheet;
  try {
    const { readSheet } = await import('read-excel-file/browser');
    sheet = await readSheet(file);
  } catch {
    throw new CourseImportFileError('READ_FAILED');
  }

  if (sheet.length === 0) {
    throw new CourseImportFileError('FILE_EMPTY');
  }

  const headers = sheet[0].map((value) => normalizeHeader(cellText(value)));
  const indexOf = (candidates: Set<string>) =>
    headers.findIndex((header) => candidates.has(header));

  const codeIndex = indexOf(courseCodeHeaders);
  if (codeIndex < 0) {
    throw new CourseImportFileError('CODE_HEADER_MISSING');
  }
  const nameIndex = indexOf(courseNameHeaders);
  if (nameIndex < 0) {
    throw new CourseImportFileError('NAME_HEADER_MISSING');
  }
  const creditsIndex = indexOf(creditsHeaders);
  const typeIndex = indexOf(courseTypeHeaders);
  const facultyIndex = indexOf(facultyNameHeaders);
  const departmentIndex = indexOf(departmentNameHeaders);
  const prerequisiteIndex = indexOf(prerequisiteHeaders);

  const pick = (row: readonly (CellValue | null)[], index: number) =>
    index < 0 ? '' : cellText(row[index]);

  const rows = sheet
    .slice(1)
    .map((row, index) => ({
      rowNumber: index + 2,
      courseCode: cellText(row[codeIndex]),
      courseName: cellText(row[nameIndex]),
      credits: pick(row, creditsIndex),
      courseType: pick(row, typeIndex),
      facultyName: pick(row, facultyIndex),
      departmentName: pick(row, departmentIndex),
      prerequisiteCourseCode: pick(row, prerequisiteIndex),
    }))
    .filter((row) => row.courseCode.length > 0 || row.courseName.length > 0);

  if (rows.length === 0) {
    throw new CourseImportFileError('NO_DATA_ROWS');
  }
  if (rows.length > maximumRows) {
    throw new CourseImportFileError('TOO_MANY_ROWS');
  }

  return rows;
}
