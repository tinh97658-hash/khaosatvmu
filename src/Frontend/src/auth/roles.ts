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

/**
 * Vai trò chỉ đọc: xem được dữ liệu trong phạm vi của mình nhưng không ghi được gì.
 * Giảng viên chỉ có mỗi việc theo dõi lớp mình dạy và tiến độ thu phiếu.
 *
 * Cũng chỉ để ẩn nút. Backend tự từ chối mọi thao tác ghi của vai trò này, xem
 * congviec3.md mục H3.
 */
export function isReadOnlyRole(roleCode: string | null | undefined): boolean {
  return roleCode === ROLE_CODES.lecturer;
}

/**
 * Chỉ quản trị mới được THÊM hoặc XOÁ bản ghi trong Danh mục đào tạo. Trưởng bộ môn
 * và giảng viên chỉ xem, và sửa những gì thuộc phạm vi của mình — danh mục là dữ
 * liệu nền của cả trường, thêm bớt phải đi qua một đầu mối.
 *
 * Cũng chỉ để ẩn nút. Backend tự từ chối mọi thao tác ghi ngoài phạm vi.
 */
export function canCreateOrDeleteCatalog(roleCode: string | null | undefined): boolean {
  return isUnrestrictedRole(roleCode);
}
