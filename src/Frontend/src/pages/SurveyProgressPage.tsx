import React, { useState } from 'react';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import type { CourseClass } from '../types';

interface SurveyProgressPageProps {
  classes: CourseClass[];
}

export const SurveyProgressPage: React.FC<SurveyProgressPageProps> = ({ classes }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Flatten Class Groups into distinct progress items for granular group N01, N02 tracking
  const progressItems = classes.flatMap((cls) => {
    const groups = cls.groups || [];
    if (groups.length === 0) {
      const rate = Math.round((cls.completedResponses / (cls.totalStudents || 1)) * 100);
      return [
        {
          id: cls.id,
          code: cls.code,
          name: cls.courseName,
          type: 'Học phần' as const,
          groupCode: 'Toàn lớp',
          lecturerName: cls.lecturerName,
          semester: `${cls.semester} (${cls.academicYear})`,
          targetCount: cls.totalStudents,
          actualCount: cls.completedResponses,
          rate,
          status: rate >= 80 ? 'Hoàn thành' : rate >= 40 ? 'Đang thu' : 'Chậm tiến độ',
        },
      ];
    }

    return groups.map((g) => {
      const rate = Math.round((g.completedResponses / (g.studentCount || 1)) * 100);
      return {
        id: g.id,
        code: g.fullGroupCode,
        name: `${cls.courseName} [Nhóm ${g.groupCode}]`,
        type: 'Học phần' as const,
        groupCode: g.groupCode,
        lecturerName: g.lecturerName,
        semester: `${cls.semester} (${cls.academicYear})`,
        targetCount: g.studentCount,
        actualCount: g.completedResponses,
        rate,
        status: rate >= 80 ? 'Hoàn thành' : rate >= 40 ? 'Đang thu' : 'Chậm tiến độ',
      };
    });
  });

  // Calculate Overall Progress Metrics
  const totalTarget = progressItems.reduce((acc, curr) => acc + curr.targetCount, 0);
  const totalActual = progressItems.reduce((acc, curr) => acc + curr.actualCount, 0);
  const overallRate = Math.round((totalActual / (totalTarget || 1)) * 100);

  const completedCount = progressItems.filter((i) => i.status === 'Hoàn thành').length;
  const laggingCount = progressItems.filter((i) => i.status === 'Chậm tiến độ').length;

  const filtered = progressItems.filter((item) => {
    const matchesSearch =
      item.code.toLowerCase().includes(search.toLowerCase()) ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.lecturerName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<(typeof progressItems)[0]>[] = [
    {
      key: 'code',
      header: 'Mã Lớp / Nhóm N01-N02',
      width: '150px',
      render: (item) => (
        <span className="badge badge-info" style={{ fontFamily: 'monospace', fontSize: '13px' }}>
          {item.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Tên Lớp HP / Đợt Khảo Sát',
      render: (item) => (
        <div>
          <strong style={{ color: 'var(--vmu-navy)', fontSize: '14px' }}>{item.name}</strong>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            👨‍🏫 GV phụ trách: <span style={{ color: 'var(--vmu-blue)', fontWeight: 600 }}>{item.lecturerName}</span> &bull; {item.semester}
          </div>
        </div>
      ),
    },
    {
      key: 'targetCount',
      header: 'Chỉ Tiêu / Sĩ Số',
      width: '120px',
      render: (item) => (
        <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{item.targetCount} sinh viên</span>
      ),
    },
    {
      key: 'actualCount',
      header: 'Số Phiếu Đã Nộp',
      width: '130px',
      render: (item) => (
        <span style={{ fontWeight: 700, color: 'var(--vmu-navy)' }}>
          {item.actualCount} phiếu
        </span>
      ),
    },
    {
      key: 'progress',
      header: 'Tỷ Lệ Hoàn Thành (%)',
      render: (item) => {
        let barColor = 'var(--accent-red)';
        if (item.rate >= 80) barColor = 'var(--accent-green)';
        else if (item.rate >= 40) barColor = 'var(--accent-gold)';

        return (
          <div style={{ width: '100%', maxWidth: '220px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
              <span style={{ color: barColor }}>{item.rate}%</span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{item.actualCount}/{item.targetCount}</span>
            </div>
            <div
              style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#E2E8F0',
                borderRadius: '0px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.min(item.rate, 100)}%`,
                  height: '100%',
                  backgroundColor: barColor,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Trạng Thái Tiến Độ',
      width: '130px',
      render: (item) => {
        let badgeClass = 'badge-danger';
        if (item.status === 'Hoàn thành') badgeClass = 'badge-success';
        else if (item.status === 'Đang thu') badgeClass = 'badge-warning';

        return <span className={`badge ${badgeClass}`}>{item.status}</span>;
      },
    },
    {
      key: 'actions',
      header: 'Thao Tác',
      width: '120px',
      render: (item) => (
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => alert(`Đã gửi thông báo nhắc nhở nộp phiếu khảo sát đến sinh viên Nhóm ${item.code}!`)}
        >
          🔔 Nhắc nộp
        </button>
      ),
    },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h2>THEO DÕI TIẾN ĐỘ THU PHIẾU KHẢO SÁT</h2>
          <p>Giám sát thời gian thực số lượng và tỷ lệ % sinh viên hoàn thành khảo sát theo Lớp học phần & Nhóm lớp N01, N02</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => alert('Đã xuất báo cáo tổng hợp tiến độ thu phiếu toàn trường dạng Excel!')}
        >
          📊 Xuất Báo Cáo Tiến Độ (Excel)
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">TỔNG CHỈ TIÊU PHIẾU CẦN THU</span>
            <span className="stat-icon">🎯</span>
          </div>
          <div className="stat-value">{totalTarget.toLocaleString()}</div>
          <div className="stat-trend trend-up">Theo danh sách sĩ số tất cả nhóm lớp</div>
        </div>

        <div className="stat-card" style={{ borderLeftColor: 'var(--accent-green)' }}>
          <div className="stat-header">
            <span className="stat-title">SỐ PHIẾU ĐÃ THU ĐƯỢC</span>
            <span className="stat-icon">📝</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--accent-green)' }}>
            {totalActual.toLocaleString()}
          </div>
          <div className="stat-trend trend-up">
            Đạt <strong>{overallRate}%</strong> tổng chỉ tiêu
          </div>
        </div>

        <div className="stat-card" style={{ borderLeftColor: 'var(--accent-gold)' }}>
          <div className="stat-header">
            <span className="stat-title">NHÓM LỚP ĐẠT CHỈ TIÊU (&ge;80%)</span>
            <span className="stat-icon">✅</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--accent-gold)' }}>
            {completedCount} / {progressItems.length}
          </div>
          <div className="stat-trend">Nhóm hoàn thành thu phiếu khảo sát</div>
        </div>

        <div className="stat-card" style={{ borderLeftColor: 'var(--accent-red)' }}>
          <div className="stat-header">
            <span className="stat-title">NHÓM CHẬM TIẾN ĐỘ (&lt;40%)</span>
            <span className="stat-icon">⚠️</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--accent-red)' }}>
            {laggingCount}
          </div>
          <div className="stat-trend trend-down">Cần nhắc nhở sinh viên & giảng viên</div>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={filtered}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm mã lớp HP, nhóm N01/N02, tên môn hoặc giảng viên..."
        filterOptions={[
          { label: '-- Tất cả tiến độ --', value: '' },
          { label: 'Hoàn thành (≥80%)', value: 'Hoàn thành' },
          { label: 'Đang thu (40-80%)', value: 'Đang thu' },
          { label: 'Chậm tiến độ (<40%)', value: 'Chậm tiến độ' },
        ]}
        currentFilter={statusFilter}
        onFilterChange={setStatusFilter}
        keyExtractor={(item) => item.id}
      />
    </div>
  );
};
