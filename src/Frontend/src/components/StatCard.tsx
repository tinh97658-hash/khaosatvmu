import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  subtitle?: string;
  trend?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  subtitle,
  trend,
}) => {
  return (
    <div className="stat-card">
      <div className="stat-icon-wrapper">{icon}</div>
      <div className="stat-info">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{title}</span>
        {subtitle && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {subtitle} {trend && <strong style={{ color: '#059669' }}>({trend})</strong>}
          </span>
        )}
      </div>
    </div>
  );
};
