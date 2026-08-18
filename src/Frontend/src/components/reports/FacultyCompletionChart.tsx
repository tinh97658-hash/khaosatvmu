import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Timer } from 'lucide-react';
import type { FacultyOverview } from '../../types';
import { completionColor } from './theme';
import { FacultyNameAxisTick } from './FacultyNameAxisTick';
import { wrapFacultyName } from './facultyChartLabels';
import { ChartPagination } from './ChartPagination';

const PAGE_SIZE = 10;

interface FacultyCompletionChartProps {
  faculties: FacultyOverview[];
  onSelect?: (facultyId: number) => void;
}

interface TooltipPayloadItem {
  payload: FacultyOverview;
}

const CompletionTooltip: React.FC<{ active?: boolean; payload?: TooltipPayloadItem[] }> = ({
  active,
  payload,
}) => {
  if (!active || !payload || !payload.length) return null;
  const f = payload[0].payload;
  return (
    <div className="reports-chart-tooltip">
      <strong>{f.facultyName}</strong>
      <span style={{ color: completionColor(f.completionRate) }}>
        {f.completionRate.toFixed(1)}% hoàn thành
      </span>
      <span>
        {f.responseCount.toLocaleString('vi-VN')} / {f.targetResponses.toLocaleString('vi-VN')} phiếu
      </span>
    </div>
  );
};

/** Biểu đồ cột ngang: tỷ lệ hoàn thành thu phiếu theo Khoa (màu theo ngưỡng). */
export const FacultyCompletionChart: React.FC<FacultyCompletionChartProps> = ({
  faculties,
  onSelect,
}) => {
  const [page, setPage] = useState(1);
  const data = useMemo(
    () => [...faculties]
      .sort((a, b) => a.completionRate - b.completionRate)
      .map((f) => ({ ...f, name: f.facultyName })),
    [faculties],
  );
  const pageCount = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const pageData = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const chartHeight = Math.max(
    250,
    pageData.reduce(
      (height, item) => height + 40 + (wrapFacultyName(item.name).length - 1) * 14,
      70,
    ),
  );

  if (data.length === 0) {
    return <div className="reports-chart-empty">Chưa có dữ liệu Khoa để theo dõi tiến độ.</div>;
  }

  return (
    <div className="reports-chart" aria-label="Tỷ lệ hoàn thành thu phiếu theo Khoa">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={pageData}
          layout="vertical"
          margin={{ top: 12, right: 56, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f6" />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(value: number) => `${value}%`}
            tickLine={false}
            axisLine={{ stroke: '#cbd5e1' }}
            tick={{ fontSize: 11, fill: '#68737d' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={190}
            tickLine={false}
            axisLine={false}
            tick={<FacultyNameAxisTick />}
          />
          <Tooltip content={<CompletionTooltip />} cursor={{ fill: 'rgba(7,136,184,0.06)' }} />
          <Bar
            dataKey="completionRate"
            radius={[0, 3, 3, 0]}
            isAnimationActive={false}
            onClick={(entry: unknown) => {
              const item = entry as { payload?: FacultyOverview };
              if (item?.payload && onSelect) onSelect(item.payload.facultyId);
            }}
            cursor={onSelect ? 'pointer' : 'default'}
          >
            {pageData.map((entry) => (
              <Cell key={entry.facultyId} fill={completionColor(entry.completionRate)} />
            ))}
            <LabelList
              dataKey="completionRate"
              position="right"
              formatter={(label) => `${Math.round(Number(label) || 0)}%`}
              style={{ fontSize: 11, fill: '#68737d', fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="reports-chart-note">
        <Timer className="operation-icon" aria-hidden="true" />
        <span>≥80% hoàn thành · 40–80% đang thu · &lt;40% chậm tiến độ.</span>
      </div>
      <ChartPagination
        page={page}
        pageCount={pageCount}
        pageSize={PAGE_SIZE}
        totalItems={data.length}
        itemLabel="Khoa/Viện"
        onPageChange={setPage}
      />
    </div>
  );
};
