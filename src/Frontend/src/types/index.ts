// ---------------------------------------------------------------------------
// DANH MỤC ĐÀO TẠO
// Tên trường và tính nullable khớp 1-1 với cột của bảng tương ứng trong dtb.md.
// ---------------------------------------------------------------------------

/** Bảng "Faculties" */
export interface Faculty {
  facultyId: number;
  facultyName: string;
}

/** Bảng "Departments" */
export interface Department {
  departmentId: number;
  departmentName: string;
  facultyId: number | null;
}

/** Bảng "Lecturers" */
export interface Lecturer {
  lecturerId: number;
  fullName: string;
  departmentId: number | null;
  facultyId: number | null;
  email: string | null;
  phoneNumber: string | null;
}

/** Bảng "Majors" */
export interface Major {
  majorId: number;
  majorName: string;
  facultyId: number;
}

/** Bảng "Curricula" */
export interface Curriculum {
  curriculumId: number;
  majorId: number;
  totalCredits: number;
  requiredCredits: number;
  minElectiveCredits: number;
}

/** Bảng "CurriculumCourses" */
export interface CurriculumCourse {
  id: number;
  curriculumId: number;
  courseId: number;
  semesterOrder: number;
}

/** Cột "Courses"."CourseType" */
export type CourseType = 'Required' | 'Elective';

/** Bảng "Courses" */
export interface Course {
  courseId: number;
  courseCode: string;
  courseName: string;
  credits: number;
  /** Chuỗi rỗng khi tệp import không ghi loại học phần; cột có DEFAULT ''. */
  courseType: CourseType | '';
  departmentId: number | null;
  facultyId: number | null;
  prerequisiteCourseId: number | null;
}

/** Bảng "Semesters" */
export interface Semester {
  semesterId: number;
  semesterName: string;
  academicYearId: number;
}

/** Bảng "AcademicYears", kèm học kỳ để dựng cây bên trái trang lớp học phần. */
export interface AcademicYear {
  academicYearId: number;
  academicYearName: string;
  /** YYYY-MM-DD */
  startDate: string;
  endDate: string;
  semesters: Semester[];
}

/** Bảng "CourseSections" */
export interface CourseSection {
  courseSectionId: number;
  courseId: number;
  semesterId: number;
  /** NOT NULL: mỗi lớp học phần có đúng một giảng viên. */
  lecturerId: number;
  sectionName: string;
  classSize: number;
}

export interface Criterion {
  id: string;
  category: 'Học phần' | 'Chương trình đào tạo';
  groupName: string; // e.g., "Nội dung giảng dạy", "Đội ngũ giảng viên", "CSVC"
  code: string;
  question: string;
  weight: number;
  status: 'Kích hoạt' | 'Tạm ẩn';
}

/** Giới hạn của bảng "SurveyQuestions": mỗi bộ câu hỏi tối đa 30 câu. */
export const maximumQuestionsPerTemplate = 30;

/** Số mức tối đa của một thang trả lời ("AnswerScaleOptions"."Value" CHECK 1..5). */
export const maximumAnswerScaleOptions = 5;

/** Bảng "AnswerScaleOptions" */
export interface AnswerScaleOption {
  answerScaleOptionId: number;
  answerScaleId: number;
  /** 1..5 */
  value: number;
  displayText: string;
}

/** Bảng "AnswerScales", kèm các mức trả lời để hiển thị trong một lần gọi. */
export interface AnswerScale {
  answerScaleId: number;
  answerScaleName: string;
  options: AnswerScaleOption[];
}

/** Bảng "SurveyQuestions" */
export interface SurveyQuestion {
  questionId: number;
  surveyTemplateId: number;
  questionText: string;
}

/** Bảng "SurveyTemplates", kèm danh sách câu hỏi của bộ. */
export interface SurveyTemplate {
  surveyTemplateId: number;
  templateName: string;
  /** NOT NULL: cả bộ dùng chung một thang trả lời. */
  answerScaleId: number;
  /** ISO 8601 */
  createdAt: string;
  questions: SurveyQuestion[];
}

/** Bảng "SemesterSurveys", kèm số lớp và số phiếu đã thu của đợt. */
export interface SemesterSurvey {
  semesterSurveyId: number;
  semesterId: number;
  semesterName: string;
  academicYearName: string;
  surveyTemplateId: number;
  templateName: string;
  questionCount: number;
  /** ISO 8601 */
  createdAt: string;
  /** Sớm nhất / muộn nhất trong các lớp của đợt. */
  startTime: string;
  endTime: string;
  sectionSurveyCount: number;
  responseCount: number;
}

/** Bảng "CourseSectionSurveys": bài khảo sát riêng của một lớp học phần. */
export interface CourseSectionSurvey {
  courseSectionSurveyId: number;
  semesterSurveyId: number;
  courseSectionId: number;
  /** Dùng để dựng link và mã QR riêng cho lớp. */
  linkToken: string;
  startTime: string;
  endTime: string;
  courseCode: string;
  courseName: string;
  sectionName: string;
  lecturerName: string;
  classSize: number;
  responseCount: number;
}

/** Số câu đã chọn ở một mức trả lời trong cùng một phiếu. */
export interface SurveyResponseValueCount {
  value: number;
  displayText: string;
  count: number;
}

/** Một dòng trong danh sách phiếu trả lời của bài khảo sát một lớp học phần. */
export interface SurveyResponseSummary {
  responseId: number;
  courseSectionSurveyId: number;
  /** ISO 8601 */
  submittedAt: string;
  score: number;
  additionalComments: string | null;
  answerCount: number;
  valueCounts: SurveyResponseValueCount[];
}

export interface SurveyResponseAnswer {
  questionId: number;
  questionText: string;
  selectedValue: number;
  selectedText: string;
}

/** Toàn bộ nội dung một phiếu trả lời, dùng cho modal chỉ xem. */
export interface SurveyResponseDetail {
  responseId: number;
  courseSectionSurveyId: number;
  submittedAt: string;
  score: number;
  additionalComments: string | null;
  templateName: string;
  courseCode: string;
  courseName: string;
  sectionName: string;
  lecturerName: string;
  answerOptions: AnswerScaleOption[];
  answers: SurveyResponseAnswer[];
}

/** Phiếu khảo sát sinh viên thấy khi mở link hoặc quét QR. */
export interface PublicSurvey {
  linkToken: string;
  templateName: string;
  courseCode: string;
  courseName: string;
  sectionName: string;
  lecturerName: string;
  semesterName: string;
  academicYearName: string;
  startTime: string;
  endTime: string;
  isOpen: boolean;
  answerOptions: AnswerScaleOption[];
  questions: { questionId: number; questionText: string }[];
}

export interface SurveyCampaign {
  id: string;
  title: string;
  type: 'Học phần' | 'Chương trình đào tạo';
  semester: string;
  academicYear: string;
  majorId?: string;
  majorName?: string;
  courseId?: string;
  courseCode?: string;
  courseName?: string;
  classId?: string;
  classCode?: string;
  groupId?: string;
  groupCode?: string; // N01, N02...
  lecturerName?: string;
  startDate: string; // YYYY-MM-DD (Thời gian mở quét QR)
  endDate: string;   // YYYY-MM-DD (Thời gian đóng quét QR)
  status: 'Đang diễn ra' | 'Sắp diễn ra' | 'Đã kết thúc';
  targetAudience: string;
  surveyLink?: string;
  qrCodeUrl?: string;
  totalTargetResponses: number;
  actualResponses: number;
}

export interface SurveyResponse {
  id: string;
  campaignId: string;
  classId?: string;
  studentIdHash: string;
  submittedAt: string;
  ratings: Record<string, number>; // criterionId -> rating (1-5)
  feedbackComments?: string;
}

export interface SystemStats {
  totalFaculties: number;
  totalMajors: number;
  totalCourses: number;
  totalClasses: number;
  activeCampaigns: number;
  totalResponses: number;
  /** Tổng sĩ số các lớp đã được phát phiếu, dùng để tính tỷ lệ hoàn thành. */
  totalTargetResponses: number;
  overallSatisfaction: number; // e.g. 4.65 / 5.0
  qrScanCount: number;
}

export interface AuthProfile {
  id: string;
  name: string;
  code: string;
  roleCode: string;
  organizationUnitCode: string | null;
  organizationUnitName: string | null;
  isDefault: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface AuthMeResponse {
  authenticated: boolean;
  user: AuthUser | null;
  activeProfile: AuthProfile | null;
  availableProfiles: AuthProfile[];
}

export interface AuthAccess {
  profileId: string;
  roleCode: string;
  organizationUnitCode: string | null;
  permissions: string[];
}

export interface AuthConfiguration {
  googleConfigured: boolean;
  allowAnyGoogleAccount: boolean;
  development: boolean;
}

export interface AdminProfile {
  id: string;
  name: string;
  code: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  organizationUnitCode: string | null;
  organizationUnitName: string | null;
  isActive: boolean;
  isDefault: boolean;
  lastSelectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  isActive: boolean;
  firstLoginAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  profiles: AdminProfile[];
}

export interface ImportAdminUserRow {
  rowNumber: number;
  email: string;
  displayName: string;
}

export interface AdminUserImportItem {
  rowNumber: number;
  email: string;
  succeeded: boolean;
  errorCode: string | null;
}

export interface AdminUserImportResult {
  totalCount: number;
  createdCount: number;
  skippedCount: number;
  items: AdminUserImportItem[];
}

export interface AdminRole {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

export interface AdminAuditLog {
  id: string;
  userId: string | null;
  profileId: string | null;
  email: string | null;
  event: string;
  metadata: string | null;
  createdAt: string;
}

export interface AdminPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface SaveAdminProfile {
  name: string;
  code: string;
  roleId: string;
  organizationUnitCode: string | null;
  organizationUnitName: string | null;
  isDefault: boolean;
}

// ---------------------------------------------------------------------------
// BÁO CÁO & THỐNG KÊ (REPORTS & STATISTICS)
// ---------------------------------------------------------------------------

export interface SectionProgressDetail {
  courseSectionSurveyId: number;
  courseCode: string;
  courseName: string;
  sectionName: string;
  lecturerName: string;
  classSize: number;
  responseCount: number;
  completionRate: number;
  status: 'Hoàn thành' | 'Đang thu' | 'Chậm tiến độ';
}

export interface OperationalProgressReport {
  semesterId: number;
  semesterName: string;
  academicYearName: string;
  totalTargetResponses: number;
  totalActualResponses: number;
  overallCompletionRate: number;
  completedSectionCount: number;
  inProgressSectionCount: number;
  laggingSectionCount: number;
  sectionDetails: SectionProgressDetail[];
}

export interface OptionCount {
  value: number;
  displayText: string;
  count: number;
  percentage: number;
}

export interface QuestionRating {
  questionId: number;
  questionText: string;
  averageScore: number;
  totalAnswers: number;
  optionDistribution: OptionCount[];
}

export interface LecturerSectionSummary {
  courseSectionSurveyId: number;
  courseCode: string;
  courseName: string;
  sectionName: string;
  classSize: number;
  responseCount: number;
  averageScore: number;
}

export interface LecturerPerformanceReport {
  lecturerId: number;
  fullName: string;
  departmentName: string;
  facultyName: string;
  averageScore: number;
  totalResponses: number;
  courseSectionCount: number;
  departmentAverageScore: number;
  facultyAverageScore: number;
  sections: LecturerSectionSummary[];
  questionRatings: QuestionRating[];
}

export interface DepartmentSummary {
  departmentId: number;
  departmentName: string;
  lecturerCount: number;
  sectionCount: number;
  responseCount: number;
  averageSatisfactionScore: number;
}

export interface FacultyDepartmentReport {
  facultyId: number;
  facultyName: string;
  totalDepartments: number;
  totalLecturers: number;
  totalSections: number;
  totalResponses: number;
  averageSatisfactionScore: number;
  departments: DepartmentSummary[];
}

export interface SurveyQuestionSummaryReport {
  semesterSurveyId: number;
  surveyTemplateId: number;
  templateName: string;
  totalResponses: number;
  overallAverageScore: number;
  questions: QuestionRating[];
}

/** Phân tích theo từng câu hỏi của một bài khảo sát lớp học phần. */
export interface SectionSurveyAnalysis {
  courseSectionSurveyId: number;
  courseCode: string;
  courseName: string;
  sectionName: string;
  lecturerName: string;
  classSize: number;
  responseCount: number;
  averageScore: number;
  templateName: string;
  questions: QuestionRating[];
}

/** Một dòng kết quả chi tiết của một bài khảo sát lớp học phần. */
export interface SurveyResultDetail {
  courseSectionSurveyId: number;
  semesterSurveyId: number;
  templateName: string;
  lecturerId: number;
  lecturerName: string;
  departmentId: number;
  departmentName: string;
  facultyId: number;
  facultyName: string;
  courseCode: string;
  courseName: string;
  sectionName: string;
  classSize: number;
  responseCount: number;
  completionRate: number;
  averageScore: number;
}

// ---------------------------------------------------------------------------
// BẢNG TỔNG QUAN TOÀN TRƯỜNG (EXECUTIVE SURVEY DASHBOARD)
// ---------------------------------------------------------------------------

/** Một nhóm điểm trong phân bố điểm toàn trường (theo điểm TB từng phiếu). */
export interface ScoreBand {
  band: number;
  label: string;
  count: number;
  percentage: number;
}

/** Dữ liệu 1 Khoa cho biểu đồ tổng quan toàn trường. */
export interface FacultyOverview {
  facultyId: number;
  facultyName: string;
  departmentCount: number;
  sectionCount: number;
  targetResponses: number;
  responseCount: number;
  completionRate: number;
  averageScore: number;
}

/** Dữ liệu 1 Bộ môn cho bảng "chậm tiến độ" của tổng quan toàn trường. */
export interface DepartmentOverview {
  departmentId: number;
  departmentName: string;
  facultyId: number;
  facultyName: string;
  sectionCount: number;
  targetResponses: number;
  responseCount: number;
  completionRate: number;
  averageScore: number;
}

/** So sánh học kỳ hiện tại với học kỳ liền trước (xu hướng). */
export interface SemesterComparison {
  previousSemesterId: number;
  previousSemesterName: string;
  previousAcademicYearName: string;
  previousCompletionRate: number;
  previousAverageScore: number;
  completionRateDelta: number;
  averageScoreDelta: number;
}

/** Bảng tổng quan toàn trường (executive summary) của một học kỳ. */
export interface SchoolSurveyOverview {
  semesterId: number;
  semesterName: string;
  academicYearName: string;
  totalSections: number;
  totalTargetResponses: number;
  totalResponses: number;
  completionRate: number;
  completedSectionCount: number;
  inProgressSectionCount: number;
  laggingSectionCount: number;
  overallAverageScore: number;
  scoreDistribution: ScoreBand[];
  schoolAverageScore: number;
  faculties: FacultyOverview[];
  departments: DepartmentOverview[];
  weakestQuestions: QuestionRating[];
  previousSemester: SemesterComparison | null;
}

// ---------------------------------------------------------------------------
// PHÂN QUYỀN THEO MODULE (PERMISSION MANAGEMENT)
// ---------------------------------------------------------------------------

export interface PermissionDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

export interface RolePermissionStatus {
  permissionId: string;
  permissionCode: string;
  permissionName: string;
  isGranted: boolean;
}

export interface RolePermissionMatrix {
  roleId: string;
  roleCode: string;
  roleName: string;
  permissions: RolePermissionStatus[];
}

export interface RolePermissionGrantDto {
  permissionId: string;
  isGranted: boolean;
}
