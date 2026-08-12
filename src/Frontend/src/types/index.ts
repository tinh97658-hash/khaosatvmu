export interface Faculty {
  id: string;
  code: string;
  name: string;
  dean: string;
  email: string;
  phone: string;
  establishedYear: number;
  departmentsCount?: number;
  totalCourses: number;
  totalStudents: number;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  facultyId: string;
  facultyName: string;
  headOfDepartment: string; // Trưởng bộ môn
  email: string;
  phone: string;
  totalLecturers: number;
  totalCourses: number;
}

export interface Major {
  id: string;
  code: string;
  name: string;
  facultyId: string;
  facultyName: string;
  degreeLevel: 'Đại học' | 'Thạc sĩ' | 'Tiến sĩ' | 'Cao đẳng';
  durationYears: number;
  totalCredits: number;
  status: 'Đang đào tạo' | 'Ngừng tuyển sinh';
}

export interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  theoryHours: number;
  practicalHours: number;
  facultyId: string;
  facultyName: string;
  departmentId?: string;
  departmentName?: string;
  type: 'Bắt buộc' | 'Tự chọn';
  description?: string;
}

export interface Lecturer {
  id: string;
  code: string; // Mã cán bộ/giảng viên, vd: CB01025
  fullName: string;
  academicTitle: string; // TS., PGS.TS., ThS., GS.TS.
  facultyId: string;
  facultyName: string;
  departmentId?: string;
  departmentName?: string;
  email: string;
  phone: string;
  specialization: string;
  status: 'Đang công tác' | 'Nghỉ hưu / Chuyển công tác';
}

export interface ClassGroup {
  id: string;
  classId: string; // Lớp HP cha (vd: cls-1)
  groupCode: string; // N01, N02, N03...
  fullGroupCode: string; // vd: IT201.01.N01
  lecturerId: string;
  lecturerName: string; // Giảng viên phân công lớp N01, N02
  lecturerEmail: string;
  studentCount: number;
  room: string;
  schedule: string; // vd: Thứ 2 (Tiết 1-3)
  surveyStatus: 'Chưa khảo sát' | 'Đang khảo sát' | 'Đã hoàn thành';
  completedResponses: number;
}

export interface CourseClass {
  id: string;
  code: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  lecturerName: string;
  lecturerEmail: string;
  semester: string;
  academicYear: string;
  totalStudents: number;
  room: string;
  surveyStatus: 'Chưa khảo sát' | 'Đang khảo sát' | 'Đã hoàn thành';
  completedResponses: number;
  groups?: ClassGroup[]; // Danh sách nhóm lớp N01, N02...
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
  allowedDomain: string;
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
