import React, { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Target,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import type { CourseClass } from '../types';
import '../styles/survey-operations.css';

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

  const handleExportCsv = () => {
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = filtered.map((item) => [
      item.code,
      item.name,
      item.lecturerName,
      item.targetCount.toString(),
      item.actualCount.toString(),
      `${item.rate}%`,
      item.status,
    ]);
    const csv = [
      ['Mã lớp', 'Tên học phần', 'Giảng viên', 'Chỉ tiêu', 'Đã nộp', 'Tỷ lệ', 'Trạng thái'],
      ...rows,
    ].map((row) => row.map(quote).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'tien-do-thu-phieu-khao-sat.csv';
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success('Đã xuất báo cáo tiến độ', {
      description: `${filtered.length} dòng theo bộ lọc hiện tại.`,
    });
  };

  const columns: Column<(typeof progressItems)[0]>[] = [
    {
      key: 'code',
      header: 'Mã Lớp / Nhóm N01-N02',
      width: '150px',
      render: (item) => <span className="operations-code">{item.code}</span>,
    },
    {
      key: 'name',
      header: 'Tên Lớp HP / Đợt Khảo Sát',
      render: (item) => (
        <div>
          <strong className="operations-primary-text">{item.name}</strong>
          <div className="operations-secondary-text">
            <UserRound className="operation-icon" aria-hidden="true" />
            GV phụ trách: <strong>{item.lecturerName}</strong>; {item.semester}
          </div>
        </div>
      ),
    },
    {
      key: 'targetCount',
      header: 'Chỉ Tiêu / Sĩ Số',
      width: '120px',
      render: (item) => <span className="operations-primary-text">{item.targetCount} sinh viên</span>,
    },
    {
      key: 'actualCount',
      header: 'Số Phiếu Đã Nộp',
      width: '130px',
      render: (item) => <span className="operations-primary-text">{item.actualCount} phiếu</span>,
    },
    {
      key: 'progress',
      header: 'Tỷ Lệ Hoàn Thành (%)',
      render: (item) => {
        const progressClass = item.rate >= 80
          ? 'operations-progress-fill--success'
          : item.rate >= 40
            ? 'operations-progress-fill--warning'
            : '';

        return (
          <div className="operations-progress">
            <div className="operations-progress-meta">
              <strong>{item.rate}%</strong>
              <span>{item.actualCount}/{item.targetCount}</span>
            </div>
            <div
              className="operations-progress-track"
              role="progressbar"
              aria-label={`Tiến độ ${item.rate}%`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(item.rate, 100)}
            >
              <div
                className={`operations-progress-fill ${progressClass}`}
                style={{ width: `${Math.min(item.rate, 100)}%` }}
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
        let statusClass = 'operations-status--danger';
        if (item.status === 'Hoàn thành') statusClass = 'operations-status--success';
        else if (item.status === 'Đang thu') statusClass = 'operations-status--warning';

        return <span className={`operations-status ${statusClass}`}>{item.status}</span>;
      },
    },
    {
      key: 'actions',
      header: 'Thao Tác',
      width: '120px',
      render: (item) => (
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => toast.success('Đã ghi nhận yêu cầu nhắc nộp', {
            description: `Lớp hoặc nhóm ${item.code}`,
          })}
        >
          <Bell className="operation-icon" aria-hidden="true" />
          Nhắc nộp
        </button>
      ),
    },
  ];

  return (
    <div className="survey-operations-page operations-table-page survey-progress-page">
      <section className="operations-metrics" aria-label="Tổng quan tiến độ">
        <div className="operation-metric">
          <span className="operation-metric-icon"><Target className="operation-icon" aria-hidden="true" /></span>
          <span className="operation-metric-label">Tổng chỉ tiêu phiếu</span>
          <strong className="operation-metric-value">{totalTarget.toLocaleString()}</strong>
          <span className="operation-metric-note">Theo sĩ số tất cả nhóm lớp</span>
        </div>
        <div className="operation-metric operation-metric--success">
          <span className="operation-metric-icon"><ClipboardCheck className="operation-icon" aria-hidden="true" /></span>
          <span className="operation-metric-label">Phiếu đã thu</span>
          <strong className="operation-metric-value">{totalActual.toLocaleString()}</strong>
          <span className="operation-metric-note">Đạt {overallRate}% tổng chỉ tiêu</span>
        </div>
        <div className="operation-metric operation-metric--warning">
          <span className="operation-metric-icon"><CheckCircle2 className="operation-icon" aria-hidden="true" /></span>
          <span className="operation-metric-label">Nhóm đạt từ 80%</span>
          <strong className="operation-metric-value">{completedCount} / {progressItems.length}</strong>
          <span className="operation-metric-note">Nhóm hoàn thành thu phiếu</span>
        </div>
        <div className="operation-metric operation-metric--danger">
          <span className="operation-metric-icon"><TriangleAlert className="operation-icon" aria-hidden="true" /></span>
          <span className="operation-metric-label">Nhóm dưới 40%</span>
          <strong className="operation-metric-value">{laggingCount}</strong>
          <span className="operation-metric-note">Cần gửi nhắc nhở</span>
        </div>
      </section>

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
        toolbarActions={(
          <button className="btn btn-primary btn-sm" onClick={handleExportCsv}>
            <Download className="operation-icon" aria-hidden="true" />
            Xuất báo cáo Excel
          </button>
        )}
        emptyMessage="Không tìm thấy lớp hoặc nhóm phù hợp."
        keyExtractor={(item) => item.id}
      />
    </div>
  );
};
