import type {
  AnswerScale,
  CourseSectionSurvey,
  PublicSurvey,
  SemesterSurvey,
  SurveyResponseDetail,
  SurveyResponseSummary,
  SurveyTemplate,
} from '../types';
import { apiRequest, csrfRequest } from './apiClient';

export interface SaveAnswerScaleOptionPayload {
  /** 1..5 */
  value: number;
  displayText: string;
}

export interface SaveAnswerScalePayload {
  answerScaleName: string;
  options: SaveAnswerScaleOptionPayload[];
}

export interface SaveSurveyTemplatePayload {
  templateName: string;
  answerScaleId: number;
  /** Nội dung từng câu hỏi, ghi đè toàn bộ "SurveyQuestions" của bộ. */
  questions: string[];
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
  answers: { questionId: number; selectedValue: number }[];
  additionalComments: string | null;
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
  SURVEY_ANSWER_SCALE_IN_USE: 'Thang trả lời đang được bộ câu hỏi sử dụng.',
  SURVEY_TEMPLATE_NOT_FOUND: 'Không tìm thấy bộ câu hỏi.',
  SURVEY_TEMPLATE_NAME_REQUIRED: 'Thiếu tên bộ câu hỏi.',
  SURVEY_TEMPLATE_NAME_EXISTS: 'Tên bộ câu hỏi đã tồn tại.',
  SURVEY_TEMPLATE_QUESTIONS_REQUIRED: 'Bộ câu hỏi cần ít nhất một câu hỏi.',
  SURVEY_TEMPLATE_TOO_MANY_QUESTIONS: 'Mỗi bộ câu hỏi chỉ được tối đa 30 câu.',
  SURVEY_TEMPLATE_IN_USE: 'Bộ câu hỏi đang được đợt khảo sát sử dụng.',
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
  SURVEY_COMMENTS_TOO_LONG: 'Ý kiến khác không được vượt quá 1000 ký tự.',
  AUTH_CSRF_INVALID: 'Phiên bảo mật đã thay đổi. Vui lòng tải lại trang.',
};

export function surveyErrorMessage(errorCode: string | null | undefined): string {
  return surveyErrorMessages[errorCode ?? ''] ?? 'Không thể kết nối tới máy chủ.';
}
