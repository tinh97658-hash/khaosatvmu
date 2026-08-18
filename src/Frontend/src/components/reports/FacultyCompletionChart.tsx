import React from 'react';
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
  const data = [...faculties]
    .sort((a, b) => a.completionRate - b.completionRate)
    .map((f) => ({ ...f, name: f.facultyName }));

  if (data.length === 0) {
    return <div className="reports-chart-empty">Chưa có dữ liệu Khoa để theo dõi tiến độ.</div>;
  }

  return (
    <div className="reports-chart" aria-label="Tỷ lệ hoàn thành thu phiếu theo Khoa">
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 36 + 60)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 48, left: 12, bottom: 8 }}
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
            width={150}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: '#20262c' }}
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
            {data.map((entry) => (
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
    </div>
  );
};
