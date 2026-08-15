import type { CellValue } from 'read-excel-file/browser';
import type { SheetData } from 'write-excel-file/browser';

const maximumFileSize = 5 * 1024 * 1024;
const maximumRows = 500;

const courseCodeHeaders = new Set(['ma hoc phan', 'ma mon hoc', 'coursecode', 'course code']);
const courseNameHeaders = new Set(['ten hoc phan', 'ten mon hoc', 'coursename', 'course name']);
const sectionNameHeaders = new Set([
  'ten lop',
  'ten lop hoc phan',
  'lop hoc phan',
  'sectionname',
  'section name',
]);
const classSizeHeaders = new Set(['si so', 'so sinh vien', 'classsize', 'class size']);
const lecturerEmailHeaders = new Set([
  'email giang vien',
  'email',
  'email cong vu',
  'lectureremail',
]);
const lecturerNameHeaders = new Set([
  'ho va ten giang vien',
  'ho ten giang vien',
  'ten giang vien',
  'giang vien',
  'lecturerfullname',
]);
const lecturerDepartmentHeaders = new Set([
  'bo mon giang vien',
  'ten bo mon',
  'bo mon',
  'departmentname',
]);
const lecturerFacultyHeaders = new Set([
  'khoa vien giang vien',
  'ten khoa vien',
  'khoa vien',
  'ten khoa',
  'facultyname',
]);

export interface ImportCourseSectionRow {
  rowNumber: number;
  /** Tra ngược ra "CourseSections"."CourseId". */
  courseCode: string;
  /** Chỉ để người dùng đối chiếu khi xem tệp, không dùng để tra. */
  courseName: string;
  sectionName: string;
  classSize: string;
  /** Tra ngược ra "CourseSections"."LecturerId": ưu tiên email, sau đó tên + bộ môn + khoa. */
  lecturerEmail: string;
  lecturerFullName: string;
  lecturerDepartmentName: string;
  lecturerFacultyName: string;
}

export type CourseSectionImportFileErrorCode =
  | 'FILE_TYPE'
  | 'FILE_SIZE'
  | 'FILE_EMPTY'
  | 'CODE_HEADER_MISSING'
  | 'NAME_HEADER_MISSING'
  | 'NO_DATA_ROWS'
  | 'TOO_MANY_ROWS'
  | 'READ_FAILED';

export class CourseSectionImportFileError extends Error {
  public readonly code: CourseSectionImportFileErrorCode;

  constructor(code: CourseSectionImportFileErrorCode) {
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

export const courseSectionTemplateFileName = 'mau-import-lop-hoc-phan.xlsx';

/**
 * Tạo và tải tệp Excel mẫu cho lớp học phần. Học kỳ lấy từ học kỳ đang chọn
 * trên cây bên trái nên tệp không cần cột học kỳ.
 */
export async function downloadCourseSectionImportTemplate(): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');

  const header = [
    'Mã học phần',
    'Tên học phần',
    'Tên lớp',
    'Sĩ số',
    'Email giảng viên',
    'Họ và tên giảng viên',
    'Bộ môn giảng viên',
    'Khoa viện giảng viên',
  ];

  const rows = [
    [
      '19783',
      'Lập trình Web nâng cao',
      'IT201.01',
      '60',
      'hainv@vimaru.edu.vn',
      'Nguyễn Văn Hải',
      'Bộ môn Công nghệ Phần mềm',
      'Khoa Công nghệ Thông tin',
    ],
    [
      '19783',
      'Lập trình Web nâng cao',
      'IT201.02',
      '55',
      '',
      'Trần Thị Bình',
      'Bộ môn Công nghệ Phần mềm',
      'Khoa Công nghệ Thông tin',
    ],
    [
      '20101',
      'Kỹ thuật điện tử',
      'DT101.01',
      '48',
      '',
      'Lê Văn Cường',
      '',
      'Khoa Điện - Điện tử',
    ],
  ];

  const data: SheetData = [
    header.map((value) => ({ value, type: String, fontWeight: 'bold' as const })),
    ...rows.map((row) => row.map((value) => ({ value, type: String }))),
  ];

  await writeXlsxFile(data, {
    sheet: 'Lop hoc phan',
    columns: [
      { width: 16 },
      { width: 30 },
      { width: 18 },
      { width: 10 },
      { width: 28 },
      { width: 26 },
      { width: 30 },
      { width: 30 },
    ],
  }).toFile(courseSectionTemplateFileName);
}

/** Đọc tệp .xlsx của danh sách lớp học phần. */
export async function parseCourseSectionImportFile(file: File): Promise<ImportCourseSectionRow[]> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new CourseSectionImportFileError('FILE_TYPE');
  }
  if (file.size > maximumFileSize) {
    throw new CourseSectionImportFileError('FILE_SIZE');
  }

  let sheet;
  try {
    const { readSheet } = await import('read-excel-file/browser');
    sheet = await readSheet(file);
  } catch {
    throw new CourseSectionImportFileError('READ_FAILED');
  }

  if (sheet.length === 0) {
    throw new CourseSectionImportFileError('FILE_EMPTY');
  }

  const headers = sheet[0].map((value) => normalizeHeader(cellText(value)));
  const indexOf = (candidates: Set<string>) =>
    headers.findIndex((header) => candidates.has(header));

  const codeIndex = indexOf(courseCodeHeaders);
  if (codeIndex < 0) {
    throw new CourseSectionImportFileError('CODE_HEADER_MISSING');
  }
  const nameIndex = indexOf(sectionNameHeaders);
  if (nameIndex < 0) {
    throw new CourseSectionImportFileError('NAME_HEADER_MISSING');
  }
  const sizeIndex = indexOf(classSizeHeaders);
  const courseNameIndex = indexOf(courseNameHeaders);
  const lecturerEmailIndex = indexOf(lecturerEmailHeaders);
  const lecturerNameIndex = indexOf(lecturerNameHeaders);
  const lecturerDepartmentIndex = indexOf(lecturerDepartmentHeaders);
  const lecturerFacultyIndex = indexOf(lecturerFacultyHeaders);

  const pick = (row: readonly (CellValue | null)[], index: number) =>
    index < 0 ? '' : cellText(row[index]);

  const rows = sheet
    .slice(1)
    .map((row, index) => ({
      rowNumber: index + 2,
      courseCode: cellText(row[codeIndex]),
      courseName: pick(row, courseNameIndex),
      sectionName: cellText(row[nameIndex]),
      classSize: pick(row, sizeIndex),
      lecturerEmail: pick(row, lecturerEmailIndex),
      lecturerFullName: pick(row, lecturerNameIndex),
      lecturerDepartmentName: pick(row, lecturerDepartmentIndex),
      lecturerFacultyName: pick(row, lecturerFacultyIndex),
    }))
    .filter((row) => row.courseCode.length > 0 || row.sectionName.length > 0);

  if (rows.length === 0) {
    throw new CourseSectionImportFileError('NO_DATA_ROWS');
  }
  if (rows.length > maximumRows) {
    throw new CourseSectionImportFileError('TOO_MANY_ROWS');
  }

  return rows;
}
