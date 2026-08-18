import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Building2 } from 'lucide-react';
import type { FacultyOverview } from '../../types';
import { scoreColor } from './theme';

interface FacultyScoreChartProps {
  faculties: FacultyOverview[];
  /** Điểm TB toàn trường dùng làm đường tham chiếu. */
  schoolAverage: number;
  onSelect?: (facultyId: number) => void;
}

interface TooltipPayloadItem {
  payload: FacultyOverview;
}

const ScoreTooltip: React.FC<{ active?: boolean; payload?: TooltipPayloadItem[] }> = ({
  active,
  payload,
}) => {
  if (!active || !payload || !payload.length) return null;
  const f = payload[0].payload;
  return (
    <div className="reports-chart-tooltip">
      <strong>{f.facultyName}</strong>
      <span style={{ color: scoreColor(f.averageScore) }}>
        Điểm TB: {f.averageScore > 0 ? f.averageScore.toFixed(2) : '—'} / 5.0
      </span>
      <span>{f.responseCount.toLocaleString('vi-VN')} phiếu · {f.sectionCount} lớp</span>
    </div>
  );
};

/** Biểu đồ cột ngang: điểm trung bình theo Khoa, kèm đường tham chiếu điểm TB toàn trường. */
export const FacultyScoreChart: React.FC<FacultyScoreChartProps> = ({
  faculties,
  schoolAverage,
  onSelect,
}) => {
  const data = [...faculties]
    .sort((a, b) => a.averageScore - b.averageScore)
    .map((f) => ({ ...f, name: f.facultyName }));

  if (data.length === 0) {
    return (
      <div className="reports-chart-empty">Chưa có dữ liệu Khoa để xếp hạng.</div>
    );
  }

  return (
    <div className="reports-chart" aria-label="Điểm trung bình theo Khoa">
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 36 + 60)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 40, left: 12, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f6" />
          <XAxis
            type="number"
            domain={[0, 5]}
            ticks={[0, 1, 2, 3, 4, 5]}
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
          <Tooltip content={<ScoreTooltip />} cursor={{ fill: 'rgba(7,136,184,0.06)' }} />
          {schoolAverage > 0 && (
            <ReferenceLine
              x={schoolAverage}
              stroke="#68737d"
              strokeDasharray="4 4"
              label={{
                value: `Toàn trường ${schoolAverage.toFixed(2)}`,
                position: 'top',
                fill: '#68737d',
                fontSize: 11,
              }}
            />
          )}
          <Bar
            dataKey="averageScore"
            radius={[0, 3, 3, 0]}
            isAnimationActive={false}
            onClick={(entry: unknown) => {
              const item = entry as { payload?: FacultyOverview };
              if (item?.payload && onSelect) onSelect(item.payload.facultyId);
            }}
            cursor={onSelect ? 'pointer' : 'default'}
          >
            {data.map((entry) => (
              <Cell
                key={entry.facultyId}
                fill={scoreColor(entry.averageScore)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="reports-chart-note">
        <Building2 className="operation-icon" aria-hidden="true" />
        <span>Click vào cột để lọc chi tiết theo Khoa.</span>
      </div>
    </div>
  );
};
