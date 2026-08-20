import React from 'react';
import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  GraduationCap,
  ListChecks,
  QrCode,
  RadioTower,
  type LucideIcon,
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { canAccessModule } from '../auth/modulePermissions';
import type { SystemStats, SurveyCampaign } from '../types';
import '../styles/dashboard.css';

interface DashboardOverviewProps {
  stats: SystemStats;
  campaigns: SurveyCampaign[];
  onOpenQR: (campaign: SurveyCampaign) => void;
  onNavigateTab: (tab: string) => void;
  permissions: readonly string[];
}

interface QuickAction {
  tab: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: 'blue' | 'teal' | 'green' | 'amber';
}

const quickActions: QuickAction[] = [
  {
    tab: 'faculties',
    title: 'Khoa / Viện',
    description: 'Cơ cấu đơn vị đào tạo',
    icon: Building2,
    tone: 'blue',
  },
  {
    tab: 'majors',
    title: 'Ngành đào tạo',
    description: 'Chương trình và chuẩn đầu ra',
    icon: GraduationCap,
    tone: 'teal',
  },
  {
    tab: 'courses',
    title: 'Học phần',
    description: 'Môn học và số tín chỉ',
    icon: BookOpen,
    tone: 'green',
  },
  {
    tab: 'course-question-sets',
    title: 'Bộ câu hỏi khảo sát',
    description: 'Bộ câu hỏi và thang đánh giá',
    icon: ListChecks,
    tone: 'amber',
  },
];

const formatDate = (value: string) => {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const getProgress = (campaign: SurveyCampaign) => {
  if (campaign.totalTargetResponses <= 0) return 0;
  return Math.min(100, Math.round(
    (campaign.actualResponses / campaign.totalTargetResponses) * 100,
  ));
};

/** Tỷ lệ phiếu đã thu trên tổng sĩ số các lớp đã phát phiếu. */
const formatCompletionRate = (stats: SystemStats) => {
  if (stats.totalTargetResponses <= 0) return '0';
  return ((stats.totalResponses / stats.totalTargetResponses) * 100).toLocaleString('vi-VN', {
    maximumFractionDigits: 2,
  });
};

const getStatusClassName = (status: SurveyCampaign['status']) => {
  if (status === 'Đang diễn ra') return 'is-active';
  if (status === 'Sắp diễn ra') return 'is-upcoming';
  return 'is-complete';
};

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  stats,
  campaigns,
  onOpenQR,
  onNavigateTab,
  permissions,
}) => {
  const visibleQuickActions = quickActions.filter((action) =>
    canAccessModule(permissions, action.tab));
  const canViewSurveyOperations = ['progress', 'reports', 'course-campaigns']
    .some((moduleId) => canAccessModule(permissions, moduleId));
  const canManageCourseCampaigns = canAccessModule(permissions, 'course-campaigns');

  return (
    <div className="dashboard-overview">
      <section className="dashboard-block" aria-labelledby="dashboard-summary-title">
        <header className="dashboard-block-heading">
          <div>
            <h2 id="dashboard-summary-title">Tổng quan hệ thống</h2>
            <p>Số liệu vận hành khảo sát trong học kỳ hiện tại</p>
          </div>
          <span className="dashboard-period">
            <CalendarDays aria-hidden="true" />
            Học kỳ II, 2025-2026
          </span>
        </header>

        <div className="dashboard-stats-grid">
          <StatCard
            title="Khoa / Viện"
            value={stats.totalFaculties}
            icon="building"
            subtitle="Đơn vị đang quản lý"
          />
          <StatCard
            title="Ngành đào tạo"
            value={stats.totalMajors}
            icon="graduation"
            subtitle="Chương trình chính quy"
          />
          <StatCard
            title="Học phần"
            value={stats.totalCourses}
            icon="course"
            subtitle="Đã cập nhật CLO/PLO"
          />
          <StatCard
            title="Lớp khảo sát"
            value={stats.totalClasses}
            icon="classes"
            subtitle="Trong học kỳ hiện tại"
          />
          <StatCard
            title="Đợt đang mở"
            value={stats.activeCampaigns}
            icon="campaign"
            subtitle="Đang tiếp nhận phiếu"
            trend="+1 mới"
          />
          <StatCard
            title="Phiếu đã nộp"
            value={stats.totalResponses.toLocaleString('vi-VN')}
            icon="responses"
            subtitle={`Tỷ lệ hoàn thành ${formatCompletionRate(stats)}%`}
          />
          <StatCard
            title="Điểm hài lòng"
            value={`${stats.overallSatisfaction} / 5,0`}
            icon="satisfaction"
            subtitle="Chỉ số chất lượng VMU"
          />
          <StatCard
            title="Lượt quét QR"
            value={stats.qrScanCount.toLocaleString('vi-VN')}
            icon="qr"
            subtitle="Truy cập từ thiết bị di động"
          />
        </div>
      </section>

      {visibleQuickActions.length > 0 && <section className="dashboard-block" aria-labelledby="dashboard-catalog-title">
        <header className="dashboard-block-heading">
          <div>
            <h2 id="dashboard-catalog-title">Danh mục và công cụ</h2>
            <p>Truy cập nhanh dữ liệu nền phục vụ khảo sát</p>
          </div>
        </header>

        <div className="dashboard-quick-grid">
          {visibleQuickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                type="button"
                key={action.tab}
                className={`dashboard-quick-action is-${action.tone}`}
                onClick={() => onNavigateTab(action.tab)}
              >
                <span className="dashboard-quick-icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="dashboard-quick-copy">
                  <strong>{action.title}</strong>
                  <small>{action.description}</small>
                </span>
                <ArrowRight className="dashboard-quick-arrow" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>}

      {canViewSurveyOperations && <section className="dashboard-block dashboard-campaigns" aria-labelledby="dashboard-campaigns-title">
        <header className="dashboard-block-heading dashboard-campaigns-heading">
          <div>
            <h2 id="dashboard-campaigns-title">Đợt khảo sát đang mở</h2>
            <p>Theo dõi tiến độ thu phiếu và mở mã QR truy cập</p>
          </div>
          <div className="dashboard-heading-actions">
            <span className="dashboard-result-count">{campaigns.length} đợt khảo sát</span>
            {canManageCourseCampaigns && <button
              type="button"
              className="dashboard-manage-button"
              onClick={() => onNavigateTab('course-campaigns')}
            >
              Quản lý tất cả
              <ArrowRight aria-hidden="true" />
            </button>}
          </div>
        </header>

        <div className="dashboard-table-scroll">
          <table className="dashboard-campaign-table">
            <thead>
              <tr>
                <th scope="col">Đợt khảo sát</th>
                <th scope="col">Phân loại</th>
                <th scope="col">Thời gian</th>
                <th scope="col">Tiến độ thu phiếu</th>
                <th scope="col">Trạng thái</th>
                <th scope="col" className="dashboard-action-column">Mã QR</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="dashboard-empty-cell">
                    <RadioTower aria-hidden="true" />
                    <strong>Chưa có đợt khảo sát đang mở</strong>
                    <span>Các đợt khảo sát mới sẽ xuất hiện tại đây.</span>
                  </td>
                </tr>
              ) : campaigns.map((campaign) => {
                const progress = getProgress(campaign);
                return (
                  <tr key={campaign.id}>
                    <td className="dashboard-campaign-name">
                      <strong title={campaign.title}>{campaign.title}</strong>
                      <span>{campaign.semester} · {campaign.academicYear}</span>
                    </td>
                    <td>
                      <span className="dashboard-type-label">{campaign.type}</span>
                    </td>
                    <td className="dashboard-date-cell">
                      {formatDate(campaign.startDate)}
                      <span aria-hidden="true">-</span>
                      {formatDate(campaign.endDate)}
                    </td>
                    <td>
                      <div
                        className="dashboard-progress"
                        aria-label={`Đã thu ${campaign.actualResponses} trên ${campaign.totalTargetResponses} phiếu, đạt ${progress}%`}
                      >
                        <div className="dashboard-progress-track" aria-hidden="true">
                          <span style={{ width: `${progress}%` }} />
                        </div>
                        <span className="dashboard-progress-value">
                          {campaign.actualResponses.toLocaleString('vi-VN')}
                          <small> / {campaign.totalTargetResponses.toLocaleString('vi-VN')}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`dashboard-status ${getStatusClassName(campaign.status)}`}>
                        <span aria-hidden="true" />
                        {campaign.status}
                      </span>
                    </td>
                    <td className="dashboard-action-column">
                      <button
                        type="button"
                        className="dashboard-qr-button"
                        aria-label={`Mở mã QR cho ${campaign.title}`}
                        title="Mở mã QR"
                        onClick={() => onOpenQR(campaign)}
                      >
                        <QrCode aria-hidden="true" />
                        <span>Mã QR</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>}
    </div>
  );
};
