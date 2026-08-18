import React from 'react';
import { Building2, Star } from 'lucide-react';
import type { DepartmentOverview } from '../../types';
import { completionColor, scoreColor } from './theme';

interface LaggingDepartmentsTableProps {
  departments: DepartmentOverview[];
  onSelect?: (departmentId: number) => void;
  limit?: number;
}

/** Bảng các Bộ môn có tiến độ thu phiếu thấp nhất (sắp tăng dần theo % hoàn thành). */
export const LaggingDepartmentsTable: React.FC<LaggingDepartmentsTableProps> = ({
  departments,
  onSelect,
  limit = 6,
}) => {
  const lagging = [...departments]
    .sort((a, b) => a.completionRate - b.completionRate)
    .slice(0, limit);

  if (lagging.length === 0) {
    return (
      <div className="reports-chart-empty">
        Không có Bộ môn nào trong danh sách để theo dõi.
      </div>
    );
  }

  return (
    <div className="reports-lagging">
      <table className="campaign-table reports-lagging-table">
        <thead>
          <tr>
            <th>Bộ môn</th>
            <th>Thuộc Khoa</th>
            <th className="reports-lagging-num">Lớp</th>
            <th className="reports-lagging-progress-col">Tiến độ</th>
            <th className="reports-lagging-num">Điểm TB</th>
          </tr>
        </thead>
        <tbody>
          {lagging.map((dept) => (
            <tr
              key={dept.departmentId}
              onClick={onSelect ? () => onSelect(dept.departmentId) : undefined}
              className={onSelect ? 'reports-lagging-row is-clickable' : 'reports-lagging-row'}
              title={onSelect ? 'Click để lọc chi tiết theo Bộ môn này' : undefined}
            >
              <td>
                <span className="catalog-cell-primary">{dept.departmentName}</span>
                <span className="catalog-secondary-value">{dept.sectionCount} lớp khảo sát</span>
              </td>
              <td>
                <span className="reports-lagging-faculty">
                  <Building2 className="operation-icon" aria-hidden="true" />
                  {dept.facultyName}
                </span>
              </td>
              <td className="report-number-cell">{dept.sectionCount}</td>
              <td className="reports-lagging-progress">
                <div className="reports-progress">
                  <span
                    style={{
                      width: `${Math.min(100, dept.completionRate)}%`,
                      background: completionColor(dept.completionRate),
                    }}
                  />
                </div>
                <span style={{ color: completionColor(dept.completionRate), fontWeight: 700 }}>
                  {dept.completionRate.toFixed(0)}%
                </span>
              </td>
              <td className="report-number-cell" style={{ color: scoreColor(dept.averageScore) }}>
                <span className="catalog-score">
                  <Star style={{ width: 12, height: 12, fill: 'currentColor' }} aria-hidden="true" />
                  {dept.averageScore > 0 ? dept.averageScore.toFixed(2) : '—'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
