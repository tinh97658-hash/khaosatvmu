export type ReportWorkspace = 'overview' | 'details' | 'rankings';
export type ReportAnalysisView = 'faculties' | 'quality' | 'progress';
export type ReportScreen = ReportWorkspace | 'lecturer' | 'survey';
export type ReportResultSortKey =
  | 'classSize'
  | 'responseCount'
  | 'completionRate'
  | 'averageScore';

export interface ReportRouteState {
  screen: ReportScreen;
  semesterId?: number;
  facultyId?: number;
  departmentId?: number;
  lecturerFilterId?: number;
  semesterSurveyId?: number;
  search?: string;
  lecturerId?: number;
  surveyId?: number;
  parentLecturerId?: number;
  analysisView?: ReportAnalysisView;
  comparisonSemesterId?: number;
  resultSortKey?: ReportResultSortKey;
  resultSortDirection?: 'asc' | 'desc';
}

const positiveInt = (value: string | null | undefined): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export const getHashRoot = (hash = window.location.hash): string =>
  hash.replace(/^#\/?/, '').split(/[/?]/, 1)[0]?.trim() || 'overview';

export const parseReportRoute = (hash = window.location.hash): ReportRouteState => {
  const normalized = hash.replace(/^#\/?/, '');
  const [pathPart, queryPart = ''] = normalized.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const query = new URLSearchParams(queryPart);
  const routeSegment = segments[0] === 'reports' ? segments[1] : undefined;

  let screen: ReportScreen = 'overview';
  let lecturerId: number | undefined;
  let surveyId: number | undefined;

  if (routeSegment === 'details' || routeSegment === 'rankings' || routeSegment === 'overview') {
    screen = routeSegment;
  } else if (routeSegment === 'lecturers') {
    lecturerId = positiveInt(segments[2]);
    screen = lecturerId ? 'lecturer' : 'details';
  } else if (routeSegment === 'surveys') {
    surveyId = positiveInt(segments[2]);
    screen = surveyId ? 'survey' : 'details';
  }

  const analysis = query.get('analysis');
  const analysisView: ReportAnalysisView | undefined =
    analysis === 'quality' || analysis === 'progress' || analysis === 'faculties'
      ? analysis
      : undefined;
  const sort = query.get('sort');
  const resultSortKey: ReportResultSortKey | undefined =
    sort === 'classSize'
    || sort === 'responseCount'
    || sort === 'completionRate'
    || sort === 'averageScore'
      ? sort
      : undefined;

  return {
    screen,
    semesterId: positiveInt(query.get('semester')),
    facultyId: positiveInt(query.get('faculty')),
    departmentId: positiveInt(query.get('department')),
    lecturerFilterId: positiveInt(query.get('lecturerFilter')),
    semesterSurveyId: positiveInt(query.get('campaign')),
    search: query.get('q')?.trim() || undefined,
    lecturerId,
    surveyId,
    parentLecturerId: positiveInt(query.get('fromLecturer')),
    analysisView,
    comparisonSemesterId: positiveInt(query.get('compare')),
    resultSortKey,
    resultSortDirection: resultSortKey && query.get('direction') === 'desc' ? 'desc' : 'asc',
  };
};

export const buildReportHash = (route: ReportRouteState): string => {
  let path = `/reports/${route.screen}`;
  if (route.screen === 'lecturer' && route.lecturerId) {
    path = `/reports/lecturers/${route.lecturerId}`;
  } else if (route.screen === 'survey' && route.surveyId) {
    path = `/reports/surveys/${route.surveyId}`;
  }

  const query = new URLSearchParams();
  if (route.semesterId) query.set('semester', String(route.semesterId));
  if (route.facultyId) query.set('faculty', String(route.facultyId));
  if (route.departmentId) query.set('department', String(route.departmentId));
  if (route.lecturerFilterId) query.set('lecturerFilter', String(route.lecturerFilterId));
  if (route.semesterSurveyId) query.set('campaign', String(route.semesterSurveyId));
  if (route.search) query.set('q', route.search);
  if (route.parentLecturerId) query.set('fromLecturer', String(route.parentLecturerId));
  if (route.analysisView && route.analysisView !== 'faculties') query.set('analysis', route.analysisView);
  if (route.comparisonSemesterId) query.set('compare', String(route.comparisonSemesterId));
  if (route.resultSortKey) {
    query.set('sort', route.resultSortKey);
    if (route.resultSortDirection === 'desc') query.set('direction', 'desc');
  }

  const queryString = query.toString();
  return `#${path}${queryString ? `?${queryString}` : ''}`;
};
