import React from 'react';
import {
  ArrowRight,
  ChartColumn,
  LayoutDashboard,
  School,
  Sigma,
  type LucideIcon,
} from 'lucide-react';
import { canAccessModule } from '../auth/modulePermissions';
import '../styles/dashboard.css';

interface DashboardOverviewProps {
  onNavigateTab: (tab: string) => void;
  permissions: readonly string[];
}

interface HeroLink {
  tab: string;
  title: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  tone: 'blue' | 'teal' | 'green' | 'amber';
}

/**
 * Bốn lối vào chính của hệ thống. Cố ý không dẫn vào các trang danh mục: danh
 * mục là dữ liệu nền, đã có sẵn ở thanh bên, không phải việc người dùng mở ra
 * hằng ngày.
 */
const heroLinks: HeroLink[] = [
  {
    tab: 'survey-dashboard',
    title: 'Tổng quan khảo sát',
    subtitle: 'BÁO CÁO TOÀN TRƯỜNG',
    description: 'Chỉ số chính, tiêu chí yếu nhất và điểm theo khoa/viện của một đợt khảo sát',
    icon: LayoutDashboard,
    tone: 'blue',
  },
  {
    tab: 'progress',
    title: 'Tiến độ thu phiếu',
    subtitle: 'VẬN HÀNH KHẢO SÁT',
    description: 'Theo dõi số phiếu đã thu và tỷ lệ phản hồi của từng lớp',
    icon: ChartColumn,
    tone: 'teal',
  },
  {
    tab: 'survey-analysis',
    title: 'Phân tích chuyên sâu',
    subtitle: 'CHUẨN HOÁ VÀ CHẨN ĐOÁN',
    description: 'Chuẩn hoá điểm, tổng hợp bộ môn, chẩn đoán học phần và báo cáo giảng viên',
    icon: Sigma,
    tone: 'green',
  },
  {
    tab: 'classes',
    title: 'Lớp học phần',
    subtitle: 'DỮ LIỆU KHẢO SÁT',
    description: 'Nhập danh sách lớp và giảng viên phụ trách cho đợt khảo sát',
    icon: School,
    tone: 'amber',
  },
];

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  onNavigateTab,
  permissions,
}) => {
  const visibleLinks = heroLinks.filter((link) => canAccessModule(permissions, link.tab));

  return (
    <div className="dashboard-overview">
      {visibleLinks.length === 0 ? (
        <div className="dashboard-hero-empty">
          <strong>Tài khoản của bạn chưa được cấp quyền vào chức năng nào.</strong>
          <span>Liên hệ quản trị hệ thống để được cấp quyền.</span>
        </div>
      ) : (
        <div className="dashboard-hero-grid">
          {visibleLinks.map((link) => {
            const Icon = link.icon;
            return (
              <button
                type="button"
                key={link.tab}
                className={`dashboard-hero-card is-${link.tone}`}
                onClick={() => onNavigateTab(link.tab)}
              >
                <span className="dashboard-hero-icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="dashboard-hero-copy">
                  <strong>{link.title}</strong>
                  <small>{link.subtitle}</small>
                  <span>{link.description}</span>
                </span>
                <ArrowRight className="dashboard-hero-arrow" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
