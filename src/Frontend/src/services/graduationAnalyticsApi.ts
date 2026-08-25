import type {
  GraduationDataset,
  GraduationImportResult,
  GraduationImportRow,
  GraduationMetadata,
  GraduationQuery,
  GraduationQueryResult,
  GraduationRowsPage,
} from '../types/graduationAnalytics';
import { apiRequest, csrfRequest } from './apiClient';

const basePath = '/api/v1/graduation-analytics';

export const graduationAnalyticsApi = {
  datasets: () => apiRequest<GraduationDataset[]>(`${basePath}/datasets`),
  metadata: () => apiRequest<GraduationMetadata>(`${basePath}/metadata`),
  importDataset: (payload: {
    datasetName: string;
    originalFileName: string;
    sourceSheetName: string;
    rows: GraduationImportRow[];
  }) => csrfRequest<GraduationImportResult>(`${basePath}/datasets`, 'POST', payload),
  query: (payload: GraduationQuery) =>
    csrfRequest<GraduationQueryResult>(`${basePath}/query`, 'POST', payload),
  rows: (datasetId: number, page = 1, pageSize = 25, search = '') => {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search.trim()) query.set('search', search.trim());
    return apiRequest<GraduationRowsPage>(
      `${basePath}/datasets/${datasetId}/rows?${query.toString()}`,
    );
  },
};
