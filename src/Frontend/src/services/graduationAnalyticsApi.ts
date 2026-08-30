import type {
  GraduationDataset,
  GraduationFacets,
  GraduationImportResult,
  GraduationImportRow,
  GraduationMetadata,
  GraduationPeriod,
  GraduationQuery,
  GraduationQueryResult,
  GraduationRowsPage,
} from '../types/graduationAnalytics';
import { apiRequest, csrfRequest } from './apiClient';

const basePath = '/api/v1/graduation-analytics';

// Adapter tạm cho màn hình dashboard cũ; được loại bỏ khi chuyển sang cấu trúc ba tab.
const toLegacyDataset = (period: GraduationPeriod): GraduationDataset => ({
  datasetId: period.periodId,
  datasetName: period.label,
  originalFileName: period.originalFileName,
  importedByName: period.importedByName,
  importedAtUtc: period.importedAtUtc,
  rowCount: period.rowCount,
  minimumReviewDate: `${period.reviewYear}-${String(period.reviewMonth).padStart(2, '0')}-01`,
  maximumReviewDate: `${period.reviewYear}-${String(period.reviewMonth).padStart(2, '0')}-01`,
});

export const graduationAnalyticsApi = {
  periods: () => apiRequest<GraduationPeriod[]>(`${basePath}/periods`),
  datasets: () => apiRequest<GraduationPeriod[]>(`${basePath}/periods`)
    .then((periods) => periods.map(toLegacyDataset)),
  metadata: () => apiRequest<GraduationMetadata>(`${basePath}/metadata`),
  facets: (periodId: number) =>
    apiRequest<GraduationFacets>(`${basePath}/periods/${periodId}/facets`),
  importPeriod: (payload: {
    originalFileName: string;
    sourceSheetName: string;
    rows: GraduationImportRow[];
  }) => csrfRequest<GraduationImportResult>(`${basePath}/periods`, 'POST', payload),
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
