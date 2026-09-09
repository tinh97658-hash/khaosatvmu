import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  LoaderCircle,
  Target,
  TriangleAlert,
} from 'lucide-react';
import { useSemester } from '../context/semesterContext';
import { DataTable } from '../components/DataTable';
import { SearchableSelect } from '../components/SearchableSelect';
import type { Column } from '../components/DataTable';
import type { CourseSectionSurvey, SemesterSurvey } from '../types';
import {
  COMPLETED_COMPLETION_RATE,
  LAGGING_COMPLETION_RATE,
} from '../utils/reportThresholds';
import '../styles/survey-operations.css';
import { foldVietnamese } from '../utils/vietnamese';

interface SurveyProgressPageProps {
  semesterSurveys: SemesterSurvey[];
  sectionSurveys: CourseSectionSurvey[];
  isLoading: boolean;
  loadError: string | null;
}

/**
 * Trang này chỉ theo dõi tiến độ THU phiếu, nên không mang theo số phiếu hợp lệ
 * hay bị lọc — chuyện hợp lệ là việc của các trang thống kê kết quả.
 */
interface ProgressItem {
  id: string;
  code: string;
  name: string;
  groupCode: string;
  lecturerName: string;
  departmentName: string;
  facultyName: string;
  targetCount: number;
  /** Mọi lượt nộp của lớp. */
  actualCount: number;
  /** Số phiếu đã thu chia sĩ số. */
  rate: number;
  status: 'Đạt chỉ tiêu' | 'Đang thu' | 'Chậm tiến độ';
}

const progressColumns = [
  { key: 'code', header: 'Mã lớp HP', width: 14, align: 'center' as const },
  { key: 'name', header: 'Tên lớp học phần', width: 28 },
  { key: 'lecturerName', header: 'Giảng viên', width: 24 },
  { key: 'departmentName', header: 'Bộ môn', width: 20 },
  { key: 'facultyName', header: 'Khoa / Viện', width: 22 },
  { key: 'targetCount', header: 'Sĩ số', width: 10, type: 'number' as const, align: 'right' as const },
  { key: 'actualCount', header: 'Số phiếu đã thu', width: 14, type: 'number' as const, align: 'right' as const },
  {
    // Xuất SỐ kèm mã định dạng chứ không xuất chuỗi "18%": ô chữ thì Excel sắp
    // theo bảng chữ cái, 100% rơi xuống dưới 18%.
    key: 'rate',
    header: 'Tỷ lệ phản hồi',
    width: 12,
    type: 'number' as const,
    align: 'right' as const,
    numberFormat: '0"%"',
  },
  { key: 'status', header: 'Trạng thái', width: 14, align: 'center' as const },
];

export const SurveyProgressPage: React.FC<SurveyProgressPageProps> = ({
  semesterSurveys,
  sectionSurveys,
  isLoading,
  loadError,
}) => {
  const {
    academicYears,
    activeSemesterId,
    activeSemesterLabel,
    setActiveSemesterId,
  } = useSemester();
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('');
  const [search, setSearch] = useState('');

  const semesterOptions = useMemo(
    () =>
      academicYears.flatMap((year) =>
        year.semesters.map((semester) => ({
          value: String(semester.semesterId),
          label: `${semester.semesterName} · ${year.academicYearName}`,
        }))
      ),
    [academicYears]
  );

  // Không còn lựa chọn "tất cả đợt": trang luôn bám đúng một đợt, mặc định là đợt
  // đầu danh sách và tự nhảy sang đợt khác khi danh sách đổi theo học kỳ.
  useEffect(() => {
    setSelectedSurveyId((prev) => {
      if (prev && semesterSurveys.some((s) => String(s.semesterSurveyId) === prev)) return prev;
      return semesterSurveys[0] ? String(semesterSurveys[0].semesterSurveyId) : '';
    });
  }, [semesterSurveys]);

  const displayedSections = useMemo(() => {
    if (!selectedSurveyId) return [];
    const targetId = Number(selectedSurveyId);
    return sectionSurveys.filter((s) => s.semesterSurveyId === targetId);
  }, [sectionSurveys, selectedSurveyId]);

  // Mỗi lớp học phần đã được phát phiếu là một dòng theo dõi. Các số phiếu đều do
  // API khảo sát đếm sống từ bảng "SurveyResponses", không phải số tạm.
  //
  // Tỷ lệ phản hồi tính trên MỌI phiếu đã thu chia sĩ số: ở đây chỉ cần biết sinh
  // viên đã nộp tới đâu, còn phiếu có qua bộ lọc nhiễu hay không là chuyện của
  // các trang thống kê kết quả.
  const progressItems: ProgressItem[] = useMemo(() => {
    return displayedSections.map((section) => {
      const rate = Math.round((section.responseCount / (section.classSize || 1)) * 100);

      return {
        id: String(section.courseSectionSurveyId),
        code: section.sectionName,
        name: section.courseName,
        groupCode: section.sectionName,
        // API đã trả sẵn tên đọc từ tệp import cho lớp chưa gắn được mã giảng viên,
        // nên tên "giảng viên không xác định" cũng vào đúng cột này.
        lecturerName: section.lecturerName || 'Chưa phân công',
        departmentName: section.departmentName,
        facultyName: section.facultyName,
        targetCount: section.classSize,
        actualCount: section.responseCount,
        rate,
        status: rate >= COMPLETED_COMPLETION_RATE
          ? 'Đạt chỉ tiêu'
          : rate >= LAGGING_COMPLETION_RATE
            ? 'Đang thu'
            : 'Chậm tiến độ',
      };
    });
  }, [displayedSections]);

  // Calculate Overall Progress Metrics
  const totalTarget = progressItems.reduce((acc, curr) => acc + curr.targetCount, 0);
  const totalActual = progressItems.reduce((acc, curr) => acc + curr.actualCount, 0);
  const overallRate = Math.round((totalActual / (totalTarget || 1)) * 100);

  const completedCount = progressItems.filter((i) => i.status === 'Đạt chỉ tiêu').length;
  const laggingCount = progressItems.filter((i) => i.status === 'Chậm tiến độ').length;

  const filtered = progressItems.filter(
    (item) =>
      foldVietnamese(item.code).includes(search.toLowerCase()) ||
      foldVietnamese(item.name).includes(search.toLowerCase()) ||
      foldVietnamese(item.lecturerName).includes(search.toLowerCase())
  );
  const selectedSurvey = semesterSurveys.find(
    (survey) => String(survey.semesterSurveyId) === selectedSurveyId
  );

  const exportConfig = useMemo(() => {
    const laggingItems = progressItems.filter((i) => i.status === 'Chậm tiến độ');
    const completedItems = progressItems.filter((i) => i.status === 'Đạt chỉ tiêu');

    return {
      fileName: `bao-cao-tien-do-thu-phieu-dot-khao-sat-${
        selectedSurvey?.surveyName || 'hoc-phan'
      }-${activeSemesterLabel}`,
      title: 'BÁO CÁO TIẾN ĐỘ THU PHIẾU KHẢO SÁT Ý KIẾN SINH VIÊN',
      subtitle: 'Hệ thống Khảo sát & Đảm bảo Chất lượng Đào tạo VMU',
      subInstitution: 'PHÒNG ĐẢM BẢO CHẤT LƯỢNG',
      info: {
        'Tổng số lớp khảo sát': progressItems.length,
        'Tổng sĩ số': totalTarget,
        'Tổng phiếu đã thu': `${totalActual} (đạt ${overallRate}%)`,
        [`Lớp đạt chỉ tiêu (≥${COMPLETED_COMPLETION_RATE}%)`]: completedCount,
        [`Lớp chậm tiến độ (<${LAGGING_COMPLETION_RATE}%)`]: laggingCount,
      },
      summaryNotes: [
        'Tỷ lệ phản hồi = Số phiếu đã thu ÷ Sĩ số lớp học phần.',
        'Báo cáo này chỉ theo dõi tiến độ thu phiếu, không xét phiếu hợp lệ hay bị bộ lọc loại.',
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
          subtitle: `Các lớp có tỷ lệ phản hồi dưới ${LAGGING_COMPLETION_RATE}% - cần gửi thông báo nhắc nhở`,
          columns: progressColumns,
          data: laggingItems,
          summaryNotes: ['Đề nghị các Khoa/Viện và Bộ môn thông báo đến giảng viên nhắc nhở sinh viên tham gia khảo sát.'],
        },
        {
          sheetName: 'Lop da hoan thanh',
          title: `3. DANH SÁCH LỚP ĐẠT CHỈ TIÊU XUẤT SẮC (${completedItems.length} LỚP)`,
          subtitle: `Các lớp đã đạt tỷ lệ phản hồi từ ${COMPLETED_COMPLETION_RATE}% trở lên`,
          columns: progressColumns,
          data: completedItems,
        },
      ],
    };
  }, [
    progressItems,
    totalTarget,
    totalActual,
    overallRate,
    completedCount,
    laggingCount,
    selectedSurvey?.surveyName,
    activeSemesterLabel,
  ]);

  // Bề rộng theo phần trăm để tỷ lệ cột giữ nguyên trên mọi cỡ màn hình.
  const columns: Column<ProgressItem>[] = [
    {
      key: 'code',
      header: 'Nhóm lớp',
      width: '7%',
      filterValue: (item) => item.code,
      render: (item) => <span className="operations-code">{item.code}</span>,
    },
    {
      key: 'name',
      header: 'Tên lớp học phần',
      width: '18%',
      filterValue: (item) => item.name,
      render: (item) => <strong className="operations-primary-text">{item.name}</strong>,
    },
    {
      key: 'lecturerName',
      header: 'Giảng viên',
      width: '14%',
      filterValue: (item) => item.lecturerName,
      render: (item) => (
        <span className="operations-primary-text">{item.lecturerName}</span>
      ),
    },
    {
      key: 'departmentName',
      header: 'Bộ Môn',
      width: '12%',
      filterValue: (item) => item.departmentName,
      render: (item) => <span className="operations-primary-text">{item.departmentName}</span>,
    },
    {
      key: 'facultyName',
      header: 'Khoa / Viện',
      width: '12%',
      filterValue: (item) => item.facultyName,
      render: (item) => <span className="operations-primary-text">{item.facultyName}</span>,
    },
    {
      key: 'targetCount',
      header: 'Sĩ số',
      width: '6%',
      filterValue: (item) => String(item.targetCount),
      numeric: true,
      render: (item) => <span className="operations-primary-text">{item.targetCount}</span>,
    },
    {
      key: 'actualCount',
      header: 'Số phiếu đã thu',
      width: '9%',
      filterValue: (item) => String(item.actualCount),
      numeric: true,
      render: (item) => <span className="operations-primary-text">{item.actualCount} phiếu</span>,
    },
    {
      key: 'progress',
      header: 'Tỷ lệ phản hồi',
      width: '12%',
      filterValue: (item) => String(item.rate),
      numeric: true,
      quickFilters: [
        {
          label: `Đạt chỉ tiêu (≥${COMPLETED_COMPLETION_RATE}%)`,
          match: (value) => Number(value) >= COMPLETED_COMPLETION_RATE,
        },
        {
          label: `Đang thu (${LAGGING_COMPLETION_RATE}-${COMPLETED_COMPLETION_RATE - 1}%)`,
          match: (value) =>
            Number(value) >= LAGGING_COMPLETION_RATE
            && Number(value) < COMPLETED_COMPLETION_RATE,
        },
        {
          label: `Chậm tiến độ (<${LAGGING_COMPLETION_RATE}%)`,
          match: (value) => Number(value) < LAGGING_COMPLETION_RATE,
        },
      ],
      render: (item) => {
        const progressClass = item.rate >= COMPLETED_COMPLETION_RATE
          ? 'operations-progress-fill--success'
          : item.rate >= LAGGING_COMPLETION_RATE
            ? 'operations-progress-fill--warning'
            : '';

        return (
          <div className="operations-progress">
            <div className="operations-progress-meta">
              <strong>{item.rate}%</strong>
              <span>{item.actualCount}/{item.targetCount} phiếu</span>
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
      header: 'Trạng thái',
      width: '10%',
      filterValue: (item) => item.status,
      render: (item) => {
        let statusClass = 'operations-status--danger';
        if (item.status === 'Đạt chỉ tiêu') statusClass = 'operations-status--success';
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
          {/* Cùng bố cục với trang Tổng quan khảo sát: bốn phần nằm ngang một hàng
              ở góc trái trên — nhãn Học kỳ, ô chọn kỳ, nhãn Đợt khảo sát, ô chọn đợt. */}
          <section className="statistics-toolbar" aria-label="Bộ lọc tiến độ">
            <label className="form-group">
              <span>Học kỳ</span>
              <select
                value={activeSemesterId ?? ''}
                onChange={(event) =>
                  setActiveSemesterId(event.target.value ? Number(event.target.value) : null)
                }
              >
                <option value="">Chọn học kỳ</option>
                {semesterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-group statistics-toolbar-field--campaign">
              <span>Đợt khảo sát</span>
              <SearchableSelect
                id="progress-campaign-select"
                aria-label="Đợt khảo sát"
                listClassName="statistics-toolbar-field--campaign-list"
                showHoveredLabel
                value={selectedSurveyId}
                onChange={setSelectedSurveyId}
                disabled={semesterSurveys.length === 0}
                placeholder={semesterSurveys.length === 0 ? 'Chưa có đợt nào' : 'Chọn đợt khảo sát'}
                options={semesterSurveys.map((survey) => ({
                  value: String(survey.semesterSurveyId),
                  label: `${survey.surveyName} · ${survey.sectionSurveyCount} lớp`,
                }))}
              />
            </div>
          </section>

          <section className="operations-metrics" aria-label="Tổng quan tiến độ">
            <div className="operation-metric">
              <span className="operation-metric-icon"><Target className="operation-icon" aria-hidden="true" /></span>
              <span className="operation-metric-label">Tổng sĩ số</span>
              <strong className="operation-metric-value">{totalTarget.toLocaleString()}</strong>
              <span className="operation-metric-note">Theo sĩ số tất cả nhóm lớp</span>
            </div>
            <div className="operation-metric operation-metric--success">
              <span className="operation-metric-icon"><ClipboardCheck className="operation-icon" aria-hidden="true" /></span>
              <span className="operation-metric-label">Phiếu đã thu</span>
              <strong className="operation-metric-value">{totalActual.toLocaleString()}</strong>
              <span className="operation-metric-note">Tỷ lệ phản hồi {overallRate}% tổng sĩ số</span>
            </div>
            <div className="operation-metric operation-metric--warning">
              <span className="operation-metric-icon"><CheckCircle2 className="operation-icon" aria-hidden="true" /></span>
              <span className="operation-metric-label">Nhóm đạt từ {COMPLETED_COMPLETION_RATE}%</span>
              <strong className="operation-metric-value">{completedCount} / {progressItems.length}</strong>
              <span className="operation-metric-note">Nhóm đạt chỉ tiêu thu phiếu</span>
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
