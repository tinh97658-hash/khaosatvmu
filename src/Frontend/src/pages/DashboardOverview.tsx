import React from 'react';
import { StatCard } from '../components/StatCard';
import type { SystemStats, SurveyCampaign } from '../types';

interface DashboardOverviewProps {
  stats: SystemStats;
  campaigns: SurveyCampaign[];
  onOpenQR: (campaign: SurveyCampaign) => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  stats,
  campaigns,
  onOpenQR,
  onNavigateTab,
}) => {
  return (
    <div>
      {/* Top Stat Cards */}
      <div className="stats-grid">
        <StatCard
          title="Tổng Số Khoa / Viện"
          value={stats.totalFaculties}
          icon="🏛️"
          subtitle="Đang quản lý"
        />
        <StatCard
          title="Chương Trình Đào Tạo"
          value={stats.totalMajors}
          icon="🎓"
          subtitle="Ngành đào tạo chính quy"
        />
        <StatCard
          title="Học Phần / Môn Học"
          value={stats.totalCourses}
          icon="📚"
          subtitle="Đã cập nhật CLO/PLO"
        />
        <StatCard
          title="Lớp Học Phần Khảo Sát"
          value={stats.totalClasses}
          icon="👨‍🏫"
          subtitle="Học kỳ II (2025-2026)"
        />
        <StatCard
          title="Đợt Khảo Sát Đang Mở"
          value={stats.activeCampaigns}
          icon="⚡"
          subtitle="Đang tiếp nhận phiếu"
          trend="+1 mới"
        />
        <StatCard
          title="Phiếu Đánh Giá Đã Nộp"
          value={stats.totalResponses.toLocaleString('vi-VN')}
          icon="📝"
          subtitle="Tỷ lệ hoàn thành 92.4%"
        />
        <StatCard
          title="Điểm Hài Lòng Trung Bình"
          value={`${stats.overallSatisfaction} / 5.0`}
          icon="⭐"
          subtitle="Chỉ số chất lượng VMU"
        />
        <StatCard
          title="Lượt Sinh Viên Quét QR"
          value={stats.qrScanCount.toLocaleString('vi-VN')}
          icon="📱"
          subtitle="Truy cập thiết bị di động"
        />
      </div>

      {/* Quick Navigation Cards */}
      <div className="card" style={{ padding: '24px', marginBottom: '28px' }}>
        <h3 style={{ fontSize: '16px', color: 'var(--vmu-navy)', marginBottom: '16px', fontWeight: 700 }}>
          🚀 HỆ THỐNG DỮ LIỆU CẮT LỚP & DỤNG CỤ ĐÁNH GIÁ (VMU CATALOGS)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <button
            onClick={() => onNavigateTab('faculties')}
            className="btn btn-secondary"
            style={{ justifyContent: 'flex-start', padding: '14px', textTransform: 'none', borderLeft: '4px solid #003366' }}
          >
            <span style={{ fontSize: '20px' }}>🏛️</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700, color: 'var(--vmu-navy)' }}>Danh Mục Khoa / Viện</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cơ cấu đơn vị đào tạo</div>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('majors')}
            className="btn btn-secondary"
            style={{ justifyContent: 'flex-start', padding: '14px', textTransform: 'none', borderLeft: '4px solid #1A5690' }}
          >
            <span style={{ fontSize: '20px' }}>🎓</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700, color: 'var(--vmu-navy)' }}>Ngành & CT Đào Tạo</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Chuẩn đầu ra PLO</div>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('courses')}
            className="btn btn-secondary"
            style={{ justifyContent: 'flex-start', padding: '14px', textTransform: 'none', borderLeft: '4px solid #059669' }}
          >
            <span style={{ fontSize: '20px' }}>📚</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700, color: 'var(--vmu-navy)' }}>Danh Mục Học Phần</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Môn học & Tín chỉ</div>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('criteria')}
            className="btn btn-secondary"
            style={{ justifyContent: 'flex-start', padding: '14px', textTransform: 'none', borderLeft: '4px solid #D97706' }}
          >
            <span style={{ fontSize: '20px' }}>📋</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700, color: 'var(--vmu-navy)' }}>Bộ Tiêu Chí Khảo Sát</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Mẫu câu hỏi Likert 5 mức</div>
            </div>
          </button>
        </div>
      </div>

      {/* Active Campaigns Table Overview */}
      <div className="card">
        <div className="card-header">
          <h3>📱 CÁC ĐỢT KHẢO SÁT ĐANG MỞ & MÃ QR CODE TRUY CẬP TRỰC TIẾP</h3>
          <button className="btn btn-primary btn-sm" onClick={() => onNavigateTab('campaigns')}>
            Quản Lý Tất Cả Đợt Khảo Sát &raquo;
          </button>
        </div>
        <div className="table-container">
          <table className="vmu-table">
            <thead>
              <tr>
                <th>Tên Đợt Khảo Sát</th>
                <th>Phân Loại</th>
                <th>Thời Gian</th>
                <th>Tiến Độ Thu Phiếu</th>
                <th>Trạng Thái</th>
                <th style={{ textAlign: 'center' }}>Thao Tác Mã QR</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600, color: 'var(--vmu-navy)', maxWidth: '320px' }}>
                    {c.title}
                  </td>
                  <td>
                    <span className="badge badge-info">{c.type}</span>
                  </td>
                  <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {c.startDate} ~ {c.endDate}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          flexGrow: 1,
                          height: '8px',
                          backgroundColor: '#E2E8F0',
                          borderRadius: '4px',
                          overflow: 'hidden',
                          width: '100px',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, Math.round((c.actualResponses / c.totalTargetResponses) * 100))}%`,
                            backgroundColor: 'var(--vmu-blue)',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>
                        {c.actualResponses} / {c.totalTargetResponses}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        c.status === 'Đang diễn ra' ? 'badge-warning' : 'badge-success'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="btn btn-qr btn-sm"
                      onClick={() => onOpenQR(c)}
                    >
                      <span>📱</span> Mã QR
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
