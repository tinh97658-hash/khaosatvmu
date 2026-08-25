import { LoaderCircle } from 'lucide-react';
import { GraduationEChart } from './GraduationEChart';

export interface GraduationOverviewChartModel {
  data: Array<Record<string, string | number | null>>;
  series: Array<{ key: string; label: string }>;
}

interface GraduationOverviewProps {
  groupedRate: GraduationOverviewChartModel;
  trendRate: GraduationOverviewChartModel;
  completion: GraduationOverviewChartModel;
  averageRate: number | null;
  loading: boolean;
  hasInvalidCompletion: boolean;
}

const formatValue = (value: string | number | null, unit: 'count' | 'percent') => {
  if (typeof value !== 'number') return '—';
  return `${value.toLocaleString('vi-VN', { maximumFractionDigits: unit === 'percent' ? 1 : 0 })}${unit === 'percent' ? '%' : ''}`;
};

function ChartDataTable({ model, unit }: { model: GraduationOverviewChartModel; unit: 'count' | 'percent' }) {
  return (
    <details className="graduation-chart-data graduation-overview-data">
      <summary>Xem bảng số liệu tương ứng</summary>
      <div><table><thead><tr><th>Nhóm</th>{model.series.map((item) => <th key={item.key}>{item.label}</th>)}</tr></thead><tbody>
        {model.data.map((row) => <tr key={String(row.name)}><td>{row.name}</td>{model.series.map((item) => (
          <td key={item.key}>{formatValue(row[item.key] ?? null, unit)}</td>
        ))}</tr>)}
      </tbody></table></div>
    </details>
  );
}

function EmptyChart() {
  return <div className="graduation-overview-empty">Không có dữ liệu phù hợp với phạm vi đang lọc.</div>;
}

export function GraduationOverview({
  groupedRate,
  trendRate,
  completion,
  averageRate,
  loading,
  hasInvalidCompletion,
}: GraduationOverviewProps) {
  return (
    <section className="graduation-overview" aria-label="Dashboard tổng quan tốt nghiệp đúng hạn" aria-busy={loading}>
      <header className="graduation-overview__heading">
        <div><span>TỔNG QUAN PHÂN TÍCH</span><h2>Tốt nghiệp đúng hạn theo đơn vị và thời gian</h2></div>
        {loading && <span><LoaderCircle className="spin" aria-hidden="true" /> Đang cập nhật...</span>}
      </header>

      <article className="graduation-overview-card graduation-overview-card--wide">
        <header><div><h3>Tỷ lệ đúng hạn theo khoa qua các năm</h3><p>So sánh đồng thời các năm; đường đỏ là trung bình trong phạm vi đang lọc.</p></div></header>
        {groupedRate.data.length ? <>
          <div className="graduation-overview-chart graduation-overview-chart--wide">
            <GraduationEChart
              type="column"
              data={groupedRate.data}
              series={groupedRate.series}
              unit="percent"
              showLabels={false}
              referenceLine={averageRate === null ? undefined : {
                value: averageRate,
                label: `Trung bình: ${formatValue(averageRate, 'percent')}`,
              }}
            />
          </div>
          <ChartDataTable model={groupedRate} unit="percent" />
        </> : <EmptyChart />}
      </article>

      <div className="graduation-overview__grid">
        <article className="graduation-overview-card">
          <header><div><h3>Xu hướng tỷ lệ đúng hạn</h3><p>Mỗi đường là một khoa; có thể bật/tắt từng khoa trên chú giải.</p></div></header>
          {trendRate.data.length ? <>
            <div className="graduation-overview-chart">
              <GraduationEChart type="line" data={trendRate.data} series={trendRate.series} unit="percent" showLabels={false} />
            </div>
            <ChartDataTable model={trendRate} unit="percent" />
          </> : <EmptyChart />}
        </article>

        <article className="graduation-overview-card">
          <header><div><h3>Quy mô đúng hạn và chưa đúng hạn</h3><p>“Chưa đúng hạn” được biểu diễn bằng số được xét trừ số tốt nghiệp đúng hạn.</p></div></header>
          {completion.data.length ? <>
            <div className="graduation-overview-chart">
              <GraduationEChart
                type="stacked-bar"
                data={completion.data}
                series={completion.series}
                unit="count"
                showLabels={false}
                colors={['#1fa98b', '#c8d7d8']}
              />
            </div>
            {hasInvalidCompletion && <p className="graduation-overview-warning">Có nhóm có số đúng hạn lớn hơn số được xét; phần “Chưa đúng hạn” của nhóm đó được để trống để không làm sai dữ liệu nguồn.</p>}
            <ChartDataTable model={completion} unit="count" />
          </> : <EmptyChart />}
        </article>
      </div>
    </section>
  );
}
