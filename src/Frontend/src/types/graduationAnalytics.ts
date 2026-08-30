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
  id: 'faculty' | 'program' | 'cohort';
  label: string;
  type: 'category';
}

export interface GraduationMetric {
  id: string;
  label: string;
  unit: 'count' | 'percent';
  aggregation: 'sum' | 'ratio-of-sums';
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

export type GraduationAnalysisScope = 'cumulative' | 'period';

export interface GraduationQuery {
  scope: GraduationAnalysisScope;
  periodId?: number | null;
  metricId: string;
  groupBy: GraduationDimension['id'];
  seriesBy?: GraduationDimension['id'] | null;
  faculty?: string | null;
  program?: string | null;
  cohort?: string | null;
}

export interface GraduationAnalyticsPoint {
  group: string;
  series: string | null;
  metricId: string;
  value: number | null;
  aggregation: 'sum' | 'ratio-of-sums';
  includedRows: number;
  totalRows: number;
}

export interface GraduationQueryResult {
  metricId: string;
  unit: 'count' | 'percent';
  groupBy: GraduationDimension['id'];
  seriesBy: GraduationDimension['id'] | null;
  points: GraduationAnalyticsPoint[];
}

export interface GraduationOverviewQuery {
  faculty?: string | null;
  program?: string | null;
  cohort?: string | null;
  fromYear?: number | null;
  toYear?: number | null;
}

export interface GraduationOutcomeSummary {
  metricId: string;
  label: string;
  count: number;
  rate: number | null;
  includedRows: number;
  totalRows: number;
}

export interface GraduationOutcomeGroup {
  group: string;
  totalOutcome: number;
  excellentCount: number;
  excellentRate: number | null;
  veryGoodCount: number;
  veryGoodRate: number | null;
  goodCount: number;
  goodRate: number | null;
  averageCount: number;
  averageRate: number | null;
  workStudyTransferCount: number;
  workStudyTransferRate: number | null;
  includedRows: number;
  totalRows: number;
}

export interface GraduationCohortYearPoint {
  reviewYear: number;
  cohort: string;
  totalOutcome: number;
  excellentCount: number;
  veryGoodCount: number;
  goodCount: number;
  averageCount: number;
  workStudyTransferCount: number;
  includedRows: number;
  totalRows: number;
}

export interface GraduationOverview {
  totalOutcome: number;
  periodCount: number;
  cohortCount: number;
  programCount: number;
  facultyCount: number;
  includedRows: number;
  totalRows: number;
  composition: GraduationOutcomeSummary[];
  byCohort: GraduationOutcomeGroup[];
  cohortYear: GraduationCohortYearPoint[];
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
