import React from 'react';
import {
  BookOpen,
  Building2,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  QrCode,
  RadioTower,
  Star,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  subtitle?: string;
  trend?: string;
}

const statIcons: Record<string, LucideIcon> = {
  building: Building2,
  graduation: GraduationCap,
  course: BookOpen,
  classes: UsersRound,
  campaign: RadioTower,
  responses: ClipboardCheck,
  satisfaction: Star,
  qr: QrCode,
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  subtitle,
  trend,
}) => {
  const Icon = statIcons[icon] ?? LayoutDashboard;

  return (
    <article className="dashboard-stat-card">
      <div className="dashboard-stat-icon" aria-hidden="true">
        <Icon />
      </div>
      <div className="dashboard-stat-content">
        <span className="dashboard-stat-label">{title}</span>
        <strong className="dashboard-stat-value">{value}</strong>
        {(subtitle || trend) && (
          <span className="dashboard-stat-meta">
            {subtitle}
            {trend && <strong>{trend}</strong>}
          </span>
        )}
      </div>
    </article>
  );
};
