import type {
  AnswerScale,
  AnswerScaleKind,
  CourseSectionSurvey,
  PublicSurvey,
  SemesterSurvey,
  SurveyResponseDetail,
  SurveyResponseSummary,
  SurveyTemplate,
} from '../types';
import { apiRequest, csrfRequest } from './apiClient';

export interface SaveAnswerScaleOptionPayload {
  /** 1..5, không bắt buộc liên tiếp (thang Có/Không dùng 1 và 5). */
  value: number;
  displayText: string;
}

export interface SaveAnswerScalePayload {
  answerScaleName: string;
  scaleKind: AnswerScaleKind;
  /** Phải rỗng khi `scaleKind` là `Text`. */
  options: SaveAnswerScaleOptionPayload[];
}

export interface SaveSurveyQuestionPayload {
  questionText: string;
  /** Thang trả lời của riêng câu này. */
  answerScaleId: number;
  /**
   * Mức bắt buộc của câu bẫy độ tập trung; null là câu hỏi bình thường.
   * Chỉ đặt được trên thang có mức chọn sẵn và phải là một mức có thật.
   */
  attentionCheckValue: number | null;
}

export interface SaveSurveyTemplatePayload {
  templateName: string;
  /** Ghi đè toàn bộ "SurveyQuestions" của bộ theo đúng thứ tự gửi lên. */
  questions: SaveSurveyQuestionPayload[];
}

/** Một nhóm tương đương (khoa/viện) trong bảng chuẩn hoá điểm. */
export interface NormalizationGroup {
  facultyId: number | null;
  facultyName: string;
  sectionCount: number;
  averageScore: number;
  /** Null khi nhóm có ít hơn hai lớp. */
  standardDeviation: number | null;
  canNormalize: boolean;
}

export interface NormalizedSection {
  courseSectionSurveyId: number;
  courseCode: string;
  courseName: string;
  sectionName: string;
  lecturerName: string;
  facultyName: string;
  classSize: number;
  averageScore: number;
  zSchool: number | null;
  zFaculty: number | null;
  zDifference: number | null;
  /** Mã diễn giải, xem normalizationVerdictLabels. */
  verdict: string;
}

export interface SemesterSurveyNormalization {
  semesterSurveyId: number;
  templateName: string;
  semesterName: string;
  academicYearName: string;
  schoolSectionCount: number;
  schoolAverageScore: number;
  schoolStandardDeviation: number | null;
  groups: NormalizationGroup[];
  sections: NormalizedSection[];
}

/** Nhãn tiếng Việt cho mã diễn giải, để không phơi mã ra màn hình. */
export const normalizationVerdictLabels: Record<string, string> = {
  CONCLUSION_FLIPS: 'Chuẩn hoá làm đổi kết luận rõ rệt',
  ABOVE_FACULTY: 'Trên mặt bằng khoa',
  BELOW_FACULTY: 'Thấp hơn mặt bằng khoa — theo dõi',
  NORMAL: 'Trong vùng bình thường',
  FACULTY_TOO_SMALL: 'Khoa quá ít lớp để chuẩn hoá',
};

/** Một dòng của bảng tổng hợp theo bộ môn. */
export interface DepartmentSummaryRow {
  facultyId: number | null;
  facultyName: string;
  departmentId: number | null;
  departmentName: string;
  sectionCount: number;
  lecturerCount: number;
  responseCount: number;
  averageCompletionRate: number;
  averageScore: number | null;
  warningSectionCount: number;
  weakestQuestionOrder: number | null;
  weakestQuestionScore: number | null;
  weakestQuestionText: string | null;
}

export interface SemesterSurveyDepartmentSummary {
  semesterSurveyId: number;
  templateName: string;
  semesterName: string;
  academicYearName: string;
  rows: DepartmentSummaryRow[];
}

/** Một dòng của bảng chẩn đoán học phần. */
export interface CourseDiagnosisRow {
  courseId: number;
  courseCode: string;
  courseName: string;
  facultyName: string;
  sectionCount: number;
  lecturerCount: number;
  averageScore: number;
  minScore: number;
  maxScore: number;
  /** Cao nhất trừ thấp nhất. Học phần một lớp thì luôn bằng 0. */
  spread: number;
  weakestQuestionOrder: number | null;
  weakestQuestionScore: number | null;
  weakestQuestionText: string | null;
  /** Mã kết luận, xem courseDiagnosisLabels. */
  verdict: string;
}

export interface SemesterSurveyCourseDiagnosis {
  semesterSurveyId: number;
  templateName: string;
  semesterName: string;
  academicYearName: string;
  rows: CourseDiagnosisRow[];
}

export const courseDiagnosisLabels: Record<string, string> = {
  COURSE_ISSUE: 'Mọi lớp đều thấp — xem lại học phần',
  LECTURER_VARIANCE: 'Chênh lệch lớn giữa các lớp — khác biệt ở giảng viên',
  ALL_GOOD: 'Mọi lớp đều tốt — nên nhân rộng',
  INCONCLUSIVE: 'Chưa đủ căn cứ kết luận',
};

/** Một giảng viên có dạy trong đợt, dùng cho ô chọn ở bộ lọc. */
export interface LecturerOption {
  lecturerId: number;
  fullName: string;
  departmentName: string;
  facultyName: string;
  sectionCount: number;
}

export interface LecturerSection {
  courseSectionSurveyId: number;
  courseCode: string;
  courseName: string;
  sectionName: string;
  classSize: number;
  responseCount: number;
  completionRate: number;
  averageScore: number;
  /** Null khi khoa quá ít lớp để chuẩn hoá. */
  zFaculty: number | null;
}

export interface LecturerQuestionComparison {
  questionOrder: number;
  questionText: string;
  lecturerScore: number;
  departmentMedian: number | null;
  facultyMedian: number | null;
  differenceFromDepartment: number | null;
}

export interface LecturerReport {
  lecturerId: number;
  fullName: string;
  departmentName: string;
  facultyName: string;
  sectionCount: number;
  totalResponseCount: number;
  averageScore: number;
  sections: LecturerSection[];
  comparisons: LecturerQuestionComparison[];
}

/** Điểm trung bình toàn trường của một câu hỏi. */
export interface DashboardQuestionScore {
  questionOrder: number;
  questionText: string;
  averageScore: number;
  /** Số lớp có điểm câu này dưới ngưỡng cảnh báo. */
  sectionsBelowThreshold: number;
}

export interface DashboardFacultyScore {
  facultyId: number | null;
  facultyName: string;
  sectionCount: number;
  averageScore: number;
}

export interface SemesterSurveyDashboard {
  semesterSurveyId: number;
  templateName: string;
  semesterName: string;
  academicYearName: string;
  sectionCount: number;
  totalResponseCount: number;
  averageCompletionRate: number;
  /** Null khi chưa lớp nào thu được phiếu hợp lệ. */
  overallScore: number | null;
  scoredSectionCount: number;
  questions: DashboardQuestionScore[];
  /** Năm câu điểm thấp nhất, sắp từ thấp lên. */
  weakestQuestions: DashboardQuestionScore[];
  faculties: DashboardFacultyScore[];
  courseIssueCount: number;
  lecturerVarianceCount: number;
}

export interface RecalculateScoresResult {
  semesterSurveyId: number;
  updatedSectionCount: number;
  /** ISO 8601 */
  calculatedAt: string;
}

/** Một cột C của bảng thống kê, sinh theo bộ câu hỏi của đợt. */
export interface StatisticsQuestionColumn {
  questionId: number;
  order: number;
  questionText: string;
}

export interface SectionQuestionScore {
  questionId: number;
  averageScore: number;
  answerCount: number;
}

/** Một dòng của bảng dữ liệu khảo sát: toàn bộ số liệu của một lớp học phần. */
export interface SectionStatisticsRow {
  courseSectionId: number;
  courseSectionSurveyId: number;
  courseCode: string;
  courseName: string;
  sectionName: string;
  departmentName: string;
  lecturerName: string;
  classSize: number;
  /** Tổng lượt nộp, tính cả phiếu bị lọc. */
  totalResponseCount: number;
  validResponseCount: number;
  invalidResponseCount: number;
  completionRate: number;
  /** Ảnh chụp lần bấm tính gần nhất; null là chưa tính lần nào. */
  averageScore: number | null;
  /** ISO 8601 */
  scoreCalculatedAt: string | null;
  openCommentCount: number;
  weakestQuestionId: number | null;
  weakestQuestionScore: number | null;
  questionScores: SectionQuestionScore[];
}

export interface SemesterSurveyStatistics {
  semesterSurveyId: number;
  templateName: string;
  semesterName: string;
  academicYearName: string;
  /** ISO 8601, null là chưa lớp nào được tính. */
  lastCalculatedAt: string | null;
  /** Số phiếu về sau lần tính gần nhất. Khác 0 nghĩa là số đang xem đã cũ. */
  responsesSinceLastCalculation: number;
  questionColumns: StatisticsQuestionColumn[];
  /** Vị trí các câu bẫy trong bộ; bảng không có cột cho chúng nên phải chú thích. */
  attentionCheckOrders: number[];
  rows: SectionStatisticsRow[];
}

export const surveyApi = {
  answerScales: () => apiRequest<AnswerScale[]>('/api/surveys/answer-scales'),
  createAnswerScale: (scale: SaveAnswerScalePayload) =>
    csrfRequest<AnswerScale>('/api/surveys/answer-scales', 'POST', scale),
  updateAnswerScale: (answerScaleId: number, scale: SaveAnswerScalePayload) =>
    csrfRequest<AnswerScale>(`/api/surveys/answer-scales/${answerScaleId}`, 'PUT', scale),
  deleteAnswerScale: (answerScaleId: number) =>
    csrfRequest<boolean>(`/api/surveys/answer-scales/${answerScaleId}`, 'DELETE'),

  templates: () => apiRequest<SurveyTemplate[]>('/api/surveys/templates'),
  createTemplate: (template: SaveSurveyTemplatePayload) =>
    csrfRequest<SurveyTemplate>('/api/surveys/templates', 'POST', template),
  updateTemplate: (surveyTemplateId: number, template: SaveSurveyTemplatePayload) =>
    csrfRequest<SurveyTemplate>(`/api/surveys/templates/${surveyTemplateId}`, 'PUT', template),
  deleteTemplate: (surveyTemplateId: number) =>
    csrfRequest<boolean>(`/api/surveys/templates/${surveyTemplateId}`, 'DELETE'),

  /** Bảng dữ liệu khảo sát của một đợt: mỗi dòng là một lớp học phần. */
  semesterSurveyStatistics: (semesterSurveyId: number) =>
    apiRequest<SemesterSurveyStatistics>(
      `/api/surveys/semester-surveys/${semesterSurveyId}/statistics`,
    ),
  /** Chuẩn hoá điểm bằng Z-score, so toàn đợt và so trong khoa/viện. */
  semesterSurveyNormalization: (semesterSurveyId: number) =>
    apiRequest<SemesterSurveyNormalization>(
      `/api/surveys/semester-surveys/${semesterSurveyId}/normalization`,
    ),
  /** Tổng hợp theo bộ môn, phục vụ trưởng khoa. */
  semesterSurveyDepartmentSummary: (semesterSurveyId: number) =>
    apiRequest<SemesterSurveyDepartmentSummary>(
      `/api/surveys/semester-surveys/${semesterSurveyId}/department-summary`,
    ),
  /** Tổng quan toàn trường của một đợt khảo sát. */
  semesterSurveyDashboard: (semesterSurveyId: number) =>
    apiRequest<SemesterSurveyDashboard>(
      `/api/surveys/semester-surveys/${semesterSurveyId}/dashboard`,
    ),
  /** So các lớp trong cùng một học phần để tách lỗi học phần khỏi lỗi giảng viên. */
  semesterSurveyCourseDiagnosis: (semesterSurveyId: number) =>
    apiRequest<SemesterSurveyCourseDiagnosis>(
      `/api/surveys/semester-surveys/${semesterSurveyId}/course-diagnosis`,
    ),
  /** Danh sách giảng viên có lớp trong đợt, dùng cho ô chọn. */
  semesterSurveyLecturers: (semesterSurveyId: number) =>
    apiRequest<LecturerOption[]>(`/api/surveys/semester-surveys/${semesterSurveyId}/lecturers`),
  /** Báo cáo cá nhân của đúng một giảng viên trong đợt. */
  lecturerReport: (semesterSurveyId: number, lecturerId: number) =>
    apiRequest<LecturerReport>(
      `/api/surveys/semester-surveys/${semesterSurveyId}/lecturers/${lecturerId}`,
    ),
  /** Tính lại điểm trung bình cho mọi lớp của đợt. Chỉ chạy khi bấm nút. */
  recalculateScores: (semesterSurveyId: number) =>
    csrfRequest<RecalculateScoresResult>(
      `/api/surveys/semester-surveys/${semesterSurveyId}/recalculate-scores`,
      'POST',
    ),

  /** Bỏ trống semesterId để lấy toàn bộ đợt khảo sát. */
  semesterSurveys: (semesterId?: number) =>
    apiRequest<SemesterSurvey[]>(
      semesterId === undefined
        ? '/api/surveys/semester-surveys'
        : `/api/surveys/semester-surveys?semesterId=${semesterId}`,
    ),
  createSemesterSurvey: (survey: CreateSemesterSurveyPayload) =>
    csrfRequest<SemesterSurvey>('/api/surveys/semester-surveys', 'POST', survey),
  deleteSemesterSurvey: (semesterSurveyId: number) =>
    csrfRequest<boolean>(`/api/surveys/semester-surveys/${semesterSurveyId}`, 'DELETE'),

  courseSectionSurveys: (semesterSurveyId: number) =>
    apiRequest<CourseSectionSurvey[]>(
      `/api/surveys/semester-surveys/${semesterSurveyId}/sections`,
    ),
  courseSectionSurvey: (courseSectionSurveyId: number) =>
    apiRequest<CourseSectionSurvey>(
      `/api/surveys/course-section-surveys/${courseSectionSurveyId}`,
    ),
  surveyResponses: (courseSectionSurveyId: number) =>
    apiRequest<SurveyResponseSummary[]>(
      `/api/surveys/course-section-surveys/${courseSectionSurveyId}/responses`,
    ),
  surveyResponse: (responseId: number) =>
    apiRequest<SurveyResponseDetail>(`/api/surveys/responses/${responseId}`),

  updateSectionSurveySchedule: (
    courseSectionSurveyId: number,
    schedule: { startTime: string; endTime: string },
  ) =>
    csrfRequest<CourseSectionSurvey>(
      `/api/surveys/course-section-surveys/${courseSectionSurveyId}/schedule`,
      'PUT',
      schedule,
    ),
};

/** Phiếu của sinh viên: mở bằng link hoặc QR nên không cần đăng nhập. */
export const publicSurveyApi = {
  survey: (linkToken: string) =>
    apiRequest<PublicSurvey>(`/api/public/surveys/${encodeURIComponent(linkToken)}`),
  /**
   * Bấm "Bắt đầu làm bài". Server phát vé đã ký tại đúng thời điểm này để lát
   * nữa biết bài làm mất bao lâu. Gọi lại bao nhiêu lần cũng được, mỗi lần nhận
   * một vé mới với mốc thời gian mới.
   */
  start: (linkToken: string) =>
    apiRequest<{ startTicket: string }>(
      `/api/public/surveys/${encodeURIComponent(linkToken)}/start`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
    ),
  submit: (linkToken: string, body: SubmitSurveyResponsePayload) =>
    apiRequest<{ responseId: number; score: number; submittedAt: string }>(
      `/api/public/surveys/${encodeURIComponent(linkToken)}/responses`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    ),
};

export interface CreateSemesterSurveyPayload {
  semesterId: number;
  surveyTemplateId: number;
  /** ISO 8601 (UTC) */
  startTime: string;
  endTime: string;
}

export interface SubmitSurveyResponsePayload {
  /** `answerValue`: số mức đã chọn dạng chuỗi, hoặc nội dung tự nhập. */
  answers: { questionId: number; answerValue: string }[];
  additionalComments: string | null;
  /**
   * Vé nhận được lúc bấm "Bắt đầu làm bài". Thiếu vé thì server vẫn nhận phiếu
   * nhưng coi như làm bài 0 giây.
   */
  startTicket: string | null;
}

/** Link sinh viên dùng để vào làm bài của một lớp học phần. */
export function surveyLinkOf(linkToken: string): string {
  return `${window.location.origin}/survey/${linkToken}`;
}


/** Thông báo tiếng Việt cho mã lỗi của API bộ câu hỏi khảo sát. */
export const surveyErrorMessages: Record<string, string> = {
  SURVEY_INVALID_REQUEST: 'Dữ liệu gửi lên không hợp lệ.',
  SURVEY_ANSWER_SCALE_NOT_FOUND: 'Không tìm thấy thang trả lời.',
  SURVEY_ANSWER_SCALE_NAME_REQUIRED: 'Thiếu tên thang trả lời.',
  SURVEY_ANSWER_SCALE_NAME_EXISTS: 'Tên thang trả lời đã tồn tại.',
  SURVEY_ANSWER_SCALE_OPTIONS_INVALID: 'Thang trả lời cần từ 2 đến 5 mức, mỗi mức một giá trị 1-5.',
  SURVEY_ANSWER_SCALE_OPTION_TEXT_REQUIRED: 'Thiếu nhãn hiển thị của một mức trả lời.',
  SURVEY_ANSWER_SCALE_IN_USE: 'Thang trả lời đang được câu hỏi sử dụng.',
  SURVEY_ANSWER_SCALE_KIND_INVALID: 'Loại thang trả lời không hợp lệ.',
  SURVEY_ANSWER_SCALE_TEXT_HAS_OPTIONS: 'Thang tự nhập không được có mức trả lời nào.',
  SURVEY_ANSWER_SCALE_KIND_LOCKED:
    'Không đổi được loại thang vì đã có câu hỏi dùng thang này.',
  SURVEY_QUESTION_SCALE_NOT_FOUND: 'Một câu hỏi đang trỏ tới mã thang trả lời không tồn tại.',
  SURVEY_TEMPLATE_NOT_FOUND: 'Không tìm thấy bộ câu hỏi.',
  SURVEY_TEMPLATE_NAME_REQUIRED: 'Thiếu tên bộ câu hỏi.',
  SURVEY_TEMPLATE_NAME_EXISTS: 'Tên bộ câu hỏi đã tồn tại.',
  SURVEY_TEMPLATE_QUESTIONS_REQUIRED: 'Bộ câu hỏi cần ít nhất một câu hỏi.',
  SURVEY_TEMPLATE_TOO_MANY_QUESTIONS: 'Mỗi bộ câu hỏi chỉ được tối đa 30 câu.',
  SURVEY_TEMPLATE_IN_USE:
    'Bộ câu hỏi đang được đợt khảo sát sử dụng, hoặc có câu đã thu phiếu nên không đổi được thang trả lời.',
  SURVEY_SEMESTER_NOT_FOUND: 'Không tìm thấy học kỳ.',
  SURVEY_SEMESTER_HAS_NO_SECTIONS: 'Học kỳ này chưa có lớp học phần nào để tạo bài khảo sát.',
  SURVEY_SCHEDULE_INVALID: 'Thời gian đóng phải sau thời gian mở.',
  SURVEY_SEMESTER_SURVEY_NOT_FOUND: 'Không tìm thấy đợt khảo sát.',
  SURVEY_SEMESTER_SURVEY_HAS_RESPONSES: 'Đợt khảo sát đã có phiếu trả lời nên không xóa được.',
  SURVEY_SECTION_SURVEY_NOT_FOUND: 'Không tìm thấy bài khảo sát của lớp học phần.',
  SURVEY_RESPONSE_NOT_FOUND: 'Không tìm thấy phiếu trả lời.',
  SURVEY_LINK_NOT_FOUND: 'Đường dẫn khảo sát không tồn tại.',
  SURVEY_LINK_NOT_OPEN: 'Bài khảo sát chưa mở hoặc đã hết hạn.',
  SURVEY_ANSWERS_INCOMPLETE: 'Vui lòng trả lời đầy đủ tất cả câu hỏi.',
  SURVEY_ANSWER_VALUE_INVALID: 'Mức đánh giá không hợp lệ.',
  SURVEY_ANSWER_TEXT_TOO_LONG: 'Câu trả lời tự nhập không được vượt quá 2000 ký tự.',
  SURVEY_COMMENTS_TOO_LONG: 'Ý kiến khác không được vượt quá 1000 ký tự.',
  AUTH_CSRF_INVALID: 'Phiên bảo mật đã thay đổi. Vui lòng tải lại trang.',
};

export function surveyErrorMessage(errorCode: string | null | undefined): string {
  return surveyErrorMessages[errorCode ?? ''] ?? 'Không thể kết nối tới máy chủ.';
}
