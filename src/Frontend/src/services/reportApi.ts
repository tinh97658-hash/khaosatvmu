import type {
  FacultyDepartmentReport,
  LecturerPerformanceReport,
  OperationalProgressReport,
  SurveyQuestionSummaryReport,
} from '../types';
import { apiRequest } from './apiClient';

export const reportApi = {
  operationalProgress: (semesterId: number) =>
    apiRequest<OperationalProgressReport>(
      `/api/v1/reports/operational-progress?semesterId=${semesterId}`,
    ),

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
};
