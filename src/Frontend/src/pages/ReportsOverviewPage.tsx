import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  ListFilter,
  LoaderCircle,
  Medal,
  Search,
  ShieldAlert,
  Star,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth } from '../auth/authContext';
import { useSemester } from '../context/semesterContext';
import { DataTable, type Column, type DataTableSortDirection } from '../components/DataTable';
import { QuestionAnalysisChart } from '../components/QuestionAnalysisChart';
import { SchoolSurveyOverview } from '../components/reports/SchoolSurveyOverview';
import { SectionSurveyResponsesPage } from './SectionSurveyResponsesPage';
import { catalogApi } from '../services/catalogApi';
import { reportApi } from '../services/reportApi';
import { surveyApi } from '../services/surveyApi';
import {
  buildReportHash,
  parseReportRoute,
  type ReportAnalysisView,
  type ReportRouteState,
  type ReportResultSortKey,
  type ReportWorkspace,
} from './reportRoute';
import type {
  Department,
  Faculty,
  Lecturer,
  LecturerPerformanceReport,
  SemesterSurvey,
  SurveyResultDetail,
} from '../types';
import '../styles/survey-operations.css';
import '../styles/reports.css';

/** Một đơn vị (Khoa hoặc Bộ môn) gộp từ kết quả để xếp hạng. */
interface RankedUnit {
  id: number;
  name: string;
  classSize: number;
  responseCount: number;
  completionRate: number;
  averageScore: number;
  sectionCount: number;
}

const scoreColor = (score: number): string =>
  score >= 4.5 ? '#137b3b' : score >= 4.0 ? '#0788b8' : '#b86216';

const completionColor = (rate: number): string =>
  rate >= 80 ? '#137b3b' : rate >= 40 ? '#0788b8' : '#b86216';

export const ReportsOverviewPage: React.FC = () => {
  const initialRoute = useMemo(() => parseReportRoute(), []);
  const { access } = useAuth();
  const {
    academicYears,
    activeSemesterId,
  } = useSemester();
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | undefined>(
    () => initialRoute.semesterId ?? activeSemesterId ?? undefined
  );
  const previousActiveSemesterId = useRef(activeSemesterId);
  const preserveInitialRouteSemester = useRef(initialRoute.semesterId !== undefined);

  // Khi học kỳ làm việc toàn cục (Header) thay đổi, cập nhật bộ lọc trang theo
  useEffect(() => {
    if (preserveInitialRouteSemester.current) {
      previousActiveSemesterId.current = activeSemesterId;
      if (activeSemesterId !== null && activeSemesterId !== undefined) {
        preserveInitialRouteSemester.current = false;
      }
      return;
    }
    const activeSemesterChanged = previousActiveSemesterId.current !== activeSemesterId;
    previousActiveSemesterId.current = activeSemesterId;
    if (activeSemesterChanged && activeSemesterId !== null && activeSemesterId !== undefined) {
      setSelectedSemesterId(activeSemesterId);
    }
  }, [activeSemesterId]);

  const canViewReports = access?.permissions.includes('REPORTS_ACCESS') === true;
  const canLoadCatalog = canViewReports;

  // Danh sách lựa chọn bộ lọc.
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [semesterSurveys, setSemesterSurveys] = useState<SemesterSurvey[]>([]);

  // Bộ lọc.
  const [facultyId, setFacultyId] = useState<number | undefined>(initialRoute.facultyId);
  const [departmentId, setDepartmentId] = useState<number | undefined>(initialRoute.departmentId);
  const [lecturerId, setLecturerId] = useState<number | undefined>(initialRoute.lecturerFilterId);
  const [semesterSurveyId, setSemesterSurveyId] = useState<number | undefined>(initialRoute.semesterSurveyId);
  const [search, setSearch] = useState(initialRoute.search ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [workspace, setWorkspace] = useState<ReportWorkspace>(
    initialRoute.screen === 'overview' || initialRoute.screen === 'rankings'
      ? initialRoute.screen
      : 'details',
  );
  const [analysisView, setAnalysisView] = useState<ReportAnalysisView>(
    initialRoute.analysisView ?? 'faculties',
  );
  const [comparisonSemesterId, setComparisonSemesterId] = useState<number | undefined>(
    initialRoute.comparisonSemesterId,
  );
  const [resultSortKey, setResultSortKey] = useState<ReportResultSortKey | undefined>(
    initialRoute.resultSortKey,
  );
  const [resultSortDirection, setResultSortDirection] = useState<DataTableSortDirection>(
    initialRoute.resultSortDirection ?? 'asc',
  );

  // Kết quả.
  const [results, setResults] = useState<SurveyResultDetail[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Drill-down: giảng viên → bài khảo sát.
  const [lecturer, setLecturer] = useState<LecturerPerformanceReport | null>(() => {
    const routeLecturerId = initialRoute.lecturerId ?? initialRoute.parentLecturerId;
    return routeLecturerId
      ? ({ lecturerId: routeLecturerId, fullName: 'Chi tiết giảng viên' } as LecturerPerformanceReport)
      : null;
  });
  const [lecturerDetail, setLecturerDetail] = useState<LecturerPerformanceReport | null>(null);
  const [lecDetailLoading, setLecDetailLoading] = useState(false);
  const [surveyId, setSurveyId] = useState<number | null>(initialRoute.surveyId ?? null);
  const [surveyTitle, setSurveyTitle] = useState<string | null>(
    initialRoute.surveyId ? 'Chi tiết bài khảo sát' : null,
  );

  const routeFromState = useCallback(
    (screen: ReportRouteState['screen'], overrides: Partial<ReportRouteState> = {}): ReportRouteState => ({
      screen,
      semesterId: selectedSemesterId,
      facultyId,
      departmentId,
      lecturerFilterId: lecturerId,
      semesterSurveyId,
      search: search.trim() || undefined,
      analysisView,
      comparisonSemesterId,
      resultSortKey,
      resultSortDirection,
      ...overrides,
    }),
    [
      analysisView,
      comparisonSemesterId,
      departmentId,
      facultyId,
      lecturerId,
      search,
      resultSortDirection,
      resultSortKey,
      selectedSemesterId,
      semesterSurveyId,
    ],
  );

  const navigateToRoute = useCallback((route: ReportRouteState) => {
    const nextHash = buildReportHash(route);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, []);

  const navigateToWorkspace = useCallback(
    (nextWorkspace: ReportWorkspace) => {
      navigateToRoute(routeFromState(nextWorkspace));
    },
    [navigateToRoute, routeFromState],
  );

  const openSurvey = useCallback(
    (nextSurveyId: number, title?: string, parentLecturerId?: number) => {
      setSurveyTitle(title ?? 'Chi tiết bài khảo sát');
      navigateToRoute(routeFromState('survey', {
        surveyId: nextSurveyId,
        parentLecturerId,
      }));
    },
    [navigateToRoute, routeFromState],
  );

  const backToOverview = useCallback(() => {
    navigateToWorkspace('details');
  }, [navigateToWorkspace]);

  const backToLecturer = useCallback(() => {
    if (lecturer?.lecturerId) {
      navigateToRoute(routeFromState('lecturer', { lecturerId: lecturer.lecturerId }));
    } else {
      navigateToWorkspace('details');
    }
  }, [lecturer?.lecturerId, navigateToRoute, navigateToWorkspace, routeFromState]);

  const changeSemester = useCallback(
    (nextSemesterId: number) => {
      if (surveyId) {
        navigateToRoute({
          screen: 'survey',
          semesterId: nextSemesterId,
          surveyId,
          parentLecturerId: lecturer?.lecturerId,
        });
        return;
      }
      if (lecturer?.lecturerId) {
        navigateToRoute({
          screen: 'lecturer',
          semesterId: nextSemesterId,
          lecturerId: lecturer.lecturerId,
        });
        return;
      }
      navigateToRoute({
        screen: workspace,
        semesterId: nextSemesterId,
        analysisView: workspace === 'overview' ? analysisView : undefined,
      });
    },
    [analysisView, lecturer?.lecturerId, navigateToRoute, surveyId, workspace],
  );

  const changeAnalysisView = useCallback(
    (nextView: ReportAnalysisView) => {
      navigateToRoute(routeFromState('overview', { analysisView: nextView }));
    },
    [navigateToRoute, routeFromState],
  );

  const changeComparisonSemester = useCallback(
    (nextSemesterId?: number) => {
      navigateToRoute(routeFromState('overview', { comparisonSemesterId: nextSemesterId }));
    },
    [navigateToRoute, routeFromState],
  );

  const changeResultSort = useCallback(
    (key?: string, direction?: DataTableSortDirection) => {
      navigateToRoute(routeFromState('details', {
        resultSortKey: key as ReportResultSortKey | undefined,
        resultSortDirection: direction,
      }));
    },
    [navigateToRoute, routeFromState],
  );

  useEffect(() => {
    const applyHashRoute = () => {
      if (!window.location.hash.replace(/^#\/?/, '').startsWith('reports')) return;
      const route = parseReportRoute();
      if (route.semesterId) setSelectedSemesterId(route.semesterId);
      setFacultyId(route.facultyId);
      setDepartmentId(route.departmentId);
      setLecturerId(route.lecturerFilterId);
      setSemesterSurveyId(route.semesterSurveyId);
      setSearch(route.search ?? '');
      setAnalysisView(route.analysisView ?? 'faculties');
      setComparisonSemesterId(route.comparisonSemesterId);
      setResultSortKey(route.resultSortKey);
      setResultSortDirection(route.resultSortDirection ?? 'asc');

      if (route.screen === 'survey' && route.surveyId) {
        setWorkspace('details');
        setSurveyId(route.surveyId);
        setSurveyTitle('Chi tiết bài khảo sát');
        const parentId = route.parentLecturerId;
        setLecturer(parentId
          ? ({ lecturerId: parentId, fullName: 'Chi tiết giảng viên' } as LecturerPerformanceReport)
          : null);
      } else if (route.screen === 'lecturer' && route.lecturerId) {
        setWorkspace('details');
        setSurveyId(null);
        setSurveyTitle(null);
        setLecturer({
          lecturerId: route.lecturerId,
          fullName: 'Chi tiết giảng viên',
        } as LecturerPerformanceReport);
      } else if (
        route.screen === 'overview'
        || route.screen === 'details'
        || route.screen === 'rankings'
      ) {
        setWorkspace(route.screen);
        setSurveyId(null);
        setSurveyTitle(null);
        setLecturer(null);
        setLecturerDetail(null);
      } else {
        setWorkspace('details');
      }
    };

    window.addEventListener('hashchange', applyHashRoute);
    return () => window.removeEventListener('hashchange', applyHashRoute);
  }, []);

  useEffect(() => {
    const screen: ReportRouteState['screen'] = surveyId
      ? 'survey'
      : lecturer
        ? 'lecturer'
        : workspace;
    const canonicalRoute = routeFromState(screen, {
      surveyId: surveyId ?? undefined,
      lecturerId: !surveyId ? lecturer?.lecturerId : undefined,
      parentLecturerId: surveyId ? lecturer?.lecturerId : undefined,
    });
    const canonicalHash = buildReportHash(canonicalRoute);
    if (window.location.hash !== canonicalHash) {
      window.history.replaceState(null, '', canonicalHash);
    }
  }, [lecturer, routeFromState, surveyId, workspace]);

  // Nạp danh mục để dựng bộ lọc.
  useEffect(() => {
    if (!canLoadCatalog) {
      setFaculties([]);
      setDepartments([]);
      setLecturers([]);
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        const [nextFaculties, nextDepartments, nextLecturers] = await Promise.all([
          catalogApi.faculties(),
          catalogApi.departments(),
          catalogApi.lecturers(),
        ]);
        if (cancelled) return;
        setFaculties(nextFaculties);
        setDepartments(nextDepartments);
        setLecturers(nextLecturers);
      } catch {
        if (!cancelled) setLoadError('Không tải được danh mục để lọc báo cáo.');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [canLoadCatalog]);

  // Nạp danh sách đợt khảo sát theo học kỳ (bộ lọc "đợt khảo sát").
  useEffect(() => {
    if (!selectedSemesterId) {
      setSemesterSurveys([]);
      return;
    }
    let cancelled = false;
    surveyApi
      .semesterSurveys(selectedSemesterId)
      .then((surveys) => {
        if (!cancelled) setSemesterSurveys(surveys);
      })
      .catch(() => {
        if (!cancelled) setSemesterSurveys([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSemesterId]);

  // Debounce ô tìm kiếm.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Lấy kết quả theo bộ lọc.
  useEffect(() => {
    if (!selectedSemesterId) return;
    let cancelled = false;
    setResultsLoading(true);
    reportApi
      .results({
        semesterId: selectedSemesterId,
        facultyId,
        departmentId,
        lecturerId,
        semesterSurveyId,
        search: debouncedSearch || undefined,
      })
      .then((data) => {
        if (!cancelled) {
          setResults(data);
          setLoadError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError('Không thể tải kết quả khảo sát.');
      })
      .finally(() => {
        if (!cancelled) setResultsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSemesterId, facultyId, departmentId, lecturerId, semesterSurveyId, debouncedSearch]);

  useEffect(() => {
    if (!lecturer?.lecturerId || !selectedSemesterId) return;
    let cancelled = false;
    setLecturerDetail(null);
    setLecDetailLoading(true);
    reportApi
      .lecturerDetail(lecturer.lecturerId, selectedSemesterId)
      .then((detail) => {
        if (cancelled) return;
        setLecturerDetail(detail);
        setLecturer(detail);
        setLoadError(null);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Không thể tải chi tiết đánh giá giảng viên.');
      })
      .finally(() => {
        if (!cancelled) setLecDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lecturer?.lecturerId, selectedSemesterId]);

  const openLecturer = useCallback(
    (nextLecturerId: number, lecturerName: string) => {
      setLecturer({ lecturerId: nextLecturerId, fullName: lecturerName } as LecturerPerformanceReport);
      navigateToRoute(routeFromState('lecturer', { lecturerId: nextLecturerId }));
    },
    [navigateToRoute, routeFromState],
  );

  const handleResetFilters = useCallback(() => {
    setFacultyId(undefined);
    setDepartmentId(undefined);
    setLecturerId(undefined);
    setSemesterSurveyId(undefined);
    setSearch('');
  }, []);

  // Drill-down từ bảng tổng quan toàn trường → gán bộ lọc và cuộn tới bảng kết quả.
  const handleOverviewDrillDown = useCallback(
    (filter: { facultyId?: number; departmentId?: number }) => {
      navigateToRoute(routeFromState('details', {
        facultyId: filter.facultyId,
        departmentId: filter.departmentId,
        lecturerFilterId: undefined,
      }));
      window.setTimeout(() => {
        document.getElementById('reports-detail-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    },
    [navigateToRoute, routeFromState],
  );

  // Danh sách lựa chọn phụ thuộc.
  const departmentOptions = useMemo(
    () =>
      departments.filter(
        (dept) => !facultyId || dept.facultyId === facultyId,
      ),
    [departments, facultyId],
  );

  const lecturerOptions = useMemo(
    () =>
      lecturers.filter(
        (lec) =>
          (!facultyId || lec.facultyId === facultyId) &&
          (!departmentId || lec.departmentId === departmentId),
      ),
    [lecturers, facultyId, departmentId],
  );

  // KPI gộp từ kết quả đang lọc.
  const kpi = useMemo(() => {
    const totalTarget = results.reduce((sum, item) => sum + item.classSize, 0);
    const totalCollected = results.reduce((sum, item) => sum + item.responseCount, 0);
    const completionRate = totalTarget > 0 ? (totalCollected / totalTarget) * 100 : 0;
    return { totalTarget, totalCollected, completionRate, classCount: results.length };
  }, [results]);

  // Xếp hạng Khoa / Bộ môn từ kết quả.
  const buildRanking = useCallback(
    (key: 'faculty' | 'department'): RankedUnit[] => {
      const groups = new Map<string, RankedUnit>();
      for (const item of results) {
        const id = key === 'faculty' ? item.facultyId : item.departmentId;
        const name = key === 'faculty' ? item.facultyName : item.departmentName;
        if (id === 0 || !name || name === 'Chưa thuộc khoa' || name === 'Chưa thuộc bộ môn') continue;
        const group = groups.get(`${id}`);
        if (!group) {
          groups.set(`${id}`, {
            id,
            name,
            classSize: item.classSize,
            responseCount: item.responseCount,
            completionRate: 0,
            averageScore: 0,
            sectionCount: 1,
          });
        } else {
          group.classSize += item.classSize;
          group.responseCount += item.responseCount;
          group.sectionCount += 1;
        }
      }
      const ranked: RankedUnit[] = [];
      for (const group of groups.values()) {
        const items = results.filter((item) => (key === 'faculty' ? item.facultyId : item.departmentId) === group.id);
        const scoreSum = items.reduce((sum, item) => sum + item.averageScore * item.responseCount, 0);
        const scoreCount = items.reduce((sum, item) => sum + item.responseCount, 0);
        group.averageScore = scoreCount > 0 ? scoreSum / scoreCount : 0;
        group.completionRate = group.classSize > 0 ? (group.responseCount / group.classSize) * 100 : 0;
        ranked.push(group);
      }
      return ranked.sort((a, b) => b.averageScore - a.averageScore).slice(0, 10);
    },
    [results],
  );

  const topFaculties = useMemo(() => buildRanking('faculty'), [buildRanking]);
  const topDepartments = useMemo(() => buildRanking('department'), [buildRanking]);

  const semesterLabel = useMemo(() => {
    for (const year of academicYears) {
      const found = year.semesters.find((s) => s.semesterId === selectedSemesterId);
      if (found) return `${year.academicYearName} · ${found.semesterName}`;
    }
    return 'Học kỳ';
  }, [academicYears, selectedSemesterId]);

  const comparisonSemesterOptions = useMemo(
    () => academicYears.flatMap((year) =>
      year.semesters.map((semester) => ({
        semesterId: semester.semesterId,
        label: `${year.academicYearName} - ${semester.semesterName}`,
      }))),
    [academicYears],
  );

  if (!canViewReports) {
    return (
      <div className="survey-operations-page" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto', background: '#fff', padding: '32px', border: '1px solid #dfe4e8', borderRadius: '4px' }}>
          <ShieldAlert style={{ width: '48px', height: '48px', color: '#b52d2d', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px', color: '#20262c' }}>Không có quyền truy cập</h2>
          <p style={{ color: '#68737d', fontSize: '14px', lineHeight: '1.5' }}>
            Tài khoản của bạn chưa được cấp quyền <code>REPORTS_ACCESS</code> để xem báo cáo thống kê. Vui lòng liên hệ Quản trị viên hệ thống để được phân quyền.
          </p>
        </div>
      </div>
    );
  }

  const isSurveyMode = surveyId !== null;
  const isLecturerMode = !isSurveyMode && lecturer !== null;

  const renderQuestionAnalysis = (questions: LecturerPerformanceReport['questionRatings']) => {
    return (
      <QuestionAnalysisChart
        questions={questions}
        overallAverageScore={lecturerDetail?.averageScore}
        responseCount={lecturerDetail?.totalResponses}
        title="Phân tích kết quả theo câu hỏi"
        showDistributionTable={true}
        emptyMessage="Chưa có phiếu trả lời cho giảng viên này trong học kỳ đã chọn."
      />
    );
  };

  const renderRankedTable = (title: string, icon: React.ReactNode, data: RankedUnit[]) => (
    <section className="reports-rank" aria-label={title}>
      <header className="reports-rank-header">
        <span className="reports-rank-title">
          {icon}
          <h3>{title}</h3>
        </span>
        <span className="reports-rank-note">Theo điểm trung bình</span>
      </header>
      {data.length === 0 ? (
        <div className="reports-rank-empty">Chưa có dữ liệu xếp hạng.</div>
      ) : (
        <table className="campaign-table reports-rank-table">
          <thead>
            <tr>
              <th className="reports-rank-col">Hạng</th>
              <th>Đơn vị</th>
              <th className="reports-rank-num-col">Phiếu</th>
              <th className="reports-rank-completion-col">Hoàn thành</th>
              <th className="reports-rank-num-col">Điểm TB</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={`${title}-${item.id}`}>
                <td className="reports-rank-medal">
                  <span className={index < 3 ? `reports-rank-place is-top${index + 1}` : ''}>{index + 1}</span>
                </td>
                <td className="reports-rank-name">
                  <span className="catalog-cell-primary">{item.name}</span>
                  <span className="catalog-secondary-value">{item.sectionCount} lớp khảo sát</span>
                </td>
                <td className="report-number-cell">{item.responseCount}</td>
                <td className="reports-rank-completion">
                  <div className="reports-progress">
                    <span style={{ width: `${Math.min(100, item.completionRate)}%`, background: completionColor(item.completionRate) }} />
                  </div>
                  <span style={{ color: completionColor(item.completionRate) }}>{item.completionRate.toFixed(0)}%</span>
                </td>
                <td className="reports-rank-score" style={{ color: scoreColor(item.averageScore) }}>
                  <Star style={{ width: '13px', height: '13px', fill: 'currentColor' }} aria-hidden="true" />
                  {item.averageScore.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );

  const resultColumns: Column<SurveyResultDetail>[] = [
    {
      key: 'course',
      header: 'Học phần',
      render: (item) => (
        <>
          <span className="catalog-cell-primary">
            {item.courseCode} - {item.courseName}
          </span>
          <span className="catalog-secondary-value">Lớp {item.sectionName}</span>
        </>
      ),
    },
    {
      key: 'facultyName',
      header: 'Khoa',
      render: (item) => <span className="catalog-cell-primary">{item.facultyName}</span>,
    },
    {
      key: 'departmentName',
      header: 'Bộ môn',
      render: (item) => <span className="catalog-cell-primary">{item.departmentName}</span>,
    },
    {
      key: 'lecturerName',
      header: 'Giảng viên',
      render: (item) => (
        <button
          type="button"
          className="report-lecturer-link"
          onClick={() => void openLecturer(item.lecturerId, item.lecturerName)}
          title={`Xem chi tiết ${item.lecturerName}`}
        >
          {item.lecturerName}
        </button>
      ),
    },
    {
      key: 'templateName',
      header: 'Đợt khảo sát',
      render: (item) => <span className="catalog-cell-primary">{item.templateName}</span>,
    },
    {
      key: 'classSize',
      header: 'Sĩ số',
      sortValue: (item) => item.classSize,
      width: '80px',
      render: (item) => <span className="catalog-cell-number">{item.classSize}</span>,
    },
    {
      key: 'responseCount',
      header: 'Phiếu',
      sortValue: (item) => item.responseCount,
      width: '80px',
      render: (item) => <span className="catalog-cell-number">{item.responseCount}</span>,
    },
    {
      key: 'completionRate',
      header: 'Hoàn thành',
      sortValue: (item) => item.completionRate,
      width: '150px',
      render: (item) => (
        <span className="reports-progress-cell">
          <span className="reports-progress">
            <span style={{ width: `${Math.min(100, item.completionRate)}%`, background: completionColor(item.completionRate) }} />
          </span>
          <span style={{ color: completionColor(item.completionRate), fontWeight: 700, fontSize: 12 }}>
            {item.completionRate.toFixed(0)}%
          </span>
        </span>
      ),
    },
    {
      key: 'averageScore',
      header: 'Điểm TB',
      sortValue: (item) => item.averageScore,
      width: '100px',
      render: (item) => (
        <span className="catalog-score" style={{ color: scoreColor(item.averageScore) }}>
          <Star style={{ width: '13px', height: '13px', fill: 'currentColor' }} aria-hidden="true" />
          {item.averageScore > 0 ? item.averageScore.toFixed(2) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      width: '130px',
      render: (item) => (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            openSurvey(
              item.courseSectionSurveyId,
              `${item.courseCode} - ${item.courseName} (${item.sectionName})`,
            );
          }}
        >
          <ClipboardList className="operation-icon" aria-hidden="true" />
          Xem kết quả
        </button>
      ),
    },
  ];

  const sectionColumns: Column<LecturerPerformanceReport['sections'][number]>[] = [
    {
      key: 'course',
      header: 'Học phần',
      render: (item) => (
        <>
          <span className="catalog-cell-primary">
            {item.courseCode} - {item.courseName}
          </span>
          <span className="catalog-secondary-value">Lớp {item.sectionName}</span>
        </>
      ),
    },
    {
      key: 'classSize',
      header: 'Sĩ số',
      width: '80px',
      render: (item) => <span className="catalog-cell-number">{item.classSize}</span>,
    },
    {
      key: 'responseCount',
      header: 'Phiếu',
      width: '80px',
      render: (item) => <span className="catalog-cell-number">{item.responseCount}</span>,
    },
    {
      key: 'averageScore',
      header: 'Điểm TB (thang 5)',
      width: '130px',
      render: (item) => (
        <span className="catalog-score" style={{ color: scoreColor(item.averageScore) }}>
          <Star style={{ width: '13px', height: '13px', fill: 'currentColor' }} aria-hidden="true" />
          {item.averageScore > 0 ? item.averageScore.toFixed(2) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      width: '140px',
      render: (item) => (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => openSurvey(
            item.courseSectionSurveyId,
            `${item.courseCode} - ${item.courseName} (${item.sectionName})`,
            lecturer?.lecturerId,
          )}
        >
          <ClipboardList className="operation-icon" aria-hidden="true" />
          Xem kết quả
        </button>
      ),
    },
  ];

  return (
    <div className="survey-operations-page reports-module">
      {/* Thanh tiêu đề + chọn học kỳ */}
      <div className="reports-header">
        <div>
          <div className="reports-eyebrow">
            <BarChart3 className="operation-icon" aria-hidden="true" />
            Hệ thống Thống kê & Báo cáo
          </div>
          <h1 className="reports-title">Thống kê kết quả khảo sát học phần</h1>
        </div>
        <div className="operations-field reports-semester-field">
          <label htmlFor="reports-semester">Học kỳ</label>
          <select
            id="reports-semester"
            value={selectedSemesterId ?? ''}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (Number.isNaN(next)) return;
              changeSemester(next);
            }}
          >
            {academicYears.flatMap((year) =>
              year.semesters.map((semester) => (
                <option key={semester.semesterId} value={semester.semesterId}>
                  {year.academicYearName} - {semester.semesterName}
                </option>
              )),
            )}
          </select>
        </div>
      </div>

      {/* Breadcrumb */}
      <nav className="reports-breadcrumb" aria-label="Đường dẫn thống kê">
        <button type="button" className="reports-crumb reports-crumb--link" onClick={backToOverview}>
          Kết quả khảo sát
        </button>
        {lecturer && (
          <>
            <ChevronRight className="operation-icon reports-crumb-sep" aria-hidden="true" />
            <button type="button" className="reports-crumb reports-crumb--link" onClick={backToLecturer}>
              {lecturer.fullName}
            </button>
          </>
        )}
        {surveyTitle && (
          <>
            <ChevronRight className="operation-icon reports-crumb-sep" aria-hidden="true" />
            <span className="reports-crumb reports-crumb--current">{surveyTitle}</span>
          </>
        )}
        {!lecturer && !surveyTitle && (
          <span className="reports-crumb reports-crumb--current">Tổng hợp & lọc kết quả</span>
        )}
        <span className="reports-breadcrumb-semester">{semesterLabel}</span>
      </nav>

      {loadError && (
        <div className="operations-feedback operations-feedback--error" role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      )}

      {/* CẤP CHI TIẾT BÀI KHẢO SÁT */}
      {isSurveyMode && surveyId !== null && (
        <SectionSurveyResponsesPage
          courseSectionSurveyId={surveyId}
          onBack={backToLecturer}
          backLabel={lecturer ? `Quay lại đánh giá ${lecturer.fullName}` : 'Quay lại kết quả khảo sát'}
          showAnalysis
        />
      )}

      {/* CẤP CHI TIẾT GIẢNG VIÊN */}
      {isLecturerMode && lecturer && (
        <div className="reports-drill-grid">
          {lecDetailLoading ? (
            <div className="operations-empty" role="status">
              <LoaderCircle className="operation-icon auth-spin" aria-hidden="true" />
              <strong>Đang tải chi tiết đánh giá giảng viên...</strong>
            </div>
          ) : lecturerDetail ? (
            <>
              <section className="reports-summary-band" aria-label="Tóm tắt đánh giá giảng viên">
                <div className="reports-summary-main">
                  <div className="reports-summary-title">
                    <GraduationCap className="operation-icon" aria-hidden="true" />
                    <h2>{lecturerDetail.fullName}</h2>
                  </div>
                  <p>
                    {lecturerDetail.departmentName} · {lecturerDetail.facultyName}
                  </p>
                </div>
                <div className="reports-summary-metrics">
                  <div>
                    <span>Điểm trung bình</span>
                    <strong style={{ color: scoreColor(lecturerDetail.averageScore) }}>
                      {lecturerDetail.averageScore.toFixed(2)}
                      <small>/ 5.0</small>
                    </strong>
                  </div>
                  <div>
                    <span>Số phiếu đã thu</span>
                    <strong>{lecturerDetail.totalResponses}</strong>
                  </div>
                  <div>
                    <span>Số lớp học phần</span>
                    <strong>{lecturerDetail.courseSectionCount}</strong>
                  </div>
                </div>
              </section>

              {renderQuestionAnalysis(lecturerDetail.questionRatings)}

              <DataTable
                columns={sectionColumns}
                data={lecturerDetail.sections ?? []}
                searchPlaceholder="Tìm học phần hoặc lớp..."
                emptyMessage="Giảng viên này chưa có lớp học phần nào trong học kỳ."
                keyExtractor={(item) => String(item.courseSectionSurveyId)}
                pageSize={10}
              />
            </>
          ) : null}
        </div>
      )}

      {/* CẤP TỔNG HỢP: tổng quan toàn trường + bộ lọc + KPI + xếp hạng + bảng kết quả */}
      {!isLecturerMode && !isSurveyMode && (
        <div className="reports-overview">
          <nav className="reports-workspace-tabs" aria-label="Chế độ xem báo cáo" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={workspace === 'overview'}
              className={`reports-workspace-tab${workspace === 'overview' ? ' is-active' : ''}`}
              onClick={() => navigateToWorkspace('overview')}
            >
              <LayoutDashboard className="operation-icon" aria-hidden="true" />
              <span><strong>Tổng quan</strong><small>Chỉ số và xu hướng toàn trường</small></span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={workspace === 'details'}
              className={`reports-workspace-tab${workspace === 'details' ? ' is-active' : ''}`}
              onClick={() => navigateToWorkspace('details')}
            >
              <ListFilter className="operation-icon" aria-hidden="true" />
              <span><strong>Tra cứu chi tiết</strong><small>Lọc và mở kết quả từng lớp</small></span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={workspace === 'rankings'}
              className={`reports-workspace-tab${workspace === 'rankings' ? ' is-active' : ''}`}
              onClick={() => navigateToWorkspace('rankings')}
            >
              <Medal className="operation-icon" aria-hidden="true" />
              <span><strong>Xếp hạng đơn vị</strong><small>So sánh Khoa và Bộ môn</small></span>
            </button>
          </nav>

          {/* Bảng tổng quan toàn trường (executive dashboard) */}
          {workspace === 'overview' && selectedSemesterId !== undefined && (
            <SchoolSurveyOverview
              key={selectedSemesterId}
              semesterId={selectedSemesterId}
              comparisonOptions={comparisonSemesterOptions}
              analysisView={analysisView}
              comparisonSemesterId={comparisonSemesterId}
              onAnalysisViewChange={changeAnalysisView}
              onComparisonSemesterChange={changeComparisonSemester}
              onDrillDown={handleOverviewDrillDown}
            />
          )}

          {/* Thanh lọc */}
          {workspace === 'details' && (
          <section id="reports-detail-workspace" className="reports-filter-bar reports-workspace-panel" aria-label="Lọc kết quả khảo sát">
            <div className="reports-filter-grid">
              <div className="operations-field">
                <label htmlFor="filter-faculty">Khoa / Viện</label>
                <select
                  id="filter-faculty"
                  value={facultyId ?? ''}
                  onChange={(e) => {
                    const next = e.target.value ? Number(e.target.value) : undefined;
                    setFacultyId(next);
                    setDepartmentId(undefined);
                    setLecturerId(undefined);
                  }}
                >
                  <option value="">Tất cả Khoa / Viện</option>
                  {faculties.map((fac) => (
                    <option key={fac.facultyId} value={fac.facultyId}>
                      {fac.facultyName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="operations-field">
                <label htmlFor="filter-department">Bộ môn</label>
                <select
                  id="filter-department"
                  value={departmentId ?? ''}
                  onChange={(e) => {
                    const next = e.target.value ? Number(e.target.value) : undefined;
                    setDepartmentId(next);
                    setLecturerId(undefined);
                  }}
                >
                  <option value="">Tất cả Bộ môn</option>
                  {departmentOptions.map((dept) => (
                    <option key={dept.departmentId} value={dept.departmentId}>
                      {dept.departmentName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="operations-field">
                <label htmlFor="filter-lecturer">Giảng viên</label>
                <select
                  id="filter-lecturer"
                  value={lecturerId ?? ''}
                  onChange={(e) => setLecturerId(e.target.value ? Number(e.target.value) : undefined)}
                >
                  <option value="">Tất cả Giảng viên</option>
                  {lecturerOptions.map((lec) => (
                    <option key={lec.lecturerId} value={lec.lecturerId}>
                      {lec.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="operations-field">
                <label htmlFor="filter-campaign">Đợt khảo sát</label>
                <select
                  id="filter-campaign"
                  value={semesterSurveyId ?? ''}
                  onChange={(e) => setSemesterSurveyId(e.target.value ? Number(e.target.value) : undefined)}
                >
                  <option value="">Tất cả đợt khảo sát</option>
                  {semesterSurveys.map((survey) => (
                    <option key={survey.semesterSurveyId} value={survey.semesterSurveyId}>
                      {survey.templateName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="operations-field reports-search-field">
                <label htmlFor="filter-search">Tìm học phần, lớp, giảng viên</label>
                <div className="reports-search-box">
                  <Search className="operation-icon" aria-hidden="true" />
                  <input
                    id="filter-search"
                    type="search"
                    placeholder="Mã HP, tên HP, lớp, giảng viên..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="reports-filter-actions">
                <button type="button" className="btn btn-secondary" onClick={handleResetFilters}>
                  Xóa bộ lọc
                </button>
              </div>
            </div>
          </section>
          )}

          {/* KPI */}
          {workspace === 'details' && (
          <div className="reports-kpi-grid" aria-label="Tổng quan kết quả đang lọc">
            <div className="reports-kpi">
              <div className="reports-kpi-icon" style={{ background: '#e8f5fa', color: '#0788b8' }}>
                <Users className="operation-icon" aria-hidden="true" />
              </div>
              <div>
                <span>Chỉ tiêu phiếu</span>
                <strong>{kpi.totalTarget.toLocaleString('vi-VN')}</strong>
                <small>Sinh viên trong danh sách</small>
              </div>
            </div>
            <div className="reports-kpi">
              <div className="reports-kpi-icon" style={{ background: '#e7f4ec', color: '#137b3b' }}>
                <CheckCircle2 className="operation-icon" aria-hidden="true" />
              </div>
              <div>
                <span>Đã thu nộp</span>
                <strong>{kpi.totalCollected.toLocaleString('vi-VN')}</strong>
                <small>Phiếu hoàn thành hợp lệ</small>
              </div>
            </div>
            <div className="reports-kpi">
              <div className="reports-kpi-icon" style={{ background: '#fdf1e3', color: '#b86216' }}>
                <TrendingUp className="operation-icon" aria-hidden="true" />
              </div>
              <div>
                <span>Tỷ lệ hoàn thành</span>
                <strong>{kpi.completionRate.toFixed(1)}%</strong>
                <small>Phiếu thu / chỉ tiêu</small>
              </div>
            </div>
            <div className="reports-kpi">
              <div className="reports-kpi-icon" style={{ background: '#eef1f4', color: '#20262c' }}>
                <Target className="operation-icon" aria-hidden="true" />
              </div>
              <div>
                <span>Số lớp khảo sát</span>
                <strong>{kpi.classCount}</strong>
                <small>Lớp học phần trong bộ lọc</small>
              </div>
            </div>
          </div>
          )}

          {/* Xếp hạng Top Khoa / Bộ môn */}
          {workspace === 'rankings' && (
          <div className="reports-rank-grid reports-workspace-panel" role="tabpanel">
            {renderRankedTable(
              'Top Khoa / Viện theo điểm TB',
              <Building2 className="operation-icon" aria-hidden="true" />,
              topFaculties,
            )}
            {renderRankedTable(
              'Top Bộ môn theo điểm TB',
              <Target className="operation-icon" aria-hidden="true" />,
              topDepartments,
            )}
          </div>
          )}

          {/* Bảng kết quả chi tiết */}
          {workspace === 'details' && (
          <section
            className="reports-table-section"
            id="reports-results"
            aria-label="Bảng kết quả chi tiết"
          >
            <DataTable
              columns={resultColumns}
              data={results}
              emptyMessage={
                resultsLoading
                  ? 'Đang tải kết quả...'
                  : 'Không có lớp học phần nào khớp với bộ lọc hiện tại.'
              }
              keyExtractor={(item) => String(item.courseSectionSurveyId)}
              pageSize={20}
              sortKey={resultSortKey}
              sortDirection={resultSortDirection}
              onSortChange={changeResultSort}
            />
          </section>
          )}
        </div>
      )}
    </div>
  );
};
