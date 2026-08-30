import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  LoaderCircle,
  Target,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import { useSemester } from '../context/semesterContext';
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

const progressColumns = [
  { key: 'code', header: 'Mã lớp HP', width: 14, align: 'center' as const },
  { key: 'name', header: 'Tên học phần', width: 28 },
  { key: 'lecturerName', header: 'Giảng viên', width: 22 },
  { key: 'departmentName', header: 'Bộ môn', width: 20 },
  { key: 'facultyName', header: 'Khoa / Viện', width: 22 },
  { key: 'targetCount', header: 'Sĩ số', width: 10, type: 'number' as const, align: 'right' as const },
  { key: 'actualCount', header: 'Đã nộp', width: 10, type: 'number' as const, align: 'right' as const },
  { key: 'invalidCount', header: 'Phiếu lỗi', width: 10, type: 'number' as const, align: 'right' as const },
  { key: 'validCount', header: 'Hợp lệ', width: 10, type: 'number' as const, align: 'right' as const },
  {
    key: 'rate',
    header: 'Tỷ lệ',
    width: 10,
    type: 'string' as const,
    align: 'right' as const,
    format: (val: any) => `${val}%`,
  },
  { key: 'status', header: 'Trạng thái', width: 14, align: 'center' as const },
];

export const SurveyProgressPage: React.FC<SurveyProgressPageProps> = ({
  semesterSurveys,
  sectionSurveys,
  isLoading,
  loadError,
}) => {
  const { activeSemesterLabel } = useSemester();
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('all');
  const [search, setSearch] = useState('');

  const displayedSections = useMemo(() => {
    if (selectedSurveyId === 'all') return sectionSurveys;
    const targetId = Number(selectedSurveyId);
    return sectionSurveys.filter((s) => s.semesterSurveyId === targetId);
  }, [sectionSurveys, selectedSurveyId]);

  // Mỗi lớp học phần đã được phát phiếu là một dòng theo dõi. Các số phiếu đều do
  // API khảo sát đếm sống từ bảng "SurveyResponses", không phải số tạm.
  //
  // Tiến độ tính trên PHIẾU HỢP LỆ: phiếu bị bộ lọc nhiễu loại vẫn là một lượt nộp
  // nhưng không dùng được vào kết quả nào, nên đếm nó vào tiến độ là tự huyễn hoặc.
  const progressItems: ProgressItem[] = useMemo(() => {
    return displayedSections.map((section) => {
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
        status: rate >= 80 ? 'Hoàn thành' : rate >= 20 ? 'Đang thu' : 'Chậm tiến độ',
      };
    });
  }, [displayedSections, semesterSurveys]);

  // Calculate Overall Progress Metrics
  const totalTarget = progressItems.reduce((acc, curr) => acc + curr.targetCount, 0);
  const totalActual = progressItems.reduce((acc, curr) => acc + curr.actualCount, 0);
  const totalValid = progressItems.reduce((acc, curr) => acc + curr.validCount, 0);
  const totalInvalid = totalActual - totalValid;
  const overallRate = Math.round((totalValid / (totalTarget || 1)) * 100);

  const completedCount = progressItems.filter((i) => i.status === 'Hoàn thành').length;
  const laggingCount = progressItems.filter((i) => i.status === 'Chậm tiến độ').length;

  const filtered = progressItems.filter(
    (item) =>
      item.code.toLowerCase().includes(search.toLowerCase()) ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.lecturerName.toLowerCase().includes(search.toLowerCase())
  );

  const exportConfig = useMemo(() => {
    const laggingItems = progressItems.filter((i) => i.status === 'Chậm tiến độ');
    const completedItems = progressItems.filter((i) => i.status === 'Hoàn thành');

    return {
      fileName: 'bao-cao-tien-do-thu-phieu-khao-sat',
      title: 'BÁO CÁO TIẾN ĐỘ THU PHIẾU KHẢO SÁT Ý KIẾN SINH VIÊN',
      subtitle: 'Hệ thống Khảo sát & Đảm bảo Chất lượng Đào tạo VMU',
      subInstitution: 'PHÒNG ĐẢM BẢO CHẤT LƯỢNG',
      info: {
        'Tổng số lớp khảo sát': progressItems.length,
        'Tổng chỉ tiêu (sĩ số)': totalTarget,
        'Tổng phiếu hợp lệ đã thu': `${totalValid} (đạt ${overallRate}%)`,
        'Lớp hoàn thành (≥80%)': completedCount,
        'Lớp chậm tiến độ (<20%)': laggingCount,
      },
      summaryNotes: [
        'Tiến độ tính dựa trên tỷ lệ phiếu hợp lệ so với sĩ số sinh viên lớp học phần.',
        'Phiếu không hợp lệ (trả lời trùng 1 đáp án toàn bài, thời gian làm bài < 15 giây...) đã bị bộ lọc loại bỏ.',
      ],
      sheets: [
        {
          sheetName: 'Tien do toan bo lop',
          title: `1. TIẾN ĐỘ THU PHIẾU TẤT CẢ CÁC LỚP HỌC PHẦN (${progressItems.length} LỚP)`,
          columns: progressColumns,
          data: progressItems,
        },
        {
          sheetName: 'Lop cham tien do',
          title: `2. DANH SÁCH LỚP CHẬM TIẾN ĐỘ CẦN ĐÔN ĐỐC (${laggingItems.length} LỚP)`,
          subtitle: 'Các lớp có tỷ lệ thu phiếu dưới 20% chỉ tiêu - cần gửi thông báo nhắc nhở',
          columns: progressColumns,
          data: laggingItems,
          summaryNotes: ['Đề nghị các Khoa/Viện và Bộ môn thông báo đến giảng viên nhắc nhở sinh viên tham gia khảo sát.'],
        },
        {
          sheetName: 'Lop da hoan thanh',
          title: `3. DANH SÁCH LỚP ĐẠT CHỈ TIÊU XUẤT SẮC (${completedItems.length} LỚP)`,
          subtitle: 'Các lớp đã đạt tỷ lệ thu phiếu từ 80% trở lên',
          columns: progressColumns,
          data: completedItems,
        },
      ],
    };
  }, [progressItems, totalTarget, totalValid, overallRate, completedCount, laggingCount]);

  const columns: Column<ProgressItem>[] = [
    {
      key: 'code',
      header: 'Nhóm lớp',
      width: '90px',
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
      filterValue: (item) => String(item.rate),
      numeric: true,
      quickFilters: [
        { label: 'Hoàn thành (≥80%)', match: (value) => Number(value) >= 80 },
        {
          label: 'Đang thu (20-79%)',
          match: (value) => Number(value) >= 20 && Number(value) < 80,
        },
        { label: 'Chậm tiến độ (<20%)', match: (value) => Number(value) < 20 },
      ],
      render: (item) => {
        const progressClass = item.rate >= 80
          ? 'operations-progress-fill--success'
          : item.rate >= 20
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
      filterValue: (item) => item.status,
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
          <section className="operations-toolbar" aria-label="Bộ lọc tiến độ" style={{ marginBottom: '14px' }}>
            <div className="operations-filter-title">
              <CalendarDays className="operation-icon" aria-hidden="true" />
              <span>Học kỳ: <strong>{activeSemesterLabel}</strong></span>
            </div>
            {semesterSurveys.length > 0 && (
              <div className="operations-field">
                <label htmlFor="progress-survey-select">Đợt khảo sát</label>
                <select
                  id="progress-survey-select"
                  value={selectedSurveyId}
                  onChange={(e) => setSelectedSurveyId(e.target.value)}
                >
                  <option value="all">Tất cả đợt trong học kỳ ({sectionSurveys.length} lớp)</option>
                  {semesterSurveys.map((survey) => (
                    <option key={survey.semesterSurveyId} value={String(survey.semesterSurveyId)}>
                      {survey.templateName} ({survey.sectionSurveyCount} lớp)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </section>

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
              <span className="operation-metric-label">Nhóm dưới 20%</span>
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
            exportConfig={exportConfig}
            emptyMessage="Chưa có lớp học phần nào được phát phiếu khảo sát."
            keyExtractor={(item) => item.id}
          />
        </>
      )}
    </div>
  );
};
