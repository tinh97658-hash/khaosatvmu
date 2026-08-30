export interface GraduationImportRow {
  sourceRowNumber: number;
  facultyName: string;
  programCode: string | null;
  programName: string;
  cohort: string;
  initialEnrollmentCount: number | null;
  reviewPeriodText: string;
  excellentCount: number | null;
  excellentRate: number | null;
  veryGoodCount: number | null;
  veryGoodRate: number | null;
  goodCount: number | null;
  goodRate: number | null;
  averageCount: number | null;
  averageRate: number | null;
  workStudyTransferCount: number | null;
  workStudyTransferRate: number | null;
}

export interface GraduationDataset {
  datasetId: number;
  datasetName: string;
  originalFileName: string;
  importedByName: string;
  importedAtUtc: string;
  rowCount: number;
  minimumReviewDate: string | null;
  maximumReviewDate: string | null;
}

export interface GraduationPeriod {
  periodId: number;
  label: string;
  reviewMonth: number;
  reviewYear: number;
  originalFileName: string;
  importedByName: string;
  importedAtUtc: string;
  rowCount: number;
}

export interface GraduationImportResult { period: GraduationPeriod }

export interface GraduationProgramOption {
  value: string;
  label: string;
  facultyName: string;
}

export interface GraduationFacets {
  faculties: string[];
  programs: GraduationProgramOption[];
  cohorts: string[];
  reviewYears: number[];
}

export interface GraduationDimension {
  id: string;
  label: string;
  type: 'category' | 'time' | 'dataset';
}

export interface GraduationMetric {
  id: string;
  label: string;
  unit: 'count' | 'percent';
  aggregation: 'sum' | 'weighted-average';
  chartTypes: GraduationChartType[];
}

export type GraduationChartType =
  | 'bar'
  | 'column'
  | 'stacked-bar'
  | 'stacked-column'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut';

export interface GraduationMetadata {
  dimensions: GraduationDimension[];
  metrics: GraduationMetric[];
}

export interface GraduationQuery {
  datasetIds: number[];
  metricId: string;
  groupBy: string;
  seriesBy?: string | null;
  faculty?: string | null;
  program?: string | null;
  cohort?: string | null;
  reviewYear?: number | null;
  reviewMonth?: number | null;
}

export interface GraduationAnalyticsPoint {
  group: string;
  series: string | null;
  metricId: string;
  value: number | null;
  aggregation: 'source' | 'sum' | 'weighted-average';
  includedRows: number;
  totalRows: number;
}

export interface GraduationQueryResult {
  metricId: string;
  unit: 'count' | 'percent';
  groupBy: string;
  seriesBy: string | null;
  points: GraduationAnalyticsPoint[];
}

export interface GraduationRow extends GraduationImportRow {
  rowId: number;
  periodId: number;
  sourceSheetName: string;
  reviewMonth: number | null;
  reviewYear: number | null;
}

export interface GraduationRowsPage {
  items: GraduationRow[];
  page: number;
  pageSize: number;
  totalCount: number;
}
