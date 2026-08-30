import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AreaChart as AreaChartIcon,
  BarChart3,
  ChartBarStacked,
  ChartColumn,
  ChartColumnStacked,
  Donut,
  FileSpreadsheet,
  LineChart as LineChartIcon,
  LoaderCircle,
  PieChart,
  Table2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { GraduationEChart } from '../components/graduation/GraduationEChart';
import { GraduationImportDialog } from '../components/graduation/GraduationImportDialog';
import { graduationAnalyticsApi } from '../services/graduationAnalyticsApi';
import type {
  GraduationAnalysisScope,
  GraduationChartType,
  GraduationDimension,
  GraduationFacets,
  GraduationMetadata,
  GraduationOverview,
  GraduationPeriod,
  GraduationQueryResult,
  GraduationRow,
} from '../types/graduationAnalytics';
import '../styles/graduation-analytics.css';

type GraduationView = 'overview' | 'explore' | 'table';
type ChartSort = 'auto' | 'value-desc' | 'value-asc' | 'label-asc';
type OverviewMeasure = 'count' | 'percent';

const bucketSeries = [
  { key: 'excellent', countKey: 'excellentCount', rateKey: 'excellentRate', label: 'Xuất sắc', color: '#0788b8' },
  { key: 'veryGood', countKey: 'veryGoodCount', rateKey: 'veryGoodRate', label: 'Giỏi', color: '#38a3a5' },
  { key: 'good', countKey: 'goodCount', rateKey: 'goodRate', label: 'Khá', color: '#86b049' },
  { key: 'average', countKey: 'averageCount', rateKey: 'averageRate', label: 'Trung bình', color: '#e2a23a' },
  { key: 'workStudyTransfer', countKey: 'workStudyTransferCount', rateKey: 'workStudyTransferRate', label: 'Chuyển VHVL', color: '#9b6eb2' },
] as const;

const chartOptions: Array<{ id: GraduationChartType; label: string; icon: typeof BarChart3 }> = [
  { id: 'bar', label: 'Thanh ngang', icon: BarChart3 },
  { id: 'column', label: 'Cột', icon: ChartColumn },
  { id: 'stacked-bar', label: 'Thanh chồng', icon: ChartBarStacked },
  { id: 'stacked-column', label: 'Cột chồng', icon: ChartColumnStacked },
  { id: 'line', label: 'Đường', icon: LineChartIcon },
  { id: 'area', label: 'Miền', icon: AreaChartIcon },
  { id: 'pie', label: 'Tròn', icon: PieChart },
  { id: 'donut', label: 'Donut', icon: Donut },
];

const queryValue = (key: string) => new URLSearchParams(window.location.search).get(key) ?? '';
const initialView = (): GraduationView => {
  const value = queryValue('gaView');
  return value === 'explore' || value === 'table' ? value : 'overview';
};
const initialScope = (): GraduationAnalysisScope => queryValue('gaScope') === 'period' ? 'period' : 'cumulative';
const initialOverviewMeasure = (): OverviewMeasure => queryValue('gaOverviewMeasure') === 'percent' ? 'percent' : 'count';
const initialChartType = (): GraduationChartType => {
  const value = queryValue('gaChart');
  return chartOptions.some((item) => item.id === value) ? value as GraduationChartType : 'bar';
};
const positiveNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};
const formatValue = (value: number | null | undefined, unit: 'count' | 'percent' = 'count') => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('vi-VN', { maximumFractionDigits: unit === 'percent' ? 1 : 0 })}${unit === 'percent' ? '%' : ''}`;
};
const sourceCell = (value: string | number | null, percent = false) => {
  if (value === null || value === '') return '—';
  if (percent && typeof value === 'number') return `${value.toLocaleString('vi-VN', { maximumFractionDigits: 4 })}%`;
  return typeof value === 'number' ? value.toLocaleString('vi-VN', { maximumFractionDigits: 4 }) : value;
};

const toChartModel = (result: GraduationQueryResult | null, label: string) => {
  if (!result) return { data: [], series: [] as Array<{ key: string; label: string }> };
  const seriesLabels = [...new Set(result.points.map((point) => point.series).filter((value): value is string => Boolean(value)))];
  if (seriesLabels.length === 0) {
    return {
      data: result.points.map((point) => ({ name: point.group, value: point.value })),
      series: [{ key: 'value', label }],
    };
  }
  const series = seriesLabels.map((seriesLabel, index) => ({ key: `series${index}`, label: seriesLabel }));
  const keyByLabel = new Map(series.map((item) => [item.label, item.key]));
  const grouped = new Map<string, Record<string, string | number | null>>();
  result.points.forEach((point) => {
    const row = grouped.get(point.group) ?? { name: point.group };
    const key = point.series ? keyByLabel.get(point.series) : undefined;
    if (key) row[key] = point.value;
    grouped.set(point.group, row);
  });
  return { data: [...grouped.values()], series };
};

const sortChartData = (
  data: Array<Record<string, string | number | null>>,
  series: Array<{ key: string }>,
  sort: ChartSort,
  topN: number,
) => {
  const next = [...data];
  const total = (row: Record<string, string | number | null>) => series.reduce(
    (sum, item) => sum + (typeof row[item.key] === 'number' ? Number(row[item.key]) : 0), 0);
  if (sort === 'value-desc') next.sort((a, b) => total(b) - total(a));
  if (sort === 'value-asc') next.sort((a, b) => total(a) - total(b));
  if (sort === 'label-asc') next.sort((a, b) => String(a.name).localeCompare(String(b.name), 'vi'));
  return topN > 0 ? next.slice(0, topN) : next;
};

export function GraduationAnalyticsPage() {
  const [periods, setPeriods] = useState<GraduationPeriod[]>([]);
  const [metadata, setMetadata] = useState<GraduationMetadata | null>(null);
  const [facets, setFacets] = useState<GraduationFacets | null>(null);
  const [view, setView] = useState<GraduationView>(initialView);
  const [scope, setScope] = useState<GraduationAnalysisScope>(initialScope);
  const [periodId, setPeriodId] = useState<number | null>(() => positiveNumber(queryValue('gaPeriod')));
  const [faculty, setFaculty] = useState(() => queryValue('gaFaculty'));
  const [program, setProgram] = useState(() => queryValue('gaProgram'));
  const [cohort, setCohort] = useState(() => queryValue('gaCohort'));
  const [fromYear, setFromYear] = useState(() => queryValue('gaFrom'));
  const [toYear, setToYear] = useState(() => queryValue('gaTo'));
  const [overviewMeasure, setOverviewMeasure] = useState<OverviewMeasure>(initialOverviewMeasure);
  const [metricId, setMetricId] = useState(() => queryValue('gaMetric') || 'excellentRate');
  const [groupBy, setGroupBy] = useState<GraduationDimension['id']>(() => {
    const value = queryValue('gaGroup');
    return value === 'program' || value === 'cohort' || value === 'reviewYear' ? value : 'faculty';
  });
  const [seriesBy, setSeriesBy] = useState<GraduationDimension['id'] | ''>(() => {
    const value = queryValue('gaSeries');
    return value === 'faculty' || value === 'program' || value === 'cohort' || value === 'reviewYear' ? value : '';
  });
  const [chartType, setChartType] = useState<GraduationChartType>(initialChartType);
  const [chartSort, setChartSort] = useState<ChartSort>(() => {
    const value = queryValue('gaSort');
    return value === 'value-desc' || value === 'value-asc' || value === 'label-asc' ? value : 'auto';
  });
  const [topN, setTopN] = useState(() => Number(queryValue('gaTop')) || 0);
  const [showLabels, setShowLabels] = useState(() => queryValue('gaLabels') === '1');
  const [overview, setOverview] = useState<GraduationOverview | null>(null);
  const [queryResult, setQueryResult] = useState<GraduationQueryResult | null>(null);
  const [rows, setRows] = useState<GraduationRow[]>([]);
  const [rowTotal, setRowTotal] = useState(0);
  const [rowPage, setRowPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [panelLoading, setPanelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const loadInitial = useCallback(async (preferredPeriodId?: number) => {
    setLoading(true);
    setError(null);
    try {
      const [nextPeriods, nextMetadata] = await Promise.all([
        graduationAnalyticsApi.periods(),
        graduationAnalyticsApi.metadata(),
      ]);
      setPeriods(nextPeriods);
      setMetadata(nextMetadata);
      setPeriodId((current) => preferredPeriodId
        ?? (current && nextPeriods.some((item) => item.periodId === current)
          ? current
          : nextPeriods[0]?.periodId ?? null));
      setMetricId((current) => nextMetadata.metrics.some((item) => item.id === current)
        ? current
        : nextMetadata.metrics[0]?.id ?? 'excellentRate');
    } catch {
      setError('Không tải được module thống kê kết quả tốt nghiệp.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadInitial(); }, [loadInitial]);
  useEffect(() => {
    if (scope === 'period' && groupBy === 'reviewYear') setGroupBy('faculty');
    if (scope === 'period' && seriesBy === 'reviewYear') setSeriesBy('');
    if (seriesBy === groupBy) setSeriesBy('');
  }, [groupBy, scope, seriesBy]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const setOrDelete = (key: string, value: string | number | null) => {
      if (value === '' || value === null || value === 0) query.delete(key);
      else query.set(key, String(value));
    };
    setOrDelete('gaView', view === 'overview' ? '' : view);
    setOrDelete('gaScope', view === 'explore' && scope === 'period' ? scope : '');
    setOrDelete('gaPeriod', view === 'table' || view === 'explore' && scope === 'period' ? periodId : null);
    setOrDelete('gaFaculty', faculty);
    setOrDelete('gaProgram', program);
    setOrDelete('gaCohort', cohort);
    setOrDelete('gaFrom', view === 'overview' ? fromYear : '');
    setOrDelete('gaTo', view === 'overview' ? toYear : '');
    setOrDelete('gaOverviewMeasure', view === 'overview' && overviewMeasure === 'percent' ? overviewMeasure : '');
    setOrDelete('gaMetric', view === 'explore' ? metricId : '');
    setOrDelete('gaGroup', view === 'explore' && groupBy !== 'faculty' ? groupBy : '');
    setOrDelete('gaSeries', view === 'explore' ? seriesBy : '');
    setOrDelete('gaChart', view === 'explore' && chartType !== 'bar' ? chartType : '');
    setOrDelete('gaSort', view === 'explore' && chartSort !== 'auto' ? chartSort : '');
    setOrDelete('gaTop', view === 'explore' ? topN : 0);
    setOrDelete('gaLabels', view === 'explore' && showLabels ? '1' : '');
    const nextUrl = `${window.location.pathname}${query.size ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }, [chartSort, chartType, cohort, faculty, fromYear, groupBy, metricId, overviewMeasure, periodId, program, scope, seriesBy, showLabels, toYear, topN, view]);

  const facetScope: GraduationAnalysisScope = view === 'overview'
    ? 'cumulative'
    : view === 'table' ? 'period' : scope;
  useEffect(() => {
    if (facetScope === 'period' && !periodId) {
      setFacets(null);
      return;
    }
    let cancelled = false;
    graduationAnalyticsApi.facets(facetScope, facetScope === 'period' ? periodId : null)
      .then((next) => { if (!cancelled) setFacets(next); })
      .catch(() => { if (!cancelled) toast.error('Không tải được danh mục bộ lọc'); });
    return () => { cancelled = true; };
  }, [facetScope, periodId]);

  useEffect(() => {
    if (view !== 'overview' || periods.length === 0) return;
    let cancelled = false;
    setPanelLoading(true);
    setPanelError(null);
    graduationAnalyticsApi.overview({
      faculty: faculty || null,
      program: program || null,
      cohort: cohort || null,
      fromYear: fromYear ? Number(fromYear) : null,
      toYear: toYear ? Number(toYear) : null,
    }).then((next) => { if (!cancelled) setOverview(next); })
      .catch(() => { if (!cancelled) setPanelError('Không tải được dữ liệu Tổng quan.'); })
      .finally(() => { if (!cancelled) setPanelLoading(false); });
    return () => { cancelled = true; };
  }, [cohort, faculty, fromYear, periods.length, program, toYear, view]);

  useEffect(() => {
    if (view !== 'explore'
      || !metadata
      || scope === 'period' && (!periodId || groupBy === 'reviewYear' || seriesBy === 'reviewYear')) return;
    let cancelled = false;
    setPanelLoading(true);
    setPanelError(null);
    graduationAnalyticsApi.query({
      scope,
      periodId: scope === 'period' ? periodId : null,
      metricId,
      groupBy,
      seriesBy: seriesBy || null,
      faculty: faculty || null,
      program: program || null,
      cohort: cohort || null,
    }).then((next) => { if (!cancelled) setQueryResult(next); })
      .catch(() => { if (!cancelled) setPanelError('Không thể tạo biểu đồ với cấu hình hiện tại.'); })
      .finally(() => { if (!cancelled) setPanelLoading(false); });
    return () => { cancelled = true; };
  }, [cohort, faculty, groupBy, metadata, metricId, periodId, program, scope, seriesBy, view]);

  useEffect(() => {
    if (view !== 'table' || !periodId) return;
    let cancelled = false;
    setPanelLoading(true);
    setPanelError(null);
    graduationAnalyticsApi.rows(periodId, rowPage, 25, search, {
      faculty: faculty || undefined,
      program: program || undefined,
      cohort: cohort || undefined,
    }).then((page) => {
      if (cancelled) return;
      setRows(page.items);
      setRowTotal(page.totalCount);
    }).catch(() => { if (!cancelled) setPanelError('Không tải được bảng dữ liệu nguồn.'); })
      .finally(() => { if (!cancelled) setPanelLoading(false); });
    return () => { cancelled = true; };
  }, [cohort, faculty, periodId, program, rowPage, search, view]);

  const metric = metadata?.metrics.find((item) => item.id === metricId);
  const exploreDimensions = useMemo(() => metadata?.dimensions.filter((item) =>
    scope === 'cumulative' || item.id !== 'reviewYear') ?? [], [metadata?.dimensions, scope]);
  const availablePrograms = useMemo(() => facets?.programs.filter((item) =>
    !faculty || item.facultyName === faculty) ?? [], [facets?.programs, faculty]);
  const chartModel = useMemo(() => toChartModel(queryResult, metric?.label ?? 'Giá trị'), [metric?.label, queryResult]);
  const displayChartData = useMemo(() =>
    sortChartData(chartModel.data, chartModel.series, chartSort, topN),
  [chartModel.data, chartModel.series, chartSort, topN]);
  const distinctExploreGroups = new Set(queryResult?.points.map((point) => point.group)).size;
  const availableChartTypes = useMemo(() => metric?.chartTypes.filter((type) => {
    if ((type === 'pie' || type === 'donut') && (seriesBy || distinctExploreGroups > 12)) return false;
    if ((type === 'stacked-bar' || type === 'stacked-column') && !seriesBy) return false;
    return true;
  }) ?? [], [distinctExploreGroups, metric?.chartTypes, seriesBy]);
  useEffect(() => {
    if (availableChartTypes.length > 0 && !availableChartTypes.includes(chartType)) {
      setChartType(availableChartTypes[0]);
    }
  }, [availableChartTypes, chartType]);

  const overviewComparisonModel = useMemo(() => {
    const points = [...(overview?.cohortYear ?? [])].sort((a, b) =>
      a.reviewYear - b.reviewYear || a.cohort.localeCompare(b.cohort, 'vi', { numeric: true }));
    const data = points.map((point) => {
      const row: Record<string, string | number | null> = {
        name: `${point.reviewYear}\n${point.cohort}`,
      };
      bucketSeries.forEach((bucket) => {
        const count = point[bucket.countKey];
        row[bucket.key] = overviewMeasure === 'count'
          ? count
          : point.includedRows === point.totalRows && point.totalOutcome > 0
            ? count / point.totalOutcome * 100
            : null;
      });
      return row;
    });
    return {
      data,
      series: bucketSeries.map((bucket) => ({ key: bucket.key, label: bucket.label })),
      colors: bucketSeries.map((bucket) => bucket.color),
      incompletePointCount: points.filter((point) => point.includedRows < point.totalRows).length,
    };
  }, [overview?.cohortYear, overviewMeasure]);
  const selectedPeriod = periods.find((item) => item.periodId === periodId) ?? null;
  const rowPageCount = Math.max(1, Math.ceil(rowTotal / 25));

  const resetFilters = () => {
    setFaculty('');
    setProgram('');
    setCohort('');
    setFromYear('');
    setToYear('');
    setRowPage(1);
  };
  const handlePeriodChange = (nextId: number) => {
    setPeriodId(nextId);
    setRowPage(1);
    setSearch('');
    resetFilters();
  };
  const handleImport = async (payload: Parameters<typeof graduationAnalyticsApi.importPeriod>[0]) => {
    const imported = await graduationAnalyticsApi.importPeriod(payload);
    await loadInitial(imported.period.periodId);
    setPeriodId(imported.period.periodId);
    setScope('period');
    setView('table');
    setRowPage(1);
    toast.success(`Đã import đợt ${imported.period.label} với ${imported.period.rowCount} dòng`);
    return imported.period;
  };

  const renderFilters = (withYears = false) => (
    <div className={`graduation-filters${withYears ? ' graduation-filters--years' : ''}`}>
      <label>Khoa<select value={faculty} onChange={(event) => { setFaculty(event.target.value); setProgram(''); setRowPage(1); }}><option value="">Tất cả khoa</option>{facets?.faculties.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label>Chương trình đào tạo<select value={program} onChange={(event) => { setProgram(event.target.value); setRowPage(1); }}><option value="">Tất cả CTĐT</option>{availablePrograms.map((item) => <option key={`${item.facultyName}|${item.value}`} value={item.value}>{item.label}</option>)}</select></label>
      <label>Khóa<select value={cohort} onChange={(event) => { setCohort(event.target.value); setRowPage(1); }}><option value="">Tất cả khóa</option>{facets?.cohorts.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      {withYears && <>
        <label>Từ năm<select value={fromYear} onChange={(event) => setFromYear(event.target.value)}><option value="">Tất cả</option>{facets?.reviewYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label>Đến năm<select value={toYear} onChange={(event) => setToYear(event.target.value)}><option value="">Tất cả</option>{facets?.reviewYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
      </>}
      <button type="button" className="btn btn-secondary" onClick={resetFilters}>Đặt lại</button>
    </div>
  );

  if (loading) {
    return <div className="graduation-page"><div className="graduation-state"><LoaderCircle className="spin" /> Đang tải module...</div></div>;
  }
  if (error || !metadata) {
    return <div className="graduation-page"><div className="graduation-empty"><h2>Không tải được dữ liệu</h2><p>{error}</p><button type="button" className="btn btn-primary" onClick={() => void loadInitial()}>Thử lại</button></div></div>;
  }

  if (periods.length === 0) {
    return <div className="graduation-page">
      <header className="graduation-page__header"><div><span>THỐNG KÊ KẾT QUẢ TỐT NGHIỆP</span><h1>Kết quả tốt nghiệp theo đợt</h1></div></header>
      <div className="graduation-empty"><FileSpreadsheet size={42} /><h2>Chưa có đợt tốt nghiệp</h2><p>Import biểu mẫu 16 cột C–R để bắt đầu xây dựng báo cáo tích lũy.</p><button type="button" className="btn btn-primary" onClick={() => setImportOpen(true)}><Upload size={17} /> Import đợt đầu tiên</button></div>
      <GraduationImportDialog isOpen={importOpen} onClose={() => setImportOpen(false)} onImport={handleImport} />
    </div>;
  }

  return <div className="graduation-page">
    <header className="graduation-page__header">
      <div><span>THỐNG KÊ KẾT QUẢ TỐT NGHIỆP</span><h1>Kết quả tốt nghiệp theo đợt</h1></div>
      <button type="button" className="btn btn-primary" onClick={() => setImportOpen(true)}><Upload size={17} /> Import đợt</button>
    </header>

    <nav className="graduation-view-switch graduation-view-switch--three" aria-label="Màn hình thống kê tốt nghiệp">
      <button type="button" className={view === 'overview' ? 'is-selected' : ''} onClick={() => setView('overview')}>Tổng quan</button>
      <button type="button" className={view === 'explore' ? 'is-selected' : ''} onClick={() => setView('explore')}>Khám phá chi tiết</button>
      <button type="button" className={view === 'table' ? 'is-selected' : ''} onClick={() => setView('table')}>Bảng</button>
    </nav>

    {view === 'overview' && <section className="graduation-tab-panel" aria-busy={panelLoading}>
      {renderFilters(true)}
      {panelLoading && <div className="graduation-overview-status"><LoaderCircle className="spin" /> Đang cập nhật biểu đồ...</div>}
      {panelError && <div className="graduation-alert" role="alert">{panelError}</div>}
      {overview && <article className="graduation-composition">
        <header><div><span>GÓC NHÌN NHANH</span><h2>Cơ cấu kết quả trong phạm vi đang lọc</h2></div><strong>{formatValue(overview.totalOutcome)} sinh viên</strong></header>
        {overview.totalOutcome > 0 ? <>
          <div className="graduation-composition__chart" aria-label="Cơ cấu năm nhóm kết quả tốt nghiệp">{overview.composition.map((item) => { const color = bucketSeries.find((bucket) => bucket.key === item.metricId)?.color ?? '#87919a'; return <span key={item.metricId} style={{ width: `${item.rate ?? 0}%`, background: color }} title={`${item.label}: ${formatValue(item.rate, 'percent')}`} />; })}</div>
          <div className="graduation-composition__legend">{overview.composition.map((item) => { const color = bucketSeries.find((bucket) => bucket.key === item.metricId)?.color ?? '#87919a'; return <div key={item.metricId}><i style={{ background: color }} /><span>{item.label}</span><strong>{formatValue(item.count)}</strong><small>{formatValue(item.rate, 'percent')}</small></div>; })}</div>
          <p>Các nhóm dùng trực tiếp số lượng nguồn Excel; hệ thống chỉ cộng theo phạm vi lọc. {overview.includedRows}/{overview.totalRows} dòng đủ cả năm nhóm.</p>
        </> : <div className="graduation-composition__empty">Không có dữ liệu phù hợp với bộ lọc.</div>}
      </article>}
      {overview && overview.cohortYear.length > 0
        ? <article className="graduation-cohort-comparison">
          <header>
            <div><span>SO SÁNH THEO NĂM VÀ KHÓA</span><h2>Cơ cấu kết quả tốt nghiệp</h2><p>Mỗi cột là một khóa trong một năm xét; năm màu là năm nhóm kết quả.</p></div>
            <div className="graduation-measure-switch" role="group" aria-label="Đơn vị biểu đồ">
              <button type="button" className={overviewMeasure === 'count' ? 'is-selected' : ''} aria-pressed={overviewMeasure === 'count'} onClick={() => setOverviewMeasure('count')}>Số lượng</button>
              <button type="button" className={overviewMeasure === 'percent' ? 'is-selected' : ''} aria-pressed={overviewMeasure === 'percent'} onClick={() => setOverviewMeasure('percent')}>Tỷ lệ</button>
            </div>
          </header>
          <div className="graduation-cohort-comparison__chart">
            <GraduationEChart
              type="stacked-column"
              data={overviewComparisonModel.data}
              series={overviewComparisonModel.series}
              unit={overviewMeasure}
              showLabels={false}
              colors={overviewComparisonModel.colors}
              xAxisName="Năm xét · Khóa"
              yAxisName={overviewMeasure === 'count' ? 'Số sinh viên' : 'Tỷ trọng'}
            />
          </div>
          <footer>
            {overviewMeasure === 'count'
              ? 'Chiều cao cột thể hiện tổng số sinh viên; rê chuột để xem số lượng từng nhóm.'
              : 'Mỗi cột đủ dữ liệu được quy về 100% để so sánh cơ cấu giữa các khóa.'}
            {overviewMeasure === 'percent' && overviewComparisonModel.incompletePointCount > 0
              && <strong>{overviewComparisonModel.incompletePointCount} tổ hợp năm–khóa thiếu một hoặc nhiều nhóm nên không tính tỷ lệ.</strong>}
          </footer>
        </article>
        : !panelLoading && <div className="graduation-overview-empty">Không có dữ liệu phù hợp với bộ lọc.</div>}
    </section>}

    {view === 'explore' && <section className="graduation-tab-panel" aria-busy={panelLoading}>
      <header className="graduation-tab-heading"><div><span>KHÁM PHÁ CHI TIẾT</span><h2>Tự cấu hình biểu đồ</h2><p>Chọn phạm vi dữ liệu trước, sau đó chọn chỉ tiêu và chiều phân tích.</p></div>{panelLoading && <span><LoaderCircle className="spin" /> Đang tính...</span>}</header>
      {renderFilters(false)}
      {panelError && <div className="graduation-alert" role="alert">{panelError}</div>}
      <div className="graduation-workspace">
        <aside className="graduation-builder">
          <h2>Cấu hình phân tích</h2>
          <label>Dữ liệu phân tích<select value={scope} onChange={(event) => setScope(event.target.value as GraduationAnalysisScope)}><option value="cumulative">Tích lũy tất cả các đợt</option><option value="period">Theo một đợt</option></select></label>
          {scope === 'period' && <label>Đợt tốt nghiệp<select value={periodId ?? ''} onChange={(event) => handlePeriodChange(Number(event.target.value))}>{periods.map((item) => <option key={item.periodId} value={item.periodId}>{item.label}</option>)}</select></label>}
          <label>Chỉ tiêu<select value={metricId} onChange={(event) => setMetricId(event.target.value)}>{metadata.metrics.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label>So sánh theo<select value={groupBy} onChange={(event) => { setGroupBy(event.target.value as GraduationDimension['id']); if (seriesBy === event.target.value) setSeriesBy(''); }}>{exploreDimensions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label>Phân chuỗi<select value={seriesBy} onChange={(event) => setSeriesBy(event.target.value as GraduationDimension['id'] | '')}><option value="">Không phân chuỗi</option>{exploreDimensions.filter((item) => item.id !== groupBy).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <fieldset><legend>Loại biểu đồ</legend><div className="graduation-chart-types">{chartOptions.map((item) => { const Icon = item.icon; const enabled = availableChartTypes.includes(item.id); return <button key={item.id} type="button" disabled={!enabled} className={chartType === item.id ? 'is-selected' : ''} onClick={() => setChartType(item.id)}><Icon /><span>{item.label}</span></button>; })}</div><p className="graduation-chart-types__hint">Biểu đồ tròn tối đa 12 nhóm và không dùng phân chuỗi; biểu đồ chồng cần một chiều phân chuỗi.</p></fieldset>
          <div className="graduation-builder__advanced"><label>Sắp xếp<select value={chartSort} onChange={(event) => setChartSort(event.target.value as ChartSort)}><option value="auto">Mặc định</option><option value="value-desc">Giá trị giảm dần</option><option value="value-asc">Giá trị tăng dần</option><option value="label-asc">Tên A–Z</option></select></label><label>Top N<select value={topN} onChange={(event) => setTopN(Number(event.target.value))}><option value={0}>Tất cả</option><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label></div>
          <label className="graduation-builder__check"><input type="checkbox" checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} /> Hiển thị nhãn giá trị</label>
        </aside>
        <article className="graduation-chart-panel"><header><div><h2>{metric?.label ?? 'Biểu đồ'}</h2><p>{scope === 'cumulative' ? 'Tích lũy tất cả các đợt' : selectedPeriod?.label}</p></div><span>{queryResult?.points.length ?? 0} điểm dữ liệu</span></header>{displayChartData.length > 0 ? <><div className="graduation-chart"><GraduationEChart type={chartType} data={displayChartData} series={chartModel.series} unit={metric?.unit} showLabels={showLabels} /></div><footer>{metric?.aggregation === 'ratio-of-sums' ? 'Tỉ lệ được tính từ tổng số lượng trong phạm vi; không dùng tỷ lệ nguyên bản Excel.' : 'Số lượng được cộng từ các dòng nguồn trong phạm vi.'}</footer><details className="graduation-chart-data"><summary>Xem bảng số liệu tương ứng</summary><div><table><thead><tr><th>Nhóm</th>{chartModel.series.map((item) => <th key={item.key}>{item.label}</th>)}</tr></thead><tbody>{displayChartData.map((row) => <tr key={String(row.name)}><td>{row.name}</td>{chartModel.series.map((item) => <td key={item.key}>{formatValue(typeof row[item.key] === 'number' ? Number(row[item.key]) : null, metric?.unit)}</td>)}</tr>)}</tbody></table></div></details></> : <div className="graduation-chart-empty">Không có dữ liệu phù hợp với cấu hình hiện tại.</div>}</article>
      </div>
    </section>}

    {view === 'table' && <section className="graduation-tab-panel" aria-busy={panelLoading}>
      <header className="graduation-tab-heading"><div><span>BẢNG DỮ LIỆU NGUỒN</span><h2>Đối chiếu từng dòng C–R</h2><p>Mỗi dòng giữ nguyên sheet và số dòng nguồn để truy vết.</p></div>{panelLoading && <span><LoaderCircle className="spin" /> Đang tải...</span>}</header>
      <div className="graduation-period-context"><label>Đợt tốt nghiệp<select value={periodId ?? ''} onChange={(event) => handlePeriodChange(Number(event.target.value))}>{periods.map((item) => <option key={item.periodId} value={item.periodId}>{item.label}</option>)}</select></label>{selectedPeriod && <div><strong>{selectedPeriod.label} · {selectedPeriod.rowCount} dòng</strong><span>{selectedPeriod.originalFileName} · {selectedPeriod.importedByName} · {new Date(selectedPeriod.importedAtUtc).toLocaleString('vi-VN')}</span></div>}</div>
      {renderFilters(false)}
      {panelError && <div className="graduation-alert" role="alert">{panelError}</div>}
      <div className="graduation-table-section">
        <header><div><Table2 size={18} /><h2>Dữ liệu nguồn C–R</h2><span>{rowTotal} dòng</span></div><input type="search" placeholder="Tìm khoa, mã/tên CTĐT, khóa..." value={search} onChange={(event) => { setSearch(event.target.value); setRowPage(1); }} /></header>
        <div className="graduation-source-table"><table><thead><tr><th>Dòng</th><th>Khoa</th><th>Mã CTĐT</th><th>Tên CTĐT</th><th>Khóa</th><th>Nhập học</th><th className="graduation-period-column">Thời điểm</th><th>XS</th><th>% XS</th><th>Giỏi</th><th>% Giỏi</th><th>Khá</th><th>% Khá</th><th>T.Bình</th><th>% T.Bình</th><th>VHVL</th><th>% VHVL</th></tr></thead><tbody>{rows.map((row) => <tr key={row.rowId}><td>{row.sourceRowNumber}</td><td>{row.facultyName}</td><td>{sourceCell(row.programCode)}</td><td>{row.programName}</td><td>{row.cohort}</td><td>{sourceCell(row.initialEnrollmentCount)}</td><td className="graduation-period-column">{row.reviewPeriodText}</td><td>{sourceCell(row.excellentCount)}</td><td>{sourceCell(row.excellentRate, true)}</td><td>{sourceCell(row.veryGoodCount)}</td><td>{sourceCell(row.veryGoodRate, true)}</td><td>{sourceCell(row.goodCount)}</td><td>{sourceCell(row.goodRate, true)}</td><td>{sourceCell(row.averageCount)}</td><td>{sourceCell(row.averageRate, true)}</td><td>{sourceCell(row.workStudyTransferCount)}</td><td>{sourceCell(row.workStudyTransferRate, true)}</td></tr>)}</tbody></table></div>
        <footer><span>Trang {rowPage}/{rowPageCount}</span><div><button type="button" className="btn btn-secondary btn-sm" disabled={rowPage === 1} onClick={() => setRowPage((page) => page - 1)}>Trước</button><button type="button" className="btn btn-secondary btn-sm" disabled={rowPage >= rowPageCount} onClick={() => setRowPage((page) => page + 1)}>Sau</button></div></footer>
      </div>
    </section>}

    <GraduationImportDialog isOpen={importOpen} onClose={() => setImportOpen(false)} onImport={handleImport} />
  </div>;
}
