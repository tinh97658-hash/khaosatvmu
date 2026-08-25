export const MODULE_REQUIRED_PERMISSION: Record<string, string | null> = {
  overview: null,
  progress: 'PROGRESS_ACCESS',
  reports: 'REPORTS_ACCESS',
  'survey-statistics': 'SURVEY_STATISTICS_ACCESS',
  'survey-analysis': 'SURVEY_ANALYSIS_ACCESS',
  'graduation-analytics': 'GRADUATION_ANALYTICS_ACCESS',
  'survey-dashboard': 'SURVEY_DASHBOARD_ACCESS',
  faculties: 'FACULTIES_ACCESS',
  departments: 'DEPARTMENTS_ACCESS',
  lecturers: 'LECTURERS_ACCESS',
  majors: 'MAJORS_ACCESS',
  courses: 'COURSES_ACCESS',
  classes: 'COURSE_SECTIONS_ACCESS',
  'course-question-sets': 'COURSE_QUESTION_SETS_ACCESS',
  // Legacy hashes remain guarded while old bookmarks are still accepted.
  criteria: 'COURSE_QUESTION_SETS_ACCESS',
  'course-campaigns': 'COURSE_CAMPAIGNS_ACCESS',
  campaigns: 'COURSE_CAMPAIGNS_ACCESS',
  'program-campaigns': 'PROGRAM_CAMPAIGNS_ACCESS',
  'program-criteria': 'PROGRAM_CRITERIA_ACCESS',
  'users-admin': 'USER_ADMIN_ACCESS',
};

export function canAccessModule(
  permissions: readonly string[] | undefined,
  moduleId: string,
): boolean {
  const required = MODULE_REQUIRED_PERMISSION[moduleId] ?? null;
  return required === null || permissions?.includes(required) === true;
}

/**
 * Quyền của từng TAB bên trong một module. Vào được module chưa chắc xem được
 * mọi tab: mỗi tab ở đây có một quyền riêng, và backend chặn ngay tại endpoint
 * của tab đó chứ không dựa vào việc giao diện đã ẩn nút.
 *
 * Khóa có dạng "<moduleId>:<tabId>".
 */
export const TAB_REQUIRED_PERMISSION: Record<string, string> = {
  // Thống kê & Báo cáo
  'reports:overview': 'REPORTS_OVERVIEW_ACCESS',
  'reports:details': 'REPORTS_DETAILS_ACCESS',
  'reports:rankings': 'REPORTS_RANKINGS_ACCESS',

  // Phân tích chuyên sâu. Hai tab chuẩn hoá đọc chung một endpoint nên dùng
  // chung một quyền — tách riêng thì chỉ ẩn được nút, không chặn được dữ liệu.
  'survey-analysis:normalization': 'SURVEY_ANALYSIS_NORMALIZATION_ACCESS',
  'survey-analysis:normalizationSections': 'SURVEY_ANALYSIS_NORMALIZATION_ACCESS',
  'survey-analysis:departments': 'SURVEY_ANALYSIS_DEPARTMENTS_ACCESS',
  'survey-analysis:courses': 'SURVEY_ANALYSIS_COURSES_ACCESS',
  'survey-analysis:lecturer': 'SURVEY_ANALYSIS_LECTURER_ACCESS',

  // Người dùng & phân quyền
  'users-admin:users': 'USER_ADMIN_ACCOUNTS_ACCESS',
  'users-admin:audit': 'USER_ADMIN_AUDIT_ACCESS',
  'users-admin:permissions': 'USER_ADMIN_PERMISSIONS_ACCESS',
};

export function canAccessTab(
  permissions: readonly string[] | undefined,
  moduleId: string,
  tabId: string,
): boolean {
  const required = TAB_REQUIRED_PERMISSION[`${moduleId}:${tabId}`];
  return required === undefined || permissions?.includes(required) === true;
}

/** Tab đầu tiên còn xem được, dùng khi tab đang chọn bị tắt quyền. */
export function firstAllowedTab<T extends string>(
  permissions: readonly string[] | undefined,
  moduleId: string,
  tabIds: readonly T[],
): T | null {
  return tabIds.find((tabId) => canAccessTab(permissions, moduleId, tabId)) ?? null;
}
