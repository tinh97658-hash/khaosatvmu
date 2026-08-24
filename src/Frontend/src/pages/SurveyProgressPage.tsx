import React, { useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Download,
  LoaderCircle,
  Target,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import type { CourseSectionSurvey, SemesterSurvey } from '../types';
import '../styles/survey-operations.css';

interface SurveyProgressPageProps {
  semesterSurveys: SemesterSurvey[];
  sectionSurveys: CourseSectionSurvey[];
  isLoading: boolean;
  loadError: string | null;
}

interface ProgressItem {
  id: string;
  code: string;
  name: string;
  groupCode: string;
  lecturerName: string;
  departmentName: string;
  facultyName: string;
  semester: string;
  targetCount: number;
  /** Mọi lượt nộp, kể cả phiếu bị lọc. */
  actualCount: number;
  /** Phiếu qua được bộ lọc — mẫu số của tiến độ. */
  validCount: number;
  invalidCount: number;
  rate: number;
  status: 'Hoàn thành' | 'Đang thu' | 'Chậm tiến độ';
}

export const SurveyProgressPage: React.FC<SurveyProgressPageProps> = ({
  semesterSurveys,
  sectionSurveys,
  isLoading,
  loadError,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Mỗi lớp học phần đã được phát phiếu là một dòng theo dõi. Các số phiếu đều do
  // API khảo sát đếm sống từ bảng "SurveyResponses", không phải số tạm.
  //
  // Tiến độ tính trên PHIẾU HỢP LỆ: phiếu bị bộ lọc nhiễu loại vẫn là một lượt nộp
  // nhưng không dùng được vào kết quả nào, nên đếm nó vào tiến độ là tự huyễn hoặc.
  const progressItems: ProgressItem[] = sectionSurveys.map((section) => {
    const survey = semesterSurveys.find(
      (item) => item.semesterSurveyId === section.semesterSurveyId
    );
    const rate = Math.round((section.validResponseCount / (section.classSize || 1)) * 100);

    return {
      id: String(section.courseSectionSurveyId),
      code: section.sectionName,
      name: section.courseName,
      groupCode: section.sectionName,
      lecturerName: section.lecturerName || 'Chưa phân công',
      departmentName: section.departmentName,
      facultyName: section.facultyName,
      semester: survey ? `${survey.semesterName} - ${survey.academicYearName}` : '—',
      targetCount: section.classSize,
      actualCount: section.responseCount,
      validCount: section.validResponseCount,
      invalidCount: section.invalidResponseCount,
      rate,
      status: rate >= 80 ? 'Hoàn thành' : rate >= 40 ? 'Đang thu' : 'Chậm tiến độ',
    };
  });

  // Calculate Overall Progress Metrics
  const totalTarget = progressItems.reduce((acc, curr) => acc + curr.targetCount, 0);
  const totalActual = progressItems.reduce((acc, curr) => acc + curr.actualCount, 0);
  const totalValid = progressItems.reduce((acc, curr) => acc + curr.validCount, 0);
  const totalInvalid = totalActual - totalValid;
  const overallRate = Math.round((totalValid / (totalTarget || 1)) * 100);

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
      item.departmentName,
      item.facultyName,
      item.targetCount.toString(),
      item.actualCount.toString(),
      item.invalidCount.toString(),
      item.validCount.toString(),
      `${item.rate}%`,
      item.status,
    ]);
    const csv = [
      [
        'Mã lớp', 'Tên học phần', 'Giảng viên', 'Bộ môn', 'Khoa / Viện',
        'Chỉ tiêu', 'Đã nộp', 'Không hợp lệ', 'Hợp lệ', 'Tỷ lệ', 'Trạng thái',
      ],
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

  const columns: Column<ProgressItem>[] = [
    {
      key: 'code',
      header: 'Nhóm lớp',
      width: '150px',
      filterValue: (item) => item.code,
      render: (item) => <span className="operations-code">{item.code}</span>,
    },
    {
      key: 'name',
      header: 'Tên Lớp HP / Đợt Khảo Sát',
      filterValue: (item) => item.name,
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
      key: 'departmentName',
      header: 'Bộ Môn',
      width: '180px',
      filterValue: (item) => item.departmentName,
      render: (item) => <span className="operations-primary-text">{item.departmentName}</span>,
    },
    {
      key: 'facultyName',
      header: 'Khoa / Viện',
      width: '180px',
      filterValue: (item) => item.facultyName,
      render: (item) => <span className="operations-primary-text">{item.facultyName}</span>,
    },
    {
      key: 'targetCount',
      header: 'Chỉ Tiêu / Sĩ Số',
      width: '120px',
      filterValue: (item) => String(item.targetCount),
      numeric: true,
      render: (item) => <span className="operations-primary-text">{item.targetCount} sinh viên</span>,
    },
    {
      key: 'actualCount',
      header: 'Số Phiếu Đã Nộp',
      width: '130px',
      filterValue: (item) => String(item.actualCount),
      numeric: true,
      render: (item) => <span className="operations-primary-text">{item.actualCount} phiếu</span>,
    },
    {
      key: 'invalidCount',
      header: 'Phiếu Không Hợp Lệ',
      width: '140px',
      filterValue: (item) => String(item.invalidCount),
      numeric: true,
      render: (item) =>
        item.invalidCount === 0 ? (
          <span className="operations-secondary-text">0 phiếu</span>
        ) : (
          <span className="operations-status operations-status--danger">
            {item.invalidCount} phiếu
          </span>
        ),
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
              <span>{item.validCount}/{item.targetCount} hợp lệ</span>
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
  ];

  return (
    <div className="survey-operations-page operations-table-page survey-progress-page">
      {loadError && (
        <div className="operations-feedback operations-feedback--error" role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      )}

      {isLoading ? (
        <div className="operations-empty" role="status">
          <LoaderCircle className="operation-icon auth-spin" aria-hidden="true" />
          <strong>Đang tải tiến độ thu phiếu...</strong>
        </div>
      ) : (
        <>
          <section className="operations-metrics" aria-label="Tổng quan tiến độ">
            <div className="operation-metric">
              <span className="operation-metric-icon"><Target className="operation-icon" aria-hidden="true" /></span>
              <span className="operation-metric-label">Tổng chỉ tiêu phiếu</span>
              <strong className="operation-metric-value">{totalTarget.toLocaleString()}</strong>
              <span className="operation-metric-note">Theo sĩ số tất cả nhóm lớp</span>
            </div>
            <div className="operation-metric operation-metric--success">
              <span className="operation-metric-icon"><ClipboardCheck className="operation-icon" aria-hidden="true" /></span>
              <span className="operation-metric-label">Phiếu hợp lệ</span>
              <strong className="operation-metric-value">{totalValid.toLocaleString()}</strong>
              <span className="operation-metric-note">
                Đạt {overallRate}% tổng chỉ tiêu · {totalInvalid.toLocaleString()} phiếu bị lọc
              </span>
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
            emptyMessage="Chưa có lớp học phần nào được phát phiếu khảo sát."
            keyExtractor={(item) => item.id}
          />
        </>
      )}
    </div>
  );
};
