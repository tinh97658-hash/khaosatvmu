import React from 'react';
import { formatNumber } from './theme';

interface CompletionGaugeProps {
  /** 0..100 */
  value: number;
  /** Số phiếu đã thu, hiển thị ở giữa vòng tròn. */
  collected: number;
  /** Số phiếu chỉ tiêu. */
  target: number;
  size?: number;
}

/**
 * Vòng tròn tiến độ thu phiếu (SVG) — hiển thị % hoàn thành toàn trường.
 * Màu theo ngưỡng: ≥80% xanh lá, ≥40% xanh dương, còn lại cam.
 */
export const CompletionGauge: React.FC<CompletionGaugeProps> = ({
  value,
  collected,
  target,
  size = 132,
}) => {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, value));
  const offset = circumference - (clamped / 100) * circumference;
  const color = completionColor(clamped);

  return (
    <div className="reports-gauge" style={{ width: size, height: size }} role="img" aria-label={`Tỷ lệ hoàn thành ${clamped.toFixed(0)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#eef1f4"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="reports-gauge-center">
        <strong style={{ color }}>{clamped.toFixed(0)}%</strong>
        <span>hoàn thành</span>
        <small className="reports-gauge-sub">
          {formatNumber(collected)} / {formatNumber(target)}
        </small>
      </div>
    </div>
  );
};

function completionColor(rate: number): string {
  return rate >= 80 ? '#137b3b' : rate >= 40 ? '#0788b8' : '#b86216';
}
