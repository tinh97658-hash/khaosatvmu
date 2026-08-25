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
  ShieldAlert,
  Star,
  Target,
  TrendingUp,
  Users,
  X,
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
  /** Khoa chủ quản — với dòng Khoa thì trùng chính id, dùng để bảng Bộ môn bám theo. */
  facultyId: number;
  classSize: number;
  /** Mọi lượt nộp, kể cả phiếu bị bộ lọc nhiễu loại. */
  responseCount: number;
  validResponseCount: number;
  invalidResponseCount: number;
  /** Tính trên phiếu hợp lệ so với sĩ số, giống bảng tra cứu chi tiết. */
  completionRate: number;
  averageScore: number;
  sectionCount: number;
}

const scoreColor = (score: number): string =>
  score >= 4.5 ? '#137b3b' : score >= 4.0 ? '#0788b8' : '#b86216';

const completionColor = (rate: number): string =>
  rate >= 80 ? '#137b3b' : rate >= 20 ? '#0788b8' : '#b86216';

interface RankedUnitTableProps {
  title: string;
  icon: React.ReactNode;
  data: RankedUnit[];
  itemLabel: string;
  onVisibleDataChange?: (rows: RankedUnit[]) => void;
}

const RankedUnitTable: React.FC<RankedUnitTableProps> = ({
  title,
  icon,
  data,
  itemLabel,
  onVisibleDataChange,
}) => {
  // Cùng bộ cột và cùng cách tính với bảng tra cứu chi tiết, chỉ khác là gộp
  // theo đơn vị. Lọc và sắp xếp đều nằm trong menu trên tiêu đề cột.
  const columns: Column<RankedUnit>[] = [
    {
      key: 'name',
      header: 'Đơn vị',
      sortValue: (item) => item.name,
      filterValue: (item) => item.name,
      render: (item) => (
        <>
          <span className="catalog-cell-primary">{item.name}</span>
          <span className="catalog-secondary-value">{item.sectionCount} lớp khảo sát</span>
        </>
      ),
    },
    {
      key: 'classSize',
      header: 'Sĩ số',
      width: '64px',
      numeric: true,
      sortValue: (item) => item.classSize,
      filterValue: (item) => String(item.classSize),
      render: (item) => <span className="catalog-cell-number">{item.classSize}</span>,
    },
    {
      key: 'responseCount',
      header: 'Phiếu thu',
      width: '92px',
      numeric: true,
      sortValue: (item) => item.responseCount,
      filterValue: (item) => String(item.responseCount),
      render: (item) => <span className="catalog-cell-number">{item.responseCount}</span>,
    },
    {
      key: 'invalidResponseCount',
      header: 'Phiếu lỗi',
      width: '84px',
      numeric: true,
      sortValue: (item) => item.invalidResponseCount,
      filterValue: (item) => String(item.invalidResponseCount),
      render: (item) => (
        <span
          className={item.invalidResponseCount > 0
            ? 'catalog-cell-number reports-invalid-count'
            : 'catalog-cell-number'}
        >
          {item.invalidResponseCount}
        </span>
      ),
    },
    {
      key: 'completionRate',
      header: 'Hoàn thành',
      width: '140px',
      numeric: true,
      sortValue: (item) => item.completionRate,
      filterValue: (item) => String(Math.round(item.completionRate)),
      render: (item) => (
        <>
          <span className="reports-progress-cell">
            <span className="reports-progress">
              <span style={{ width: `${Math.min(100, item.completionRate)}%`, background: completionColor(item.completionRate) }} />
            </span>
            <span style={{ color: completionColor(item.completionRate), fontWeight: 700, fontSize: 12 }}>
              {item.completionRate.toFixed(0)}%
            </span>
          </span>
          <span className="catalog-secondary-value reports-progress-sub">
            {item.validResponseCount}/{item.classSize} hợp lệ
          </span>
        </>
      ),
    },
    {
      key: 'averageScore',
      header: 'Điểm TB',
      width: '96px',
      numeric: true,
      sortValue: (item) => item.averageScore,
      filterValue: (item) => item.averageScore.toFixed(2),
      render: (item) => (
        <span className="reports-rank-score" style={{ color: scoreColor(item.averageScore) }}>
          <Star style={{ width: '13px', height: '13px', fill: 'currentColor' }} aria-hidden="true" />
          {item.averageScore > 0 ? item.averageScore.toFixed(2) : '—'}
        </span>
      ),
    },
  ];

  return (
    <section className="reports-rank" aria-label={title}>
      <header className="reports-rank-header">
        <span className="reports-rank-title">
          {icon}
          <h3>{title}</h3>
        </span>
        <span className="reports-rank-note">{data.length} {itemLabel}</span>
      </header>
      <DataTable
        columns={columns}
        data={data}
        keyExtractor={(item) => String(item.id)}
        onVisibleDataChange={onVisibleDataChange}
        showIndex={false}
        pageSize={10}
        emptyMessage="Chưa có dữ liệu tổng hợp."
      />
    </section>
  );
};

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

  // Bài khảo sát là bộ lọc chung của cả trang nên giữ nguyên màn hình đang xem.
  const changeSemesterSurvey = useCallback(
    (nextSemesterSurveyId?: number) => {
      navigateToRoute(routeFromState(workspace, { semesterSurveyId: nextSemesterSurveyId }));
    },
    [navigateToRoute, routeFromState, workspace],
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

  // Trang luôn phân tích đúng một bài khảo sát, nên khi đổi kỳ (hoặc vào từ link
  // trỏ tới bài không còn thuộc kỳ) thì rơi về bài đầu tiên của kỳ.
  useEffect(() => {
    if (semesterSurveys.length === 0) return;
    const isValid = semesterSurveys.some((item) => item.semesterSurveyId === semesterSurveyId);
    if (!isValid) setSemesterSurveyId(semesterSurveys[0].semesterSurveyId);
  }, [semesterSurveys, semesterSurveyId]);

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

  // Bảng lọc ngay trên tiêu đề cột, nhưng drill-down từ tab Tổng quan vẫn khoanh
  // vùng dữ liệu từ phía API. Hiện thành chip gọn để người dùng biết mình đang
  // xem phạm vi nào và bỏ được ngay.
  const scopeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onClear: () => void }> = [];
    const clear = (override: Partial<ReportRouteState>) =>
      navigateToRoute(routeFromState('details', override));

    if (facultyId) {
      const name = faculties.find((item) => item.facultyId === facultyId)?.facultyName;
      chips.push({
        key: 'faculty',
        label: `Khoa: ${name ?? `#${facultyId}`}`,
        onClear: () => clear({ facultyId: undefined }),
      });
    }
    if (departmentId) {
      const name = departments.find((item) => item.departmentId === departmentId)?.departmentName;
      chips.push({
        key: 'department',
        label: `Bộ môn: ${name ?? `#${departmentId}`}`,
        onClear: () => clear({ departmentId: undefined }),
      });
    }
    if (lecturerId) {
      const name = lecturers.find((item) => item.lecturerId === lecturerId)?.fullName;
      chips.push({
        key: 'lecturer',
        label: `Giảng viên: ${name ?? `#${lecturerId}`}`,
        onClear: () => clear({ lecturerFilterId: undefined }),
      });
    }
    return chips;
  }, [
    departmentId,
    departments,
    faculties,
    facultyId,
    lecturerId,
    lecturers,
    navigateToRoute,
    routeFromState,
  ]);

  // KPI gộp từ kết quả đang lọc — cùng cách tính với cột "Hoàn thành": chỉ phiếu hợp lệ.
  const kpi = useMemo(() => {
    const totalTarget = results.reduce((sum, item) => sum + item.classSize, 0);
    const totalCollected = results.reduce((sum, item) => sum + item.validResponseCount, 0);
    const completionRate = totalTarget > 0 ? (totalCollected / totalTarget) * 100 : 0;
    return { totalTarget, totalCollected, completionRate, classCount: results.length };
  }, [results]);

  // Xếp hạng Khoa / Bộ môn từ kết quả.
  const buildRanking = useCallback(
    (key: 'faculty' | 'department'): RankedUnit[] => {
      const groups = new Map<number, RankedUnit>();
      // Điểm TB phải gộp theo tổng điểm chứ không lấy trung bình của trung bình,
      // nên cộng dồn riêng tử số rồi mới chia ở cuối.
      const scoreSums = new Map<number, number>();

      for (const item of results) {
        const id = key === 'faculty' ? item.facultyId : item.departmentId;
        const name = key === 'faculty' ? item.facultyName : item.departmentName;
        if (id === 0 || !name || name === 'Chưa thuộc khoa' || name === 'Chưa thuộc bộ môn') continue;

        const group = groups.get(id);
        if (!group) {
          groups.set(id, {
            id,
            name,
            facultyId: item.facultyId,
            classSize: item.classSize,
            responseCount: item.responseCount,
            validResponseCount: item.validResponseCount,
            invalidResponseCount: item.invalidResponseCount,
            completionRate: 0,
            averageScore: 0,
            sectionCount: 1,
          });
        } else {
          group.classSize += item.classSize;
          group.responseCount += item.responseCount;
          group.validResponseCount += item.validResponseCount;
          group.invalidResponseCount += item.invalidResponseCount;
          group.sectionCount += 1;
        }
        scoreSums.set(id, (scoreSums.get(id) ?? 0) + item.averageScore * item.validResponseCount);
      }

      const ranked: RankedUnit[] = [];
      for (const group of groups.values()) {
        // Cùng cách tính với bảng tra cứu chi tiết: chỉ phiếu hợp lệ.
        group.averageScore = group.validResponseCount > 0
          ? (scoreSums.get(group.id) ?? 0) / group.validResponseCount
          : 0;
        group.completionRate = group.classSize > 0
          ? (group.validResponseCount / group.classSize) * 100
          : 0;
        ranked.push(group);
      }
      return ranked.sort((left, right) => left.name.localeCompare(right.name, 'vi'));
    },
    [results],
  );

  const facultyRankings = useMemo(() => buildRanking('faculty'), [buildRanking]);
  const departmentRankings = useMemo(() => buildRanking('department'), [buildRanking]);

  // Lọc Khoa ở bảng bên trái thì bảng Bộ môn bên phải chỉ còn bộ môn của các Khoa
  // đó. null nghĩa là bảng Khoa chưa lọc gì, giữ nguyên toàn bộ Bộ môn.
  const [visibleFacultyIds, setVisibleFacultyIds] = useState<number[] | null>(null);

  const handleFacultyRowsChange = useCallback(
    (rows: RankedUnit[]) => {
      const next = rows.length === facultyRankings.length ? null : rows.map((row) => row.id);
      setVisibleFacultyIds((previous) => {
        if (previous === null && next === null) return previous;
        if (previous && next && previous.length === next.length
          && previous.every((value, index) => value === next[index])) {
          return previous;
        }
        return next;
      });
    },
    [facultyRankings.length],
  );

  const visibleDepartmentRankings = useMemo(() => {
    if (!visibleFacultyIds) return departmentRankings;
    const allowed = new Set(visibleFacultyIds);
    return departmentRankings.filter((item) => allowed.has(item.facultyId));
  }, [departmentRankings, visibleFacultyIds]);

  const semesterLabel = useMemo(() => {
    for (const year of academicYears) {
      const found = year.semesters.find((s) => s.semesterId === selectedSemesterId);
      if (found) return `${year.academicYearName} · ${found.semesterName}`;
    }
    return 'Học kỳ';
  }, [academicYears, selectedSemesterId]);

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

  // Mọi cột đều khai báo filterValue để dùng menu lọc kiểu Excel ngay trên tiêu đề,
  // thay cho thanh lọc cũ chiếm nguyên một băng phía trên bảng.
  const resultColumns: Column<SurveyResultDetail>[] = [
    {
      key: 'courseCode',
      header: 'Mã Học phần',
      width: '100px',
      sortValue: (item) => item.courseCode,
      filterValue: (item) => item.courseCode,
      render: (item) => <span className="catalog-cell-primary">{item.courseCode}</span>,
    },
    {
      key: 'courseName',
      header: 'Tên học phần',
      sortValue: (item) => item.courseName,
      filterValue: (item) => item.courseName,
      render: (item) => <span className="catalog-cell-primary">{item.courseName}</span>,
    },
    {
      key: 'sectionName',
      header: 'Nhóm lớp',
      width: '90px',
      sortValue: (item) => item.sectionName,
      filterValue: (item) => item.sectionName,
      render: (item) => <span className="operations-code">{item.sectionName}</span>,
    },
    {
      key: 'facultyName',
      header: 'Khoa',
      width: '130px',
      sortValue: (item) => item.facultyName,
      filterValue: (item) => item.facultyName,
      render: (item) => <span className="catalog-cell-primary">{item.facultyName}</span>,
    },
    {
      key: 'departmentName',
      header: 'Bộ môn',
      width: '130px',
      sortValue: (item) => item.departmentName,
      filterValue: (item) => item.departmentName,
      render: (item) => <span className="catalog-cell-primary">{item.departmentName}</span>,
    },
    {
      key: 'lecturerName',
      header: 'Giảng viên',
      width: '190px',
      sortValue: (item) => item.lecturerName,
      filterValue: (item) => item.lecturerName,
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
      key: 'classSize',
      header: 'Sĩ số',
      sortValue: (item) => item.classSize,
      filterValue: (item) => String(item.classSize),
      numeric: true,
      width: '64px',
      render: (item) => <span className="catalog-cell-number">{item.classSize}</span>,
    },
    {
      key: 'responseCount',
      header: 'Phiếu thu',
      sortValue: (item) => item.responseCount,
      filterValue: (item) => String(item.responseCount),
      numeric: true,
      width: '92px',
      render: (item) => <span className="catalog-cell-number">{item.responseCount}</span>,
    },
    {
      key: 'invalidResponseCount',
      header: 'Phiếu lỗi',
      sortValue: (item) => item.invalidResponseCount,
      filterValue: (item) => String(item.invalidResponseCount),
      numeric: true,
      width: '84px',
      render: (item) => (
        <span
          className={item.invalidResponseCount > 0
            ? 'catalog-cell-number reports-invalid-count'
            : 'catalog-cell-number'}
        >
          {item.invalidResponseCount}
        </span>
      ),
    },
    {
      key: 'completionRate',
      header: 'Hoàn thành',
      sortValue: (item) => item.completionRate,
      filterValue: (item) => String(Math.round(item.completionRate)),
      numeric: true,
      width: '140px',
      render: (item) => (
        <>
          <span className="reports-progress-cell">
            <span className="reports-progress">
              <span style={{ width: `${Math.min(100, item.completionRate)}%`, background: completionColor(item.completionRate) }} />
            </span>
            <span style={{ color: completionColor(item.completionRate), fontWeight: 700, fontSize: 12 }}>
              {item.completionRate.toFixed(0)}%
            </span>
          </span>
          <span className="catalog-secondary-value reports-progress-sub">
            {item.validResponseCount}/{item.classSize} hợp lệ
          </span>
        </>
      ),
    },
    {
      key: 'averageScore',
      header: 'Điểm TB',
      sortValue: (item) => item.averageScore,
      filterValue: (item) => item.averageScore.toFixed(2),
      numeric: true,
      width: '96px',
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
      width: '96px',
      render: (item) => (
        <button
          type="button"
          className="btn btn-secondary btn-sm reports-row-action"
          title={`Xem kết quả ${item.courseCode} - ${item.sectionName}`}
          onClick={() => {
            openSurvey(
              item.courseSectionSurveyId,
              `${item.courseCode} - ${item.courseName} (${item.sectionName})`,
            );
          }}
        >
          <ClipboardList className="operation-icon" aria-hidden="true" />
          Xem KQ
        </button>
      ),
    },
  ];

  // Cùng bộ cột, cùng cách tính và cùng bộ lọc với bảng tra cứu chi tiết.
  const sectionColumns: Column<LecturerPerformanceReport['sections'][number]>[] = [
    {
      key: 'courseCode',
      header: 'Mã Học phần',
      width: '100px',
      sortValue: (item) => item.courseCode,
      filterValue: (item) => item.courseCode,
      render: (item) => <span className="catalog-cell-primary">{item.courseCode}</span>,
    },
    {
      key: 'courseName',
      header: 'Tên học phần',
      sortValue: (item) => item.courseName,
      filterValue: (item) => item.courseName,
      render: (item) => <span className="catalog-cell-primary">{item.courseName}</span>,
    },
    {
      key: 'sectionName',
      header: 'Nhóm lớp',
      width: '90px',
      sortValue: (item) => item.sectionName,
      filterValue: (item) => item.sectionName,
      render: (item) => <span className="operations-code">{item.sectionName}</span>,
    },
    {
      key: 'classSize',
      header: 'Sĩ số',
      width: '64px',
      numeric: true,
      sortValue: (item) => item.classSize,
      filterValue: (item) => String(item.classSize),
      render: (item) => <span className="catalog-cell-number">{item.classSize}</span>,
    },
    {
      key: 'responseCount',
      header: 'Phiếu thu',
      width: '92px',
      numeric: true,
      sortValue: (item) => item.responseCount,
      filterValue: (item) => String(item.responseCount),
      render: (item) => <span className="catalog-cell-number">{item.responseCount}</span>,
    },
    {
      key: 'invalidResponseCount',
      header: 'Phiếu lỗi',
      width: '84px',
      numeric: true,
      sortValue: (item) => item.invalidResponseCount,
      filterValue: (item) => String(item.invalidResponseCount),
      render: (item) => (
        <span
          className={item.invalidResponseCount > 0
            ? 'catalog-cell-number reports-invalid-count'
            : 'catalog-cell-number'}
        >
          {item.invalidResponseCount}
        </span>
      ),
    },
    {
      key: 'completionRate',
      header: 'Hoàn thành',
      width: '140px',
      numeric: true,
      sortValue: (item) => item.completionRate,
      filterValue: (item) => String(Math.round(item.completionRate)),
      render: (item) => (
        <>
          <span className="reports-progress-cell">
            <span className="reports-progress">
              <span style={{ width: `${Math.min(100, item.completionRate)}%`, background: completionColor(item.completionRate) }} />
            </span>
            <span style={{ color: completionColor(item.completionRate), fontWeight: 700, fontSize: 12 }}>
              {item.completionRate.toFixed(0)}%
            </span>
          </span>
          <span className="catalog-secondary-value reports-progress-sub">
            {item.validResponseCount}/{item.classSize} hợp lệ
          </span>
        </>
      ),
    },
    {
      key: 'averageScore',
      header: 'Điểm TB',
      width: '96px',
      numeric: true,
      sortValue: (item) => item.averageScore,
      filterValue: (item) => item.averageScore.toFixed(2),
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
      width: '96px',
      render: (item) => (
        <button
          type="button"
          className="btn btn-secondary btn-sm reports-row-action"
          title={`Xem kết quả ${item.courseCode} - ${item.sectionName}`}
          onClick={() => openSurvey(
            item.courseSectionSurveyId,
            `${item.courseCode} - ${item.courseName} (${item.sectionName})`,
            lecturer?.lecturerId,
          )}
        >
          <ClipboardList className="operation-icon" aria-hidden="true" />
          Xem KQ
        </button>
      ),
    },
  ];

  return (
    <div className="survey-operations-page reports-module">
      {/* Thanh tiêu đề + chọn học kỳ */}
      <div className="reports-header">
        <h1 className="reports-title">
          <BarChart3 className="operation-icon" aria-hidden="true" />
          Thống kê kết quả khảo sát học phần
        </h1>
        <div className="reports-scope-fields">
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

          {/* Bài khảo sát áp cho cả trang: tổng quan, tra cứu và tổng hợp đơn vị. */}
          <div className="operations-field reports-campaign-field">
            <label htmlFor="reports-campaign">Bài khảo sát</label>
            <select
              id="reports-campaign"
              value={semesterSurveyId ?? ''}
              disabled={semesterSurveys.length === 0}
              onChange={(e) => changeSemesterSurvey(e.target.value ? Number(e.target.value) : undefined)}
            >
              {semesterSurveys.length === 0 && (
                <option value="">Kỳ này chưa có bài khảo sát</option>
              )}
              {semesterSurveys.map((survey) => (
                <option key={survey.semesterSurveyId} value={survey.semesterSurveyId}>
                  {survey.templateName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Breadcrumb chỉ có việc khi đã đi sâu vào giảng viên / bài khảo sát; ở mức
          danh sách nó chỉ lặp lại đúng những gì thanh tab và ô chọn kỳ đã nói. */}
      {(lecturer || surveyTitle) && (
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
          <span className="reports-breadcrumb-semester">{semesterLabel}</span>
        </nav>
      )}

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
              {/* Cùng kiểu dải mỏng với trang chi tiết bài khảo sát. */}
              <section className="reports-summary-band" aria-label="Tóm tắt đánh giá giảng viên">
                <div className="reports-summary-main">
                  <GraduationCap className="operation-icon" aria-hidden="true" />
                  <h2>{lecturerDetail.fullName}</h2>
                  <p>
                    {lecturerDetail.departmentName} · {lecturerDetail.facultyName}
                  </p>
                </div>
                <div className="reports-summary-metrics">
                  <span className="reports-exec-stat" title="Chỉ gộp phiếu hợp lệ">
                    <Star className="operation-icon" style={{ color: '#b86216' }} aria-hidden="true" />
                    Điểm trung bình
                    <strong style={{ color: scoreColor(lecturerDetail.averageScore) }}>
                      {lecturerDetail.averageScore.toFixed(2)}
                    </strong>
                    <small>/ 5.0</small>
                  </span>
                  <span className="reports-exec-stat" title="Phiếu qua được bộ lọc nhiễu">
                    <CheckCircle2 className="operation-icon" style={{ color: '#137b3b' }} aria-hidden="true" />
                    Phiếu hợp lệ
                    <strong>{lecturerDetail.totalResponses.toLocaleString('vi-VN')}</strong>
                  </span>
                  <span className="reports-exec-stat" title="Số lớp học phần đã phát phiếu">
                    <Target className="operation-icon" style={{ color: '#20262c' }} aria-hidden="true" />
                    Số lớp học phần
                    <strong>{lecturerDetail.courseSectionCount}</strong>
                  </span>
                </div>
              </section>

              {renderQuestionAnalysis(lecturerDetail.questionRatings)}

              <DataTable
                columns={sectionColumns}
                data={lecturerDetail.sections ?? []}
                emptyMessage="Giảng viên này chưa có lớp học phần nào trong học kỳ."
                keyExtractor={(item) => String(item.courseSectionSurveyId)}
                showIndex={false}
                pageSize={20}
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
              title="Chỉ số và xu hướng toàn trường"
              onClick={() => navigateToWorkspace('overview')}
            >
              <LayoutDashboard className="operation-icon" aria-hidden="true" />
              <strong>Tổng quan</strong>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={workspace === 'details'}
              className={`reports-workspace-tab${workspace === 'details' ? ' is-active' : ''}`}
              title="Lọc và mở kết quả từng lớp"
              onClick={() => navigateToWorkspace('details')}
            >
              <ListFilter className="operation-icon" aria-hidden="true" />
              <strong>Tra cứu chi tiết</strong>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={workspace === 'rankings'}
              className={`reports-workspace-tab${workspace === 'rankings' ? ' is-active' : ''}`}
              title="Kết quả theo Khoa/Viện và Bộ môn"
              onClick={() => navigateToWorkspace('rankings')}
            >
              <Building2 className="operation-icon" aria-hidden="true" />
              <strong>Tổng hợp đơn vị</strong>
            </button>
          </nav>

          {/* Bảng tổng quan toàn trường (executive dashboard) */}
          {workspace === 'overview' && selectedSemesterId !== undefined && (
            <SchoolSurveyOverview
              key={selectedSemesterId}
              semesterId={selectedSemesterId}
              semesterSurveyId={semesterSurveyId}
              analysisView={analysisView}
              onAnalysisViewChange={changeAnalysisView}
              onDrillDown={handleOverviewDrillDown}
            />
          )}

          {/* KPI — một dải mỏng, phần giải thích đưa vào tooltip để nhường chỗ cho bảng. */}
          {workspace === 'details' && (
          <div id="reports-detail-workspace" className="reports-kpi-band" aria-label="Tổng quan kết quả đang lọc">
            <span className="reports-kpi-item" title="Sinh viên trong danh sách">
              <Users className="operation-icon" style={{ color: '#0788b8' }} aria-hidden="true" />
              Chỉ tiêu phiếu
              <strong>{kpi.totalTarget.toLocaleString('vi-VN')}</strong>
            </span>
            <span className="reports-kpi-item" title="Phiếu hoàn thành hợp lệ">
              <CheckCircle2 className="operation-icon" style={{ color: '#137b3b' }} aria-hidden="true" />
              Đã thu nộp
              <strong>{kpi.totalCollected.toLocaleString('vi-VN')}</strong>
            </span>
            <span className="reports-kpi-item" title="Phiếu hợp lệ / chỉ tiêu">
              <TrendingUp className="operation-icon" style={{ color: '#b86216' }} aria-hidden="true" />
              Tỷ lệ hoàn thành
              <strong>{kpi.completionRate.toFixed(1)}%</strong>
            </span>
            <span className="reports-kpi-item" title="Lớp học phần trong bộ lọc">
              <Target className="operation-icon" style={{ color: '#20262c' }} aria-hidden="true" />
              Số lớp khảo sát
              <strong>{kpi.classCount}</strong>
            </span>
          </div>
          )}

          {/* Tổng hợp kết quả theo Khoa / Viện và Bộ môn */}
          {workspace === 'rankings' && (
          <div className="reports-rank-grid reports-workspace-panel" role="tabpanel">
            <RankedUnitTable
              title="Kết quả theo Khoa/Viện"
              icon={<Building2 className="operation-icon" aria-hidden="true" />}
              data={facultyRankings}
              itemLabel="Khoa/Viện"
              onVisibleDataChange={handleFacultyRowsChange}
            />
            <RankedUnitTable
              title="Kết quả theo Bộ môn"
              icon={<Target className="operation-icon" aria-hidden="true" />}
              data={visibleDepartmentRankings}
              itemLabel={visibleFacultyIds ? 'Bộ môn theo Khoa đang lọc' : 'Bộ môn'}
            />
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
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Mã HP, tên HP, nhóm lớp, giảng viên..."
              toolbarActions={scopeChips.length > 0 ? (
                <div className="reports-scope-chips">
                  {scopeChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      className="reports-scope-chip"
                      onClick={chip.onClear}
                      title={`Bỏ lọc ${chip.label}`}
                    >
                      {chip.label}
                      <X aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ) : undefined}
              emptyMessage={
                resultsLoading
                  ? 'Đang tải kết quả...'
                  : 'Không có lớp học phần nào khớp với bộ lọc hiện tại.'
              }
              keyExtractor={(item) => String(item.courseSectionSurveyId)}
              showIndex={false}
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
