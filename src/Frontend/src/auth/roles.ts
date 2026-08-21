/** Mã vai trò có thật trong bảng "Roles". Khớp với RoleCodes bên backend. */
export const ROLE_CODES = {
  admin: 'ADMIN',
  surveyAdmin: 'SURVEY_ADMIN',
  departmentManager: 'DEPARTMENT_MANAGER',
  lecturer: 'LECTURER',
} as const;

/**
 * Vai trò cấp quản trị: không bị giới hạn phạm vi dữ liệu và được làm mọi thao tác
 * ghi. Các vai trò còn lại chỉ thấy và sửa được dữ liệu bộ môn của mình.
 *
 * Dùng để ẩn bớt nút cho gọn mắt. Việc chặn thật nằm ở backend — mỗi endpoint ghi tự
 * kiểm lại phạm vi chứ không tin vào chuyện nút đã bị ẩn.
 */
export function isUnrestrictedRole(roleCode: string | null | undefined): boolean {
  return roleCode === ROLE_CODES.admin || roleCode === ROLE_CODES.surveyAdmin;
}
