import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart as AreaChartIcon,
  BarChart3,
  ChartColumn,
  FileSpreadsheet,
  LineChart as LineChartIcon,
  RefreshCw,
  Upload,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { GraduationImportDialog } from '../components/graduation/GraduationImportDialog';
import { graduationAnalyticsApi } from '../services/graduationAnalyticsApi';
import type {
  GraduationChartType,
  GraduationDataset,
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
  { id: 'line', label: 'Đường', icon: LineChartIcon },
  { id: 'area', label: 'Miền', icon: AreaChartIcon },
];

const metricDefaults = ['initialEnrollment', 'eligible', 'onTimeCount', 'onTimeRate'];

const formatValue = (value: number | null | undefined, unit?: 'count' | 'percent') => {
  if (value === null || value === undefined) return '—';
  return `${value.toLocaleString('vi-VN', { maximumFractionDigits: unit === 'percent' ? 1 : 0 })}${unit === 'percent' ? '%' : ''}`;
};

const sourceCell = (value: string | number | null, percent = false) => {
  if (value === null || value === '') return '—';
  return percent ? `${Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 4 })}%` : value;
};

export function GraduationAnalyticsPage() {
  const [datasets, setDatasets] = useState<GraduationDataset[]>([]);
  const [metadata, setMetadata] = useState<GraduationMetadata | null>(null);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);
  const [metricId, setMetricId] = useState('onTimeRate');
  const [groupBy, setGroupBy] = useState('faculty');
  const [chartType, setChartType] = useState<GraduationChartType>('bar');
  const [result, setResult] = useState<GraduationQueryResult | null>(null);
  const [kpis, setKpis] = useState<Record<string, number | null>>({});
  const [rows, setRows] = useState<GraduationRow[]>([]);
  const [rowTotal, setRowTotal] = useState(0);
  const [rowPage, setRowPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [queryLoading, setQueryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

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
    if (!selectedDatasetId) {
      setResult(null);
      setKpis({});
      return;
    }
    let cancelled = false;
    setQueryLoading(true);
    const base = { datasetIds: [selectedDatasetId], groupBy: 'all' };
    Promise.all([
      graduationAnalyticsApi.query({ datasetIds: [selectedDatasetId], metricId, groupBy }),
      ...metricDefaults.map((id) => graduationAnalyticsApi.query({ ...base, metricId: id })),
    ]).then(([nextResult, ...kpiResults]) => {
      if (cancelled) return;
      setError(null);
      setResult(nextResult);
      setKpis(Object.fromEntries(metricDefaults.map((id, index) => [id, kpiResults[index].points[0]?.value ?? null])));
    }).catch(() => {
      if (!cancelled) setError('Không tải được dữ liệu biểu đồ. Hãy thử lại.');
    }).finally(() => {
      if (!cancelled) setQueryLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedDatasetId, metricId, groupBy]);

  useEffect(() => {
    if (!selectedDatasetId) return;
    let cancelled = false;
    graduationAnalyticsApi.rows(selectedDatasetId, rowPage, 25, search)
      .then((page) => {
        if (cancelled) return;
        setRows(page.items);
        setRowTotal(page.totalCount);
      })
      .catch(() => { if (!cancelled) toast.error('Không tải được bảng dữ liệu nguồn'); });
    return () => { cancelled = true; };
  }, [selectedDatasetId, rowPage, search]);

  const metric = metadata?.metrics.find((item) => item.id === metricId);
  const chartData = useMemo(() => result?.points.map((point) => ({
    name: point.group,
    value: point.value,
    coverage: `${point.includedRows}/${point.totalRows}`,
    aggregation: point.aggregation,
  })) ?? [], [result]);
  const selectedDataset = datasets.find((item) => item.datasetId === selectedDatasetId);
  const rowPageCount = Math.max(1, Math.ceil(rowTotal / 25));

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
        <label>Bộ dữ liệu<select value={selectedDatasetId ?? ''} onChange={(event) => { setSelectedDatasetId(Number(event.target.value)); setRowPage(1); }}>
          {datasets.map((item) => <option key={item.datasetId} value={item.datasetId}>{item.datasetName}</option>)}
        </select></label>
        {selectedDataset && <div className="graduation-context__meta"><strong>{selectedDataset.rowCount} dòng</strong><span>{selectedDataset.originalFileName} · {new Date(selectedDataset.importedAtUtc).toLocaleString('vi-VN')}</span></div>}
      </section>

      {error && <div className="graduation-alert" role="alert">{error}</div>}

      <section className="graduation-kpis" aria-label="Chỉ số tổng quan">
        {[
          ['initialEnrollment', 'Sinh viên nhập học'],
          ['eligible', 'Được xét tốt nghiệp'],
          ['onTimeCount', 'Tốt nghiệp đúng hạn'],
          ['onTimeRate', 'Tỷ lệ đúng hạn'],
        ].map(([id, label]) => <div key={id}><span>{label}</span><strong>{formatValue(kpis[id], id === 'onTimeRate' ? 'percent' : 'count')}</strong><small>Phạm vi bộ dữ liệu đang chọn</small></div>)}
      </section>

      <section className="graduation-workspace">
        <aside className="graduation-builder" aria-label="Tùy chỉnh biểu đồ">
          <h2>Tùy chỉnh biểu đồ</h2>
          <label>Chỉ tiêu<select value={metricId} onChange={(event) => setMetricId(event.target.value)}>
            {metadata?.metrics.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select></label>
          <label>So sánh theo<select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}>
            {metadata?.dimensions.filter((item) => item.id !== 'all').map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select></label>
          <fieldset><legend>Loại biểu đồ</legend><div className="graduation-chart-types">
            {chartOptions.map((option) => {
              const Icon = option.icon;
              const compatible = metric?.chartTypes.includes(option.id) ?? false;
              return <button key={option.id} type="button" className={chartType === option.id ? 'is-selected' : ''} disabled={!compatible} onClick={() => setChartType(option.id)}><Icon aria-hidden="true" /><span>{option.label}</span></button>;
            })}
          </div></fieldset>
        </aside>

        <div className="graduation-chart-panel">
          <header><div><h2>{metric?.label}</h2><p>So sánh theo {metadata?.dimensions.find((item) => item.id === groupBy)?.label.toLowerCase()}</p></div><span>{queryLoading ? 'Đang cập nhật...' : `${chartData.length} nhóm`}</span></header>
          {chartData.length === 0 ? <div className="graduation-chart-empty">Không có dữ liệu phù hợp với lựa chọn hiện tại.</div> : (
            <div className="graduation-chart" role="img" aria-label={`${metric?.label} theo ${groupBy}`}>
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'bar' ? (
                  <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 28 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" domain={metric?.unit === 'percent' ? [0, 100] : ['auto', 'auto']} /><YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} /><Tooltip formatter={(value) => formatValue(Number(value), metric?.unit)} /><Bar dataKey="value" fill="#0788B8" radius={[0, 2, 2, 0]} /></BarChart>
                ) : chartType === 'column' ? (
                  <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={chartData.length > 6 ? -25 : 0} textAnchor={chartData.length > 6 ? 'end' : 'middle'} height={chartData.length > 6 ? 76 : 42} /><YAxis domain={metric?.unit === 'percent' ? [0, 100] : ['auto', 'auto']} /><Tooltip formatter={(value) => formatValue(Number(value), metric?.unit)} /><Bar dataKey="value" fill="#0788B8" radius={[2, 2, 0, 0]} /></BarChart>
                ) : chartType === 'line' ? (
                  <LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis domain={metric?.unit === 'percent' ? [0, 100] : ['auto', 'auto']} /><Tooltip formatter={(value) => formatValue(Number(value), metric?.unit)} /><Line type="monotone" dataKey="value" stroke="#0788B8" strokeWidth={2} dot={{ r: 3 }} /></LineChart>
                ) : (
                  <AreaChart data={chartData}><defs><linearGradient id="graduationArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0788B8" stopOpacity={0.25} /><stop offset="95%" stopColor="#0788B8" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis domain={metric?.unit === 'percent' ? [0, 100] : ['auto', 'auto']} /><Tooltip formatter={(value) => formatValue(Number(value), metric?.unit)} /><Area type="monotone" dataKey="value" stroke="#0788B8" fill="url(#graduationArea)" /></AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
          <footer>Giá trị nguồn được giữ nguyên; điểm có nhiều dòng dùng phép {metric?.aggregation === 'weighted-average' ? 'trung bình có trọng số' : 'cộng'} chỉ để hiển thị biểu đồ.</footer>
        </div>
      </section>

      <section className="graduation-table-section">
        <header><div><h2>Dữ liệu nguồn C–U</h2><span>{rowTotal} dòng</span></div><input type="search" placeholder="Tìm khoa, mã/tên CTĐT, khóa..." value={search} onChange={(event) => { setSearch(event.target.value); setRowPage(1); }} /></header>
        <div className="graduation-source-table"><table><thead><tr><th>Dòng</th><th>Khoa</th><th>Mã CTĐT</th><th>Tên CTĐT</th><th>Khóa</th><th>Nhập học</th><th>Thời điểm</th><th>Được xét</th><th>Đúng hạn</th><th>Tỷ lệ</th><th>XS</th><th>% XS</th><th>Giỏi</th><th>% Giỏi</th><th>Khá</th><th>% Khá</th><th>T.Bình</th><th>% T.Bình</th><th>VHVL</th><th>% VHVL</th></tr></thead><tbody>
          {rows.map((row) => <tr key={row.rowId}><td>{row.sourceRowNumber}</td><td>{row.facultyName}</td><td>{sourceCell(row.programCode)}</td><td>{row.programName}</td><td>{row.cohort}</td><td>{sourceCell(row.initialEnrollmentCount)}</td><td>{row.reviewPeriodText}</td><td>{sourceCell(row.eligibleGraduateCount)}</td><td>{sourceCell(row.onTimeGraduateCount)}</td><td>{sourceCell(row.onTimeGraduateRate, true)}</td><td>{sourceCell(row.excellentCount)}</td><td>{sourceCell(row.excellentRate, true)}</td><td>{sourceCell(row.veryGoodCount)}</td><td>{sourceCell(row.veryGoodRate, true)}</td><td>{sourceCell(row.goodCount)}</td><td>{sourceCell(row.goodRate, true)}</td><td>{sourceCell(row.averageCount)}</td><td>{sourceCell(row.averageRate, true)}</td><td>{sourceCell(row.workStudyTransferCount)}</td><td>{sourceCell(row.workStudyTransferRate, true)}</td></tr>)}
        </tbody></table></div>
        <footer><span>Trang {rowPage}/{rowPageCount}</span><div><button type="button" className="btn btn-secondary btn-sm" disabled={rowPage === 1} onClick={() => setRowPage((page) => page - 1)}>Trước</button><button type="button" className="btn btn-secondary btn-sm" disabled={rowPage >= rowPageCount} onClick={() => setRowPage((page) => page + 1)}>Sau</button></div></footer>
      </section>

      <GraduationImportDialog isOpen={importOpen} onClose={() => setImportOpen(false)} onImport={handleImport} />
    </div>
  );
}
