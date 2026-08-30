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
  PieChart,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { GraduationEChart } from '../components/graduation/GraduationEChart';
import { GraduationImportDialog } from '../components/graduation/GraduationImportDialog';
import { GraduationOverview, type GraduationOverviewChartModel } from '../components/graduation/GraduationOverview';
import { ExportDropdown } from '../components/ExportDropdown';
import { graduationAnalyticsApi } from '../services/graduationAnalyticsApi';
import type {
  GraduationChartType,
  GraduationDataset,
  GraduationFacets,
  GraduationMetadata,
  GraduationQueryResult,
  GraduationRow,
} from '../types/graduationAnalytics';
import '../styles/graduation-analytics.css';

const chartOptions: Array<{
  id: GraduationChartType;
  label: string;
  icon: typeof BarChart3;
}> = [
  { id: 'bar', label: 'Thanh ngang', icon: BarChart3 },
  { id: 'column', label: 'Cột', icon: ChartColumn },
  { id: 'stacked-bar', label: 'Thanh chồng', icon: ChartBarStacked },
  { id: 'stacked-column', label: 'Cột chồng', icon: ChartColumnStacked },
  { id: 'line', label: 'Đường', icon: LineChartIcon },
  { id: 'area', label: 'Miền', icon: AreaChartIcon },
  { id: 'pie', label: 'Tròn', icon: PieChart },
  { id: 'donut', label: 'Donut', icon: Donut },
];

const metricDefaults = ['initialEnrollment', 'eligible', 'onTimeCount', 'onTimeRate'];
const compositionMetrics = [
  { id: 'excellentCount', label: 'Xuất sắc', color: '#0788b8' },
  { id: 'veryGoodCount', label: 'Giỏi', color: '#38a3a5' },
  { id: 'goodCount', label: 'Khá', color: '#86b049' },
  { id: 'averageCount', label: 'Trung bình', color: '#e2a23a' },
  { id: 'workStudyTransferCount', label: 'Chuyển VHVL', color: '#9b6eb2' },
];
const isTimeDimension = (dimension: string) =>
  dimension === 'reviewYear' || dimension === 'reviewPeriod';
type ChartSort = 'auto' | 'value-desc' | 'value-asc' | 'label-asc';
type GraduationView = 'overview' | 'explore';
const queryValue = (key: string) => new URLSearchParams(window.location.search).get(key) ?? '';
const initialChartType = (): GraduationChartType => {
  const value = queryValue('gaChart');
  return ['bar', 'column', 'stacked-bar', 'stacked-column', 'line', 'area', 'pie', 'donut'].includes(value)
    ? value as GraduationChartType
    : 'bar';
};
const initialTopN = () => {
  const value = Number(queryValue('gaTop'));
  return [5, 10, 20].includes(value) ? value : 0;
};

const formatValue = (value: number | null | undefined, unit?: 'count' | 'percent') => {
  if (value === null || value === undefined) return '—';
  return `${value.toLocaleString('vi-VN', { maximumFractionDigits: unit === 'percent' ? 1 : 0 })}${unit === 'percent' ? '%' : ''}`;
};

const sourceCell = (value: string | number | null, percent = false) => {
  if (value === null || value === '') return '—';
  return percent ? `${Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 4 })}%` : value;
};

const toChartModel = (
  result: GraduationQueryResult | null,
  fallbackLabel: string,
): GraduationOverviewChartModel => {
  if (!result) return { data: [], series: [{ key: 'value', label: fallbackLabel }] };
  const seriesLabels = [...new Set(result.points.map((point) => point.series).filter(Boolean))] as string[];
  if (seriesLabels.length === 0) {
    return {
      data: result.points.map((point) => ({ name: point.group, value: point.value })),
      series: [{ key: 'value', label: fallbackLabel }],
    };
  }
  const series = seriesLabels.map((label, index) => ({ key: `series${index}`, label }));
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

export function GraduationAnalyticsPage() {
  const [datasets, setDatasets] = useState<GraduationDataset[]>([]);
  const [metadata, setMetadata] = useState<GraduationMetadata | null>(null);
  const [facets, setFacets] = useState<GraduationFacets | null>(null);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(() => {
    const value = Number(queryValue('gaDataset'));
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  });
  const [metricId, setMetricId] = useState(() => queryValue('gaMetric') || 'onTimeRate');
  const [groupBy, setGroupBy] = useState(() => queryValue('gaGroup') || 'faculty');
  const [seriesBy, setSeriesBy] = useState(() => queryValue('gaSeries'));
  const [chartType, setChartType] = useState<GraduationChartType>(initialChartType);
  const [chartSort, setChartSort] = useState<ChartSort>(() => {
    const value = queryValue('gaSort');
    return ['value-desc', 'value-asc', 'label-asc'].includes(value) ? value as ChartSort : 'auto';
  });
  const [topN, setTopN] = useState(initialTopN);
  const [showLabels, setShowLabels] = useState(() => queryValue('gaLabels') === '1');
  const [faculty, setFaculty] = useState(() => queryValue('gaFaculty'));
  const [program, setProgram] = useState(() => queryValue('gaProgram'));
  const [cohort, setCohort] = useState(() => queryValue('gaCohort'));
  const [reviewYear, setReviewYear] = useState(() => queryValue('gaYear'));
  const [result, setResult] = useState<GraduationQueryResult | null>(null);
  const [kpis, setKpis] = useState<Record<string, number | null>>({});
  const [composition, setComposition] = useState<Record<string, number | null>>({});
  const [compositionLoading, setCompositionLoading] = useState(false);
  const [rows, setRows] = useState<GraduationRow[]>([]);
  const [rowTotal, setRowTotal] = useState(0);
  const [rowPage, setRowPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [queryLoading, setQueryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [view, setView] = useState<GraduationView>(() => queryValue('gaView') === 'explore' ? 'explore' : 'overview');
  const [overviewResults, setOverviewResults] = useState<{
    groupedRate: GraduationQueryResult | null;
    trendRate: GraduationQueryResult | null;
    eligible: GraduationQueryResult | null;
    onTime: GraduationQueryResult | null;
  }>({ groupedRate: null, trendRate: null, eligible: null, onTime: null });
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const loadInitial = async (preferredDatasetId?: number) => {
    setLoading(true);
    setError(null);
    try {
      const [nextDatasets, nextMetadata] = await Promise.all([
        graduationAnalyticsApi.datasets(),
        graduationAnalyticsApi.metadata(),
      ]);
      setDatasets(nextDatasets);
      setMetadata(nextMetadata);
      setMetricId((current) => nextMetadata.metrics.some((item) => item.id === current)
        ? current : 'onTimeRate');
      setGroupBy((current) => nextMetadata.dimensions.some((item) => item.id === current && item.id !== 'all')
        ? current : 'faculty');
      setSeriesBy((current) => nextMetadata.dimensions.some((item) => item.id === current && item.id !== 'all')
        ? current : '');
      setSelectedDatasetId((current) => preferredDatasetId
        ?? (current && nextDatasets.some((item) => item.datasetId === current) ? current : nextDatasets[0]?.datasetId ?? null));
    } catch {
      setError('Không tải được module thống kê tốt nghiệp.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadInitial(); }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const setOrDelete = (key: string, value: string | number | null) => {
      if (value === null || value === '' || value === 0) query.delete(key);
      else query.set(key, String(value));
    };
    setOrDelete('gaDataset', selectedDatasetId);
    setOrDelete('gaView', view === 'overview' ? '' : view);
    setOrDelete('gaMetric', metricId === 'onTimeRate' ? '' : metricId);
    setOrDelete('gaGroup', groupBy === 'faculty' ? '' : groupBy);
    setOrDelete('gaSeries', seriesBy);
    setOrDelete('gaChart', chartType === 'bar' ? '' : chartType);
    setOrDelete('gaSort', chartSort === 'auto' ? '' : chartSort);
    setOrDelete('gaTop', topN);
    setOrDelete('gaLabels', showLabels ? '1' : '');
    setOrDelete('gaFaculty', faculty);
    setOrDelete('gaProgram', program);
    setOrDelete('gaCohort', cohort);
    setOrDelete('gaYear', reviewYear);
    const nextUrl = `${window.location.pathname}${query.size ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }, [selectedDatasetId, view, metricId, groupBy, seriesBy, chartType, chartSort, topN, showLabels, faculty, program, cohort, reviewYear]);

  useEffect(() => {
    if (!selectedDatasetId) {
      setFacets(null);
      return;
    }
    let cancelled = false;
    graduationAnalyticsApi.facets(selectedDatasetId)
      .then((nextFacets) => { if (!cancelled) setFacets(nextFacets); })
      .catch(() => { if (!cancelled) toast.error('Không tải được danh mục bộ lọc'); });
    return () => { cancelled = true; };
  }, [selectedDatasetId]);

  useEffect(() => {
    if (!selectedDatasetId) {
      setKpis({});
      return;
    }
    let cancelled = false;
    const filters = {
      faculty: faculty || null,
      program: program || null,
      cohort: cohort || null,
      reviewYear: reviewYear ? Number(reviewYear) : null,
    };
    const base = { datasetIds: [selectedDatasetId], groupBy: 'all', ...filters };
    Promise.all(metricDefaults.map((id) => graduationAnalyticsApi.query({ ...base, metricId: id }))).then((kpiResults) => {
      if (cancelled) return;
      setError(null);
      setKpis(Object.fromEntries(metricDefaults.map((id, index) => [id, kpiResults[index].points[0]?.value ?? null])));
    }).catch(() => {
      if (!cancelled) setError('Không tải được các chỉ số tổng quan. Hãy thử lại.');
    });
    return () => { cancelled = true; };
  }, [selectedDatasetId, faculty, program, cohort, reviewYear]);

  useEffect(() => {
    if (!selectedDatasetId) {
      setResult(null);
      return;
    }
    if (view !== 'explore') return;
    let cancelled = false;
    setQueryLoading(true);
    graduationAnalyticsApi.query({
      datasetIds: [selectedDatasetId],
      metricId,
      groupBy,
      seriesBy: seriesBy || null,
      faculty: faculty || null,
      program: program || null,
      cohort: cohort || null,
      reviewYear: reviewYear ? Number(reviewYear) : null,
    }).then((nextResult) => {
      if (!cancelled) {
        setError(null);
        setResult(nextResult);
      }
    }).catch(() => {
      if (!cancelled) setError('Không tải được dữ liệu biểu đồ. Hãy thử lại.');
    }).finally(() => {
      if (!cancelled) setQueryLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedDatasetId, view, metricId, groupBy, seriesBy, faculty, program, cohort, reviewYear]);

  useEffect(() => {
    if (!selectedDatasetId) {
      setComposition({});
      return;
    }
    if (view !== 'overview') return;
    let cancelled = false;
    setCompositionLoading(true);
    const filters = {
      faculty: faculty || null,
      program: program || null,
      cohort: cohort || null,
      reviewYear: reviewYear ? Number(reviewYear) : null,
    };
    Promise.all(compositionMetrics.map((item) => graduationAnalyticsApi.query({
      datasetIds: [selectedDatasetId], metricId: item.id, groupBy: 'all', ...filters,
    }))).then((responses) => {
      if (cancelled) return;
      setComposition(Object.fromEntries(compositionMetrics.map((item, index) => [
        item.id,
        responses[index].points[0]?.value ?? null,
      ])));
    }).catch(() => {
      if (!cancelled) toast.error('Không tải được cơ cấu kết quả tốt nghiệp');
    }).finally(() => {
      if (!cancelled) setCompositionLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedDatasetId, view, faculty, program, cohort, reviewYear]);

  useEffect(() => {
    if (!selectedDatasetId || view !== 'overview') return;
    let cancelled = false;
    setOverviewLoading(true);
    setOverviewError(null);
    const filters = {
      faculty: faculty || null,
      program: program || null,
      cohort: cohort || null,
      reviewYear: reviewYear ? Number(reviewYear) : null,
    };
    const base = { datasetIds: [selectedDatasetId], ...filters };
    Promise.all([
      graduationAnalyticsApi.query({ ...base, metricId: 'onTimeRate', groupBy: 'faculty', seriesBy: 'reviewYear' }),
      graduationAnalyticsApi.query({ ...base, metricId: 'onTimeRate', groupBy: 'reviewYear', seriesBy: 'faculty' }),
      graduationAnalyticsApi.query({ ...base, metricId: 'eligible', groupBy: 'faculty' }),
      graduationAnalyticsApi.query({ ...base, metricId: 'onTimeCount', groupBy: 'faculty' }),
    ]).then(([groupedRate, trendRate, eligible, onTime]) => {
      if (!cancelled) setOverviewResults({ groupedRate, trendRate, eligible, onTime });
    }).catch(() => {
      if (!cancelled) setOverviewError('Không tải được các biểu đồ tổng quan. Hãy thử lại hoặc chuyển sang Khám phá chi tiết.');
    }).finally(() => {
      if (!cancelled) setOverviewLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedDatasetId, view, faculty, program, cohort, reviewYear]);

  useEffect(() => {
    if (!selectedDatasetId) return;
    let cancelled = false;
    graduationAnalyticsApi.rows(selectedDatasetId, rowPage, 25, search, {
      faculty: faculty || undefined,
      program: program || undefined,
      cohort: cohort || undefined,
      reviewYear: reviewYear ? Number(reviewYear) : undefined,
    })
      .then((page) => {
        if (cancelled) return;
        setRows(page.items);
        setRowTotal(page.totalCount);
      })
      .catch(() => { if (!cancelled) toast.error('Không tải được bảng dữ liệu nguồn'); });
    return () => { cancelled = true; };
  }, [selectedDatasetId, rowPage, search, faculty, program, cohort, reviewYear]);

  const metric = metadata?.metrics.find((item) => item.id === metricId);
  const chartModel = useMemo(
    () => toChartModel(result, metric?.label ?? 'Giá trị'),
    [result, metric?.label],
  );
  const chartData = chartModel.data;
  const displayChartData = useMemo(() => {
    const next = [...chartData];
    const total = (row: Record<string, string | number | null>) => chartModel.series.reduce(
      (sum, item) => sum + (typeof row[item.key] === 'number' ? Number(row[item.key]) : 0), 0,
    );
    const effectiveSort = chartSort === 'auto'
      ? (isTimeDimension(groupBy) ? 'source' : 'value-desc')
      : chartSort;
    if (effectiveSort === 'value-desc') next.sort((a, b) => total(b) - total(a));
    else if (effectiveSort === 'value-asc') next.sort((a, b) => total(a) - total(b));
    else if (effectiveSort === 'label-asc') next.sort((a, b) => String(a.name).localeCompare(String(b.name), 'vi'));
    return topN > 0 ? next.slice(0, topN) : next;
  }, [chartData, chartModel.series, chartSort, groupBy, topN]);
  const overviewGroupedRate = useMemo(
    () => toChartModel(overviewResults.groupedRate, 'Tỷ lệ đúng hạn'),
    [overviewResults.groupedRate],
  );
  const overviewTrendRate = useMemo(
    () => toChartModel(overviewResults.trendRate, 'Tỷ lệ đúng hạn'),
    [overviewResults.trendRate],
  );
  const overviewCompletion = useMemo(() => {
    const eligibleByGroup = new Map(overviewResults.eligible?.points.map((point) => [point.group, point.value]) ?? []);
    const onTimeByGroup = new Map(overviewResults.onTime?.points.map((point) => [point.group, point.value]) ?? []);
    const groups = [...new Set([
      ...(overviewResults.eligible?.points.map((point) => point.group) ?? []),
      ...(overviewResults.onTime?.points.map((point) => point.group) ?? []),
    ])];
    let hasInvalid = false;
    const data = groups.map((name) => {
      const eligible = eligibleByGroup.get(name);
      const onTime = onTimeByGroup.get(name);
      const comparable = typeof eligible === 'number' && typeof onTime === 'number';
      const invalid = comparable && onTime > eligible;
      if (invalid) hasInvalid = true;
      return {
        name,
        onTime: typeof onTime === 'number' ? onTime : null,
        notOnTime: comparable && !invalid ? eligible - onTime : null,
      };
    });
    return {
      model: {
        data,
        series: [
          { key: 'onTime', label: 'Đúng hạn' },
          { key: 'notOnTime', label: 'Chưa đúng hạn' },
        ],
      } satisfies GraduationOverviewChartModel,
      hasInvalid,
    };
  }, [overviewResults.eligible, overviewResults.onTime]);
  const selectedDataset = datasets.find((item) => item.datasetId === selectedDatasetId);
  const rowPageCount = Math.max(1, Math.ceil(rowTotal / 25));
  const compositionTotal = compositionMetrics.reduce(
    (sum, item) => sum + (composition[item.id] ?? 0), 0,
  );
  const availablePrograms = facets?.programs.filter((item) =>
    !faculty || item.facultyName === faculty) ?? [];
  const chartUnavailableReason = useCallback((type: GraduationChartType) =>
    !(metric?.chartTypes.includes(type) ?? false)
      ? 'Chỉ tiêu này không hỗ trợ loại biểu đồ'
      : ['stacked-bar', 'stacked-column'].includes(type) && chartModel.series.length < 2
        ? 'Chọn Phân chuỗi để dùng biểu đồ chồng'
        : ['pie', 'donut'].includes(type) && chartModel.series.length !== 1
          ? 'Biểu đồ tròn chỉ dùng khi không phân chuỗi'
          : ['pie', 'donut'].includes(type) && displayChartData.length > 12
            ? 'Giới hạn tối đa 12 nhóm để biểu đồ dễ đọc'
            : '', [metric?.chartTypes, chartModel.series.length, displayChartData.length]);

  useEffect(() => {
    if (metric && chartUnavailableReason(chartType)) {
      setChartType(chartModel.series.length > 1 ? 'column' : 'bar');
    }
  }, [chartType, chartModel.series.length, chartUnavailableReason, metric]);

  const resetFilters = () => {
    setFaculty('');
    setProgram('');
    setCohort('');
    setReviewYear('');
    setRowPage(1);
  };

  const selectDataset = (datasetId: number) => {
    setSelectedDatasetId(datasetId);
    setSeriesBy('');
    resetFilters();
  };

  const handleImport = async (payload: Parameters<typeof graduationAnalyticsApi.importDataset>[0]) => {
    const imported = await graduationAnalyticsApi.importDataset(payload);
    await loadInitial(imported.dataset.datasetId);
    toast.success(`Đã import ${imported.dataset.rowCount} dòng dữ liệu`);
    return imported.dataset;
  };

  if (loading) return <div className="graduation-page"><div className="graduation-state"><RefreshCw className="spin" /> Đang tải module...</div></div>;

  if (error && !metadata) {
    return (
      <div className="graduation-page">
        <div className="graduation-empty">
          <h2>Không tải được dữ liệu</h2><p>{error}</p>
          <button type="button" className="btn btn-primary" onClick={() => void loadInitial()}>Thử lại</button>
        </div>
      </div>
    );
  }

  if (datasets.length === 0) {
    return (
      <div className="graduation-page">
        <header className="graduation-page__header"><div><span>BÁO CÁO ĐÀO TẠO</span><h1>Thống kê sinh viên tốt nghiệp đúng hạn</h1></div></header>
        <div className="graduation-empty">
          <FileSpreadsheet aria-hidden="true" size={36} />
          <h2>Chưa có bộ dữ liệu tốt nghiệp</h2>
          <p>Import biểu mẫu Excel để xem trước và tạo dashboard từ các chỉ tiêu đã tính sẵn.</p>
          <button type="button" className="btn btn-primary" onClick={() => setImportOpen(true)}><Upload /> Import file Excel</button>
        </div>
        <GraduationImportDialog isOpen={importOpen} onClose={() => setImportOpen(false)} onImport={handleImport} />
      </div>
    );
  }

  return (
    <div className="graduation-page">
      <header className="graduation-page__header">
        <div><span>BÁO CÁO ĐÀO TẠO</span><h1>Thống kê sinh viên tốt nghiệp đúng hạn</h1></div>
        <button type="button" className="btn btn-primary" onClick={() => setImportOpen(true)}><Upload aria-hidden="true" size={17} /> Import file mới</button>
      </header>

      <section className="graduation-context" aria-label="Phạm vi dữ liệu">
        <label>Bộ dữ liệu<select value={selectedDatasetId ?? ''} onChange={(event) => selectDataset(Number(event.target.value))}>
          {datasets.map((item) => <option key={item.datasetId} value={item.datasetId}>{item.datasetName}</option>)}
        </select></label>
        {selectedDataset && <div className="graduation-context__meta"><strong>{selectedDataset.rowCount} dòng</strong><span>{selectedDataset.originalFileName} · {new Date(selectedDataset.importedAtUtc).toLocaleString('vi-VN')}</span></div>}
      </section>

      {error && <div className="graduation-alert" role="alert">{error}</div>}

      <section className="graduation-filters" aria-label="Bộ lọc dashboard">
        <label>Khoa<select value={faculty} onChange={(event) => { setFaculty(event.target.value); setProgram(''); setRowPage(1); }}>
          <option value="">Toàn trường</option>
          {facets?.faculties.map((item) => <option key={item} value={item}>{item}</option>)}
        </select></label>
        <label>Ngành / CTĐT<select value={program} onChange={(event) => { setProgram(event.target.value); setRowPage(1); }}>
          <option value="">Tất cả ngành</option>
          {availablePrograms.map((item) => <option key={`${item.facultyName}-${item.value}-${item.label}`} value={item.value}>{item.label}</option>)}
        </select></label>
        <label>Khóa<select value={cohort} onChange={(event) => { setCohort(event.target.value); setRowPage(1); }}>
          <option value="">Tất cả khóa</option>
          {facets?.cohorts.map((item) => <option key={item} value={item}>{item}</option>)}
        </select></label>
        <label>Năm xét<select value={reviewYear} onChange={(event) => { setReviewYear(event.target.value); setRowPage(1); }}>
          <option value="">Tất cả năm</option>
          {facets?.reviewYears.map((item) => <option key={item} value={item}>{item}</option>)}
        </select></label>
        <button type="button" className="btn btn-secondary btn-sm" onClick={resetFilters} disabled={!faculty && !program && !cohort && !reviewYear}>Xóa lọc</button>
      </section>

      <nav className="graduation-view-switch" aria-label="Chế độ xem dashboard">
        <button type="button" className={view === 'overview' ? 'is-selected' : ''} aria-pressed={view === 'overview'} onClick={() => setView('overview')}>
          Tổng quan
        </button>
        <button type="button" className={view === 'explore' ? 'is-selected' : ''} aria-pressed={view === 'explore'} onClick={() => setView('explore')}>
          Khám phá chi tiết
        </button>
      </nav>

      {view === 'overview' ? <>
      <section className="graduation-kpis" aria-label="Chỉ số tổng quan">
        {[
          ['initialEnrollment', 'Sinh viên nhập học'],
          ['eligible', 'Được xét tốt nghiệp'],
          ['onTimeCount', 'Tốt nghiệp đúng hạn'],
          ['onTimeRate', 'Tỷ lệ đúng hạn'],
        ].map(([id, label]) => <div key={id}><span>{label}</span><strong>{formatValue(kpis[id], id === 'onTimeRate' ? 'percent' : 'count')}</strong><small>Phạm vi bộ dữ liệu đang chọn</small></div>)}
      </section>

      <section className="graduation-composition" aria-label="Cơ cấu kết quả tốt nghiệp">
        <header>
          <div><span>GÓC NHÌN NHANH</span><h2>Cơ cấu kết quả trong phạm vi đang lọc</h2></div>
          <strong>{compositionLoading ? 'Đang cập nhật...' : `${formatValue(compositionTotal, 'count')} sinh viên`}</strong>
        </header>
        {compositionTotal > 0 ? (
          <>
            <div className="graduation-composition__chart" role="img" aria-label="Biểu đồ cơ cấu xếp loại và chuyển VHVL">
              {compositionMetrics.map((item) => {
                const value = composition[item.id] ?? 0;
                if (value <= 0) return null;
                return <span key={item.id} style={{ width: `${(value / compositionTotal) * 100}%`, background: item.color }} title={`${item.label}: ${formatValue(value, 'count')}`} />;
              })}
            </div>
            <div className="graduation-composition__legend">
              {compositionMetrics.map((item) => {
                const value = composition[item.id] ?? 0;
                return <div key={item.id}><i style={{ background: item.color }} /><span>{item.label}</span><strong>{formatValue(value, 'count')}</strong><small>{compositionTotal > 0 ? formatValue((value / compositionTotal) * 100, 'percent') : '—'}</small></div>;
              })}
            </div>
            <p>Các nhóm dùng trực tiếp số lượng nguồn trong Excel; hệ thống chỉ cộng theo phạm vi lọc.</p>
          </>
        ) : <div className="graduation-composition__empty">Không có số liệu cơ cấu trong phạm vi này.</div>}
      </section>

      {overviewError && <div className="graduation-alert" role="alert">{overviewError}</div>}
      <GraduationOverview
        groupedRate={overviewGroupedRate}
        trendRate={overviewTrendRate}
        completion={overviewCompletion.model}
        averageRate={typeof kpis.onTimeRate === 'number' ? kpis.onTimeRate : null}
        loading={overviewLoading}
        hasInvalidCompletion={overviewCompletion.hasInvalid}
      />
      </> : (
      <section className="graduation-workspace">
        <aside className="graduation-builder" aria-label="Tùy chỉnh biểu đồ">
          <h2>Tùy chỉnh biểu đồ</h2>
          <label>Chỉ tiêu<select value={metricId} onChange={(event) => setMetricId(event.target.value)}>
            {metadata?.metrics.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select></label>
          <label>So sánh theo<select value={groupBy} onChange={(event) => {
            const nextGroup = event.target.value;
            setGroupBy(nextGroup);
            if (seriesBy === nextGroup) setSeriesBy('');
          }}>
            {metadata?.dimensions.filter((item) => item.id !== 'all').map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select></label>
          <label>Phân chuỗi<select value={seriesBy} onChange={(event) => setSeriesBy(event.target.value)}>
            <option value="">Không phân chuỗi</option>
            {metadata?.dimensions.filter((item) => item.id !== 'all' && item.id !== groupBy && item.id !== 'dataset').map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select></label>
          <div className="graduation-builder__advanced">
            <label>Sắp xếp<select value={chartSort} onChange={(event) => setChartSort(event.target.value as ChartSort)}>
              <option value="auto">Tự động phù hợp</option>
              <option value="value-desc">Giá trị giảm dần</option>
              <option value="value-asc">Giá trị tăng dần</option>
              <option value="label-asc">Tên A → Z</option>
            </select></label>
            <label>Giới hạn<select value={topN} onChange={(event) => setTopN(Number(event.target.value))}>
              <option value={0}>Tất cả nhóm</option>
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={20}>Top 20</option>
            </select></label>
          </div>
          <label className="graduation-builder__check"><input type="checkbox" checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} /> Hiện nhãn giá trị</label>
          <fieldset><legend>Loại biểu đồ</legend><div className="graduation-chart-types">
            {chartOptions.map((option) => {
              const Icon = option.icon;
              const unavailableReason = chartUnavailableReason(option.id);
              return <button
                key={option.id}
                type="button"
                className={chartType === option.id ? 'is-selected' : ''}
                disabled={Boolean(unavailableReason)}
                title={unavailableReason || option.label}
                onClick={() => setChartType(option.id)}
              ><Icon aria-hidden="true" /><span>{option.label}</span></button>;
            })}
          </div><p className="graduation-chart-types__hint">Apache ECharts · rê chuột vào lựa chọn bị mờ để xem điều kiện.</p></fieldset>
        </aside>

        <div className="graduation-chart-panel">
          <header>
            <div>
              <h2>{metric?.label}</h2>
              <p>So sánh theo {metadata?.dimensions.find((item) => item.id === groupBy)?.label.toLowerCase()}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{queryLoading ? 'Đang cập nhật...' : `${displayChartData.length}${displayChartData.length < chartData.length ? `/${chartData.length}` : ''} nhóm`}</span>
              {displayChartData.length > 0 && (
                <ExportDropdown
                  buttonLabel="Xuất số liệu"
                  size="sm"
                  options={{
                    fileName: `phan-tich-${metricId}-theo-${groupBy}`,
                    metadata: {
                      title: `BÁO CÁO PHÂN TÍCH ${metric?.label?.toUpperCase() || 'TỐT NGHIỆP'} THEO ${metadata?.dimensions.find((item) => item.id === groupBy)?.label.toUpperCase() || 'NHÓM'}`,
                      subtitle: `Bộ dữ liệu tốt nghiệp VMU`,
                      subInstitution: 'PHÒNG ĐÀO TẠO & PHÒNG ĐẢM BẢO CHẤT LƯỢNG',
                    },
                    columns: [
                      { key: 'name', header: 'Nhóm phân tích', width: 28 },
                      ...chartModel.series.map((s) => ({
                        key: s.key,
                        header: s.label,
                        width: 14,
                        type: 'number' as const,
                        align: 'right' as const,
                        format: (val: any) => formatValue(typeof val === 'number' ? Number(val) : null, metric?.unit),
                      })),
                    ],
                    data: displayChartData,
                  }}
                />
              )}
            </div>
          </header>
          {displayChartData.length === 0 ? <div className="graduation-chart-empty">Không có dữ liệu phù hợp với lựa chọn hiện tại.</div> : (
            <div className="graduation-chart" role="img" aria-label={`${metric?.label} theo ${groupBy}`}>
              <GraduationEChart
                type={chartType}
                data={displayChartData}
                series={chartModel.series}
                unit={metric?.unit}
                showLabels={showLabels}
              />
            </div>
          )}
          <footer>Giá trị nguồn được giữ nguyên; điểm có nhiều dòng dùng phép {metric?.aggregation === 'weighted-average' ? 'trung bình có trọng số' : 'cộng'} chỉ để hiển thị biểu đồ.</footer>
          {displayChartData.length > 0 && (
            <details className="graduation-chart-data">
              <summary>Xem bảng số liệu tương ứng</summary>
              <div><table><thead><tr><th>Nhóm</th>{chartModel.series.map((item) => <th key={item.key}>{item.label}</th>)}</tr></thead><tbody>
                {displayChartData.map((row) => <tr key={String(row.name)}><td>{row.name}</td>{chartModel.series.map((item) => <td key={item.key}>{formatValue(typeof row[item.key] === 'number' ? Number(row[item.key]) : null, metric?.unit)}</td>)}</tr>)}
              </tbody></table></div>
            </details>
          )}
        </div>
      </section>
      )}

      <section className="graduation-table-section">
        <header>
          <div>
            <h2>Dữ liệu nguồn C–U</h2>
            <span>{rowTotal} dòng</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input type="search" placeholder="Tìm khoa, mã/tên CTĐT, khóa..." value={search} onChange={(event) => { setSearch(event.target.value); setRowPage(1); }} />
            {rows.length > 0 && (
              <ExportDropdown
                buttonLabel="Xuất dữ liệu C–U"
                size="sm"
                options={{
                  fileName: 'du-lieu-nguon-tot-nghiep-c-u',
                  metadata: {
                    title: 'DỮ LIỆU NGUỒN TỐT NGHIỆP C–U TOÀN TRƯỜNG',
                    subtitle: `Trường Đại học Hàng hải Việt Nam`,
                    subInstitution: 'PHÒNG ĐÀO TẠO & PHÒNG ĐẢM BẢO CHẤT LƯỢNG',
                    info: {
                      'Tổng số dòng': rowTotal,
                      'Khoa': faculty || 'Tất cả',
                      'Khóa': cohort || 'Tất cả',
                      'Năm xét': reviewYear || 'Tất cả',
                    },
                  },
                  columns: [
                    { key: 'sourceRowNumber', header: 'Dòng', width: 8, type: 'number' as const, align: 'center' as const },
                    { key: 'facultyName', header: 'Khoa', width: 22 },
                    { key: 'programCode', header: 'Mã CTĐT', width: 12, align: 'center' as const },
                    { key: 'programName', header: 'Tên CTĐT', width: 26 },
                    { key: 'cohort', header: 'Khóa', width: 10, align: 'center' as const },
                    { key: 'initialEnrollmentCount', header: 'Nhập học', width: 10, type: 'number' as const, align: 'right' as const },
                    { key: 'reviewPeriodText', header: 'Thời điểm', width: 14, align: 'center' as const },
                    { key: 'eligibleGraduateCount', header: 'Được xét', width: 10, type: 'number' as const, align: 'right' as const },
                    { key: 'onTimeGraduateCount', header: 'Đúng hạn', width: 10, type: 'number' as const, align: 'right' as const },
                    { key: 'onTimeGraduateRate', header: 'Tỷ lệ đúng hạn', width: 14, type: 'string' as const, align: 'right' as const, format: (v: any) => (v !== null && v !== undefined ? `${Number(v).toFixed(2)}%` : '—') },
                    { key: 'excellentCount', header: 'XS', width: 8, type: 'number' as const, align: 'right' as const },
                    { key: 'excellentRate', header: '% XS', width: 10, type: 'string' as const, align: 'right' as const, format: (v: any) => (v !== null && v !== undefined ? `${Number(v).toFixed(2)}%` : '—') },
                    { key: 'veryGoodCount', header: 'Giỏi', width: 8, type: 'number' as const, align: 'right' as const },
                    { key: 'veryGoodRate', header: '% Giỏi', width: 10, type: 'string' as const, align: 'right' as const, format: (v: any) => (v !== null && v !== undefined ? `${Number(v).toFixed(2)}%` : '—') },
                    { key: 'goodCount', header: 'Khá', width: 8, type: 'number' as const, align: 'right' as const },
                    { key: 'goodRate', header: '% Khá', width: 10, type: 'string' as const, align: 'right' as const, format: (v: any) => (v !== null && v !== undefined ? `${Number(v).toFixed(2)}%` : '—') },
                    { key: 'averageCount', header: 'T.Bình', width: 8, type: 'number' as const, align: 'right' as const },
                    { key: 'averageRate', header: '% TB', width: 10, type: 'string' as const, align: 'right' as const, format: (v: any) => (v !== null && v !== undefined ? `${Number(v).toFixed(2)}%` : '—') },
                    { key: 'workStudyTransferCount', header: 'VHVL', width: 8, type: 'number' as const, align: 'right' as const },
                    { key: 'workStudyTransferRate', header: '% VHVL', width: 10, type: 'string' as const, align: 'right' as const, format: (v: any) => (v !== null && v !== undefined ? `${Number(v).toFixed(2)}%` : '—') },
                  ],
                  data: rows,
                }}
              />
            )}
          </div>
        </header>
        <div className="graduation-source-table"><table><thead><tr><th>Dòng</th><th>Khoa</th><th>Mã CTĐT</th><th>Tên CTĐT</th><th>Khóa</th><th>Nhập học</th><th>Thời điểm</th><th>Được xét</th><th>Đúng hạn</th><th>Tỷ lệ</th><th>XS</th><th>% XS</th><th>Giỏi</th><th>% Giỏi</th><th>Khá</th><th>% Khá</th><th>T.Bình</th><th>% T.Bình</th><th>VHVL</th><th>% VHVL</th></tr></thead><tbody>
          {rows.map((row) => <tr key={row.rowId}><td>{row.sourceRowNumber}</td><td>{row.facultyName}</td><td>{sourceCell(row.programCode)}</td><td>{row.programName}</td><td>{row.cohort}</td><td>{sourceCell(row.initialEnrollmentCount)}</td><td>{row.reviewPeriodText}</td><td>{sourceCell(row.eligibleGraduateCount)}</td><td>{sourceCell(row.onTimeGraduateCount)}</td><td>{sourceCell(row.onTimeGraduateRate, true)}</td><td>{sourceCell(row.excellentCount)}</td><td>{sourceCell(row.excellentRate, true)}</td><td>{sourceCell(row.veryGoodCount)}</td><td>{sourceCell(row.veryGoodRate, true)}</td><td>{sourceCell(row.goodCount)}</td><td>{sourceCell(row.goodRate, true)}</td><td>{sourceCell(row.averageCount)}</td><td>{sourceCell(row.averageRate, true)}</td><td>{sourceCell(row.workStudyTransferCount)}</td><td>{sourceCell(row.workStudyTransferRate, true)}</td></tr>)}
        </tbody></table></div>
        <footer><span>Trang {rowPage}/{rowPageCount}</span><div><button type="button" className="btn btn-secondary btn-sm" disabled={rowPage === 1} onClick={() => setRowPage((page) => page - 1)}>Trước</button><button type="button" className="btn btn-secondary btn-sm" disabled={rowPage >= rowPageCount} onClick={() => setRowPage((page) => page + 1)}>Sau</button></div></footer>
      </section>

      <GraduationImportDialog isOpen={importOpen} onClose={() => setImportOpen(false)} onImport={handleImport} />
    </div>
  );
}
