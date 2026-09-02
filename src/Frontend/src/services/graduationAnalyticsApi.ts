import type {
  GraduationAnalysisScope,
  GraduationFacets,
  GraduationImportResult,
  GraduationImportRow,
  GraduationMetadata,
  GraduationOverview,
  GraduationOverviewQuery,
  GraduationPeriod,
  GraduationQuery,
  GraduationQueryResult,
  GraduationRowsPage,
} from '../types/graduationAnalytics';
import { apiRequest, csrfRequest } from './apiClient';

const basePath = '/api/v1/graduation-analytics';

export const graduationAnalyticsApi = {
  periods: () => apiRequest<GraduationPeriod[]>(`${basePath}/periods`),
  metadata: () => apiRequest<GraduationMetadata>(`${basePath}/metadata`),
  facets: (scope: GraduationAnalysisScope, periodId?: number | null) => {
    const query = new URLSearchParams({ scope });
    if (scope === 'period' && periodId) query.set('periodId', String(periodId));
    return apiRequest<GraduationFacets>(`${basePath}/facets?${query.toString()}`);
  },
  importPeriod: (payload: {
    originalFileName: string;
    sourceSheetName: string;
    rows: GraduationImportRow[];
  }) => csrfRequest<GraduationImportResult>(`${basePath}/periods`, 'POST', payload),
  overview: (payload: GraduationOverviewQuery) =>
    csrfRequest<GraduationOverview>(`${basePath}/overview`, 'POST', payload),
  query: (payload: GraduationQuery) =>
    csrfRequest<GraduationQueryResult>(`${basePath}/query`, 'POST', payload),
  rows: (
    periodId: number,
    page = 1,
    pageSize = 25,
    search = '',
    filters?: { faculty?: string; program?: string; cohort?: string },
  ) => {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search.trim()) query.set('search', search.trim());
    if (filters?.faculty) query.set('faculty', filters.faculty);
    if (filters?.program) query.set('program', filters.program);
    if (filters?.cohort) query.set('cohort', filters.cohort);
    return apiRequest<GraduationRowsPage>(
      `${basePath}/periods/${periodId}/rows?${query.toString()}`,
    );
  },
};
