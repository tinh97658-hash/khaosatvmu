import type { Department, Faculty, Lecturer } from '../types';

/**
 * Dựng dữ liệu cho sheet tra cứu của các tệp mẫu import. Tách riêng vì cùng một
 * bảng bộ môn được ba tệp mẫu dùng lại (học phần, giảng viên, lớp học phần), và
 * cả ba đều phải hiện đúng một kiểu để người điền không phải học lại bố cục.
 */

/** Một dòng của sheet "Danh sách bộ môn". */
export interface DepartmentLookupRow {
  departmentId: number;
  departmentName: string;
  facultyName: string;
}

/** Một dòng của sheet "Danh sách giảng viên". */
export interface LecturerLookupRow extends DepartmentLookupRow {
  fullName: string;
  email: string;
}

export const departmentLookupHeaders = ['Mã bộ môn', 'Bộ môn', 'Khoa / Viện'];
export const departmentLookupWidths = [14, 40, 40];

export const lecturerLookupHeaders = [
  'Họ tên',
  'Mã bộ môn',
  'Bộ môn',
  'Khoa / Viện',
  'Email giảng viên',
];
export const lecturerLookupWidths = [30, 14, 36, 36, 32];

export function buildDepartmentLookupRows(
  departments: Department[],
  faculties: Faculty[]
): DepartmentLookupRow[] {
  const facultyNameById = new Map(faculties.map((x) => [x.facultyId, x.facultyName]));

  return departments
    .map((department) => ({
      departmentId: department.departmentId,
      departmentName: department.departmentName,
      facultyName:
        department.facultyId === null
          ? ''
          : facultyNameById.get(department.facultyId) ?? '',
    }))
    .sort(
      (left, right) =>
        left.facultyName.localeCompare(right.facultyName, 'vi')
        || left.departmentName.localeCompare(right.departmentName, 'vi')
    );
}

export function buildLecturerLookupRows(
  lecturers: Lecturer[],
  departments: Department[],
  faculties: Faculty[]
): LecturerLookupRow[] {
  const facultyNameById = new Map(faculties.map((x) => [x.facultyId, x.facultyName]));
  const departmentById = new Map(departments.map((x) => [x.departmentId, x]));

  return lecturers
    .map((lecturer) => {
      const department =
        lecturer.departmentId === null ? undefined : departmentById.get(lecturer.departmentId);
      // Giảng viên có thể gắn thẳng vào khoa mà chưa có bộ môn, nên lấy khoa của
      // bộ môn trước, không có thì lấy khoa ghi ngay trên giảng viên.
      const facultyId = department?.facultyId ?? lecturer.facultyId;

      return {
        fullName: lecturer.fullName,
        departmentId: department?.departmentId ?? 0,
        departmentName: department?.departmentName ?? '',
        facultyName: facultyId === null ? '' : facultyNameById.get(facultyId) ?? '',
        email: lecturer.email ?? '',
      };
    })
    .sort(
      (left, right) =>
        left.facultyName.localeCompare(right.facultyName, 'vi')
        || left.departmentName.localeCompare(right.departmentName, 'vi')
        || left.fullName.localeCompare(right.fullName, 'vi')
    );
}

export const departmentLookupValues = (row: DepartmentLookupRow) => [
  row.departmentId > 0 ? row.departmentId : '',
  row.departmentName,
  row.facultyName,
];

export const lecturerLookupValues = (row: LecturerLookupRow) => [
  row.fullName,
  row.departmentId > 0 ? row.departmentId : '',
  row.departmentName,
  row.facultyName,
  row.email,
];
