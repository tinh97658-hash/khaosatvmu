import type {
  FacultyDepartmentReport,
  LecturerPerformanceReport,
  OperationalProgressReport,
  SchoolSurveyOverview,
  SectionSurveyAnalysis,
  SurveyQuestionSummaryReport,
  SurveyResultDetail,
} from '../types';
import { apiRequest } from './apiClient';

export const reportApi = {
  operationalProgress: (semesterId: number) =>
    apiRequest<OperationalProgressReport>(
      `/api/v1/reports/operational-progress?semesterId=${semesterId}`,
    ),

  schoolOverview: (semesterId: number, comparisonSemesterId?: number) => {
    const query = new URLSearchParams({ semesterId: String(semesterId) });
    if (comparisonSemesterId) query.append('comparisonSemesterId', String(comparisonSemesterId));
    return apiRequest<SchoolSurveyOverview>(
      `/api/v1/reports/school-overview?${query.toString()}`,
    );
  },

  lecturers: (params?: { facultyId?: number; departmentId?: number; semesterId?: number }) => {
    const query = new URLSearchParams();
    if (params?.facultyId) query.append('facultyId', String(params.facultyId));
    if (params?.departmentId) query.append('departmentId', String(params.departmentId));
    if (params?.semesterId) query.append('semesterId', String(params.semesterId));
    const queryString = query.toString();
    return apiRequest<LecturerPerformanceReport[]>(
      queryString ? `/api/v1/reports/lecturers?${queryString}` : '/api/v1/reports/lecturers',
    );
  },

  lecturerDetail: (lecturerId: number, semesterId?: number) => {
    const query = semesterId ? `?semesterId=${semesterId}` : '';
    return apiRequest<LecturerPerformanceReport>(
      `/api/v1/reports/lecturers/${lecturerId}${query}`,
    );
  },

  faculties: (semesterId?: number) => {
    const query = semesterId ? `?semesterId=${semesterId}` : '';
    return apiRequest<FacultyDepartmentReport[]>(`/api/v1/reports/faculties${query}`);
  },

  questionAnalysis: (semesterSurveyId: number) =>
    apiRequest<SurveyQuestionSummaryReport>(
      `/api/v1/reports/question-analysis?semesterSurveyId=${semesterSurveyId}`,
    ),

  sectionAnalysis: (courseSectionSurveyId: number) =>
    apiRequest<SectionSurveyAnalysis>(
      `/api/v1/reports/section-analysis?courseSectionSurveyId=${courseSectionSurveyId}`,
    ),

  results: (params?: {
    semesterId?: number;
    facultyId?: number;
    departmentId?: number;
    lecturerId?: number;
    semesterSurveyId?: number;
    search?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.semesterId) query.append('semesterId', String(params.semesterId));
    if (params?.facultyId) query.append('facultyId', String(params.facultyId));
    if (params?.departmentId) query.append('departmentId', String(params.departmentId));
    if (params?.lecturerId) query.append('lecturerId', String(params.lecturerId));
    if (params?.semesterSurveyId) query.append('semesterSurveyId', String(params.semesterSurveyId));
    if (params?.search) query.append('search', params.search);
    const queryString = query.toString();
    return apiRequest<SurveyResultDetail[]>(
      queryString ? `/api/v1/reports/results?${queryString}` : '/api/v1/reports/results',
    );
  },
};
