import React from 'react';
import { wrapFacultyName } from './facultyChartLabels';

interface FacultyNameAxisTickProps {
  x?: number;
  y?: number;
  payload?: { value?: string };
}

/** Nhãn nhiều dòng để tên Khoa/Viện luôn hiển thị đầy đủ trong biểu đồ ngang. */
export const FacultyNameAxisTick: React.FC<FacultyNameAxisTickProps> = ({
  x = 0,
  y = 0,
  payload,
}) => {
  const name = String(payload?.value ?? '');
  const lines = wrapFacultyName(name);
  const firstLineOffset = -((lines.length - 1) * 7);

  return (
    <g transform={`translate(${x - 8},${y})`}>
      <title>{name}</title>
      <text textAnchor="end" fill="#20262c" fontSize={11}>
        {lines.map((line, index) => (
          <tspan key={`${line}-${index}`} x={0} dy={index === 0 ? firstLineOffset : 14}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
};
