import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { ChevronDown, CircleAlert, LoaderCircle, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { useSemester } from '../context/semesterContext';
import { TablePagination } from '../components/TablePagination';
import { usePaginatedItems } from '../hooks/usePaginatedItems';
import { useColumnFilters, type FilterableColumn } from '../hooks/useColumnFilters';
import { NoteModalButton } from '../components/NoteModalButton';
import { useAuth } from '../auth/authContext';
import { canAccessTab, firstAllowedTab } from '../auth/modulePermissions';
import { ApiError } from '../services/apiClient';
import {
  courseDiagnosisDescriptions,
  courseDiagnosisLabels,
  surveyApi,
  surveyErrorMessage,
} from '../services/surveyApi';
import type {
  LecturerOption,
  LecturerReport,
  SemesterSurveyCourseDiagnosis,
  SemesterSurveyDepartmentSummary,
  SemesterSurveyNormalization,
} from '../services/surveyApi';
import type { SemesterSurvey } from '../types';
import '../styles/survey-operations.css';
import '../styles/survey-statistics.css';

function messageFrom(error: unknown): string {
  return error instanceof ApiError ? surveyErrorMessage(error.errorCode) : surveyErrorMessage(null);
}

/** Dưới mức này thì lớp bị coi là cần cảnh báo — khớp ReportThresholds.LowScore. */
const lowScore = 3.2;
const analysisPageSize = 20;

type TabId =
  | 'normalization'
  | 'normalizationSections'
  | 'departments'
  | 'courses'
  | 'lecturer';

const tabs: { id: TabId; label: string; hint: string }[] = [
  {
    id: 'normalization',
    label: 'Mặt bằng khoa/viện',
    hint: 'Điểm trung bình từng khoa/viện. Cột Z-Score so điểm TB khoa với trung bình toàn trường theo sai số chuẩn σ/√n, chia bậc 1σ · 2σ · 3σ.',
  },
  {
    id: 'normalizationSections',
    label: 'Phân tích theo lớp',
    hint: 'So điểm thô giữa các lớp khác khoa là so sai. Z-score đưa mọi lớp về cùng một thước.',
  },
  {
    id: 'departments',
    label: 'Tổng hợp theo bộ môn',
    hint: 'Phục vụ trưởng khoa: mỗi dòng là một bộ môn trong đợt khảo sát.',
  },
  {
    id: 'courses',
    label: 'Đánh giá học phần',
    hint: 'So các lớp trong cùng một học phần để biết vấn đề nằm ở học phần hay ở giảng viên.',
  },
  {
    id: 'lecturer',
    label: 'Báo cáo giảng viên',
    hint: 'Chọn một giảng viên rồi bấm Tìm. Mỗi lần chỉ hiện đúng một người.',
  },
];

/** Tô điểm theo thang đỏ → cam → vàng → xanh như bản mô phỏng Excel. */
function scoreClass(score: number | null): string {
  if (score === null) return 'num';
  if (score < lowScore) return 'num score-band score-band--bad';
  if (score < 3.5) return 'num score-band score-band--poor';
  if (score < 3.8) return 'num score-band score-band--fair';
  return 'num score-band score-band--good';
}

function verdictClass(verdict: string): string {
  switch (verdict) {
    case 'CONCLUSION_FLIPS':
    case 'COURSE_ISSUE':
      return 'verdict verdict--flip';
    case 'BELOW_FACULTY':
    case 'LECTURER_VARIANCE':
      return 'verdict verdict--below';
    case 'ABOVE_FACULTY':
    case 'ALL_GOOD':
      return 'verdict verdict--above';
    case 'FACULTY_TOO_SMALL':
    case 'INCONCLUSIVE':
      return 'verdict verdict--muted';
    default:
      return 'verdict';
  }
}

/**
 * Ba bậc của quy tắc thực nghiệm 68-95-99.7 — khớp NotableZScore / StrongZScore /
 * ExtremeZScore trong ReportThresholds.
 */
const zTiers = { notable: 1, strong: 2, extreme: 3 };

/**
 * Tô theo bậc 68-95-99.7, KHÔNG dùng thang điểm tuyệt đối 3.20/3.50/3.80. Phía âm
 * tách hai mức vì đó là phía cần xử lý; phía dương chỉ một mức, bậc cụ thể đã nằm
 * ở cột Nhận định.
 */
function zTierClass(value: number | null): string {
  if (value === null) return 'num';
  if (value <= -zTiers.strong) return 'num score-band score-band--bad';
  if (value <= -zTiers.notable) return 'num score-band score-band--poor';
  if (value >= zTiers.notable) return 'num score-band score-band--good';
  return 'num';
}

/** Bốn bậc của quy tắc 68-95-99.7, dùng chung cho mọi cột Nhận định. */
const zVerdictTiers = [
  { label: 'Rất bất thường', className: 'verdict verdict--severe', range: '|Z-Score| ≥ 3' },
  { label: 'Bất thường', className: 'verdict verdict--below', range: '|Z-Score| ≥ 2' },
  { label: 'Đáng chú ý', className: 'verdict verdict--watch', range: '|Z-Score| ≥ 1' },
  { label: 'Bình thường', className: 'verdict verdict--muted', range: '|Z-Score| < 1' },
];

/** Nhãn cho một giá trị Z bất kỳ. Xét từ bậc nặng nhất xuống. */
function zVerdict(value: number | null): { label: string; className: string } {
  if (value === null) return { label: '—', className: 'verdict verdict--muted' };

  const size = Math.abs(value);
  if (size >= zTiers.extreme) return zVerdictTiers[0];
  if (size >= zTiers.strong) return zVerdictTiers[1];
  if (size >= zTiers.notable) return zVerdictTiers[2];
  return zVerdictTiers[3];
}

/** Công thức và bốn bậc của cột Nhận định, đọc trong hộp thoại chú thích. */
const ZVerdictLegend: React.FC<{ notes: string[] }> = ({ notes }) => (
  <NoteModalButton title="Chú thích cách tính">
    <div className="z-legend">
      {notes.map((note) => (
        <p className="z-legend__note" key={note}>
          {note}
        </p>
      ))}
      <ul className="z-legend__list">
        {[...zVerdictTiers].reverse().map((tier) => (
          <li key={tier.label}>
            <code>{tier.range}</code>
            <span aria-hidden="true">→</span>
            <span className={tier.className}>{tier.label}</span>
          </li>
        ))}
      </ul>
    </div>
  </NoteModalButton>
);

/**
 * Chú thích của từng tab. Gom về một chỗ để trang cha đặt nút ở góc phải trên,
 * ngay dưới thanh tab — thay vì mỗi tab tự thả một khối ở cuối, phải cuộn hết
 * bảng mới thấy.
 */
const tabNotes: Partial<Record<TabId, React.ReactNode>> = {
  normalization: (
    <ZVerdictLegend
      notes={[
        'Độ lệch chuẩn = √( Tổng bình phương (Điểm từng lớp − Điểm TB khoa) ÷ (Số lớp − 1) )',
        'Z-Score = (Điểm TB khoa − Trung bình toàn trường)'
          + ' ÷ (Độ lệch chuẩn toàn trường ÷ √Số lớp)',
      ]}
    />
  ),
  normalizationSections: (
    <ZVerdictLegend
      notes={[
        'Z-Score toàn trường = (Điểm lớp − Trung bình toàn trường) ÷ Độ lệch chuẩn toàn trường',
        'Z-Score trong khoa = (Điểm lớp − Điểm TB khoa) ÷ Độ lệch chuẩn khoa',
        'Chênh lệch Z-Score = Z-Score trong khoa − Z-Score toàn trường',
      ]}
    />
  ),
  courses: (
    <NoteModalButton title="Chú thích các kết luận">
      <div className="z-legend">
        <p className="z-legend__note">
          Bảng này so các lớp TRONG CÙNG một học phần với nhau, để tách lỗi của học phần ra
          khỏi lỗi của người dạy.
        </p>
        <ul className="z-legend__list z-legend__list--stacked">
          {['COURSE_ISSUE', 'LECTURER_VARIANCE', 'ALL_GOOD', 'INCONCLUSIVE'].map((code) => (
            <li key={code}>
              <span className={verdictClass(code)}>{courseDiagnosisLabels[code]}</span>
              <span className="z-legend__meaning">{courseDiagnosisDescriptions[code]}</span>
            </li>
          ))}
        </ul>
      </div>
    </NoteModalButton>
  ),
  lecturer: (
    <ZVerdictLegend
      notes={[
        'Z-Score = (Điểm lớp − Trung bình nhóm so) ÷ Độ lệch chuẩn nhóm so.'
          + ' Ba cột Z dùng ba nhóm: toàn trường, các lớp cùng khoa, các lớp cùng bộ môn.',
        'Chênh so học phần = Điểm lớp − Điểm TB học phần.'
          + ' Để trống khi học phần chỉ có đúng lớp này, không có ai để so.',
        'Cột Nhận xét xét theo Z-Score trong bộ môn — nhóm so sát nhất.',
      ]}
    />
  ),
};

export const SurveyAnalysisPage: React.FC = () => {
  const { academicYears, activeSemesterId } = useSemester();

  const [tab, setTab] = useState<TabId>('normalization');

  // Mỗi tab một quyền riêng. Backend cũng chặn tại endpoint của từng tab, phần
  // này chỉ để không bày ra thứ bấm vào là 403.
  const { access } = useAuth();
  const permissions = access?.permissions;
  const visibleTabs = tabs.filter((item) => canAccessTab(permissions, 'survey-analysis', item.id));

  useEffect(() => {
    if (canAccessTab(permissions, 'survey-analysis', tab)) return;
    const fallback = firstAllowedTab(permissions, 'survey-analysis', tabs.map((item) => item.id));
    if (fallback) setTab(fallback);
  }, [permissions, tab]);
  const [semesterId, setSemesterId] = useState<string>(() =>
    activeSemesterId ? String(activeSemesterId) : ''
  );
  useEffect(() => {
    if (activeSemesterId) setSemesterId(String(activeSemesterId));
  }, [activeSemesterId]);

  const [semesterSurveys, setSemesterSurveys] = useState<SemesterSurvey[]>([]);
  const [semesterSurveyId, setSemesterSurveyId] = useState<string>('');

  const [normalization, setNormalization] = useState<SemesterSurveyNormalization | null>(null);
  const [departments, setDepartments] = useState<SemesterSurveyDepartmentSummary | null>(null);
  const [courses, setCourses] = useState<SemesterSurveyCourseDiagnosis | null>(null);
  const [lecturers, setLecturers] = useState<LecturerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!semesterId) {
        setSemesterSurveys([]);
        setSemesterSurveyId('');
        return;
      }
      try {
        const next = await surveyApi.semesterSurveys(Number(semesterId));
        if (cancelled) return;
        setSemesterSurveys(next);
        setSemesterSurveyId(next.length > 0 ? String(next[0].semesterSurveyId) : '');
        setLoadError(null);
      } catch (error) {
        if (!cancelled) setLoadError(messageFrom(error));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [semesterId]);

  const loadData = useCallback(async () => {
    if (!semesterSurveyId) {
      setNormalization(null);
      setDepartments(null);
      setCourses(null);
      setLecturers([]);
      return;
    }
    setLoading(true);
    try {
      // Nạp sẵn để chuyển tab không phải chờ lại. Riêng báo cáo cá nhân thì chỉ
      // lấy danh sách chọn, còn số liệu đợi người dùng bấm Tìm.
      const [nextNormalization, nextDepartments, nextCourses, nextLecturers] = await Promise.all([
        surveyApi.semesterSurveyNormalization(Number(semesterSurveyId)),
        surveyApi.semesterSurveyDepartmentSummary(Number(semesterSurveyId)),
        surveyApi.semesterSurveyCourseDiagnosis(Number(semesterSurveyId)),
        surveyApi.semesterSurveyLecturers(Number(semesterSurveyId)),
      ]);
      setNormalization(nextNormalization);
      setDepartments(nextDepartments);
      setCourses(nextCourses);
      setLecturers(nextLecturers);
      setLoadError(null);
    } catch (error) {
      setLoadError(messageFrom(error));
      setNormalization(null);
      setDepartments(null);
      setCourses(null);
      setLecturers([]);
    } finally {
      setLoading(false);
    }
  }, [semesterSurveyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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

  const activeTab = tabs.find((x) => x.id === tab)!;
  const canViewActiveTab = canAccessTab(permissions, 'survey-analysis', tab);
  const flipCount = normalization?.sections.filter((x) => x.verdict === 'CONCLUSION_FLIPS').length ?? 0;

  return (
    <div className="survey-operations-page survey-statistics-page">
      <section className="statistics-toolbar">
        <label className="form-group">
          <span>Học kỳ</span>
          <select value={semesterId} onChange={(event) => setSemesterId(event.target.value)}>
            <option value="">Chọn học kỳ</option>
            {semesterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="form-group">
          <span>Đợt khảo sát</span>
          <select
            value={semesterSurveyId}
            onChange={(event) => setSemesterSurveyId(event.target.value)}
            disabled={semesterSurveys.length === 0}
          >
            {semesterSurveys.length === 0 && <option value="">Chưa có đợt nào</option>}
            {semesterSurveys.map((survey) => (
              <option key={survey.semesterSurveyId} value={String(survey.semesterSurveyId)}>
                {survey.templateName} · {survey.sectionSurveyCount} lớp
              </option>
            ))}
          </select>
        </label>

        <div className="statistics-toolbar-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void loadData()}
            disabled={!semesterSurveyId || loading}
          >
            <RefreshCw aria-hidden="true" size={16} />
            Tải lại
          </button>
        </div>
      </section>

      <nav className="analysis-tabs" aria-label="Chọn bảng phân tích">
        {visibleTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === tab ? 'analysis-tab is-active' : 'analysis-tab'}
            aria-current={item.id === tab ? 'page' : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="analysis-hint-row">
        <p className="analysis-hint">{activeTab.hint}</p>
        {tabNotes[tab]}
      </div>

      {loadError && (
        <div className="admin-alert" role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      )}

      {!canViewActiveTab ? (
        <div className="operations-empty" role="status">
          <ShieldAlert className="operation-icon" aria-hidden="true" />
          <strong>Bạn không có quyền xem mục này</strong>
          <span>Liên hệ quản trị viên nếu cần mở quyền.</span>
        </div>
      ) : loading ? (
        <div className="operations-empty" role="status">
          <LoaderCircle className="operation-icon auth-spin" aria-hidden="true" />
          <strong>Đang tính toán...</strong>
        </div>
      ) : tab === 'normalization' ? (
        <NormalizationGroupTab data={normalization} />
      ) : tab === 'normalizationSections' ? (
        <NormalizationSectionTab data={normalization} flipCount={flipCount} />
      ) : tab === 'departments' ? (
        <DepartmentTab data={departments} />
      ) : tab === 'courses' ? (
        <CourseDiagnosisTab data={courses} />
      ) : (
        <LecturerTab
          semesterSurveyId={semesterSurveyId ? Number(semesterSurveyId) : null}
          lecturers={lecturers}
        />
      )}
    </div>
  );
};

// ------------------------------------------------ Chuẩn hoá điểm
// Hai bảng tách làm hai tab: xếp chồng trong một tab thì bảng dưới bị đẩy khỏi
// tầm nhìn, phải cuộn qua hết bảng khoa mới thấy.

/**
 * Dải số dùng chung cho cả hai tab chuẩn hoá — đều so với cùng mặt bằng này.
 * Chỉ hiện số nào tab đó thực sự dùng: tab mặt bằng khoa chia cho sai số chuẩn
 * σ/√n nên không đọc thẳng σ, tab từng lớp thì chia thẳng cho σ.
 */
const NormalizationSummary: React.FC<{
  data: SemesterSurveyNormalization;
  showStandardDeviation?: boolean;
  flipCount?: number;
}> = ({ data, showStandardDeviation = false, flipCount }) => (
  <section className="statistics-summary">
    <span>
      Trung bình toàn trường: <strong>{data.schoolAverageScore.toFixed(3)}</strong>
    </span>
    {showStandardDeviation && (
      <span>
        Độ lệch chuẩn:{' '}
        <strong>
          {data.schoolStandardDeviation === null ? '—' : data.schoolStandardDeviation.toFixed(3)}
        </strong>
      </span>
    )}
    <span>
      {data.schoolSectionCount} lớp có phiếu · {data.groups.length} khoa/viện
    </span>
    {flipCount !== undefined && flipCount > 0 && (
      <span className="statistics-trap-note">
        <strong>{flipCount} lớp</strong> đổi kết luận sau khi chuẩn hoá
      </span>
    )}
  </section>
);

const emptyNormalization = (
  <div className="operations-empty">
    <strong>Đợt này chưa có lớp nào thu được phiếu hợp lệ.</strong>
  </div>
);

// -------------------------------------------- Tab 1: mặt bằng từng khoa/viện

const NormalizationGroupTab: React.FC<{
  data: SemesterSurveyNormalization | null;
}> = ({ data }) => {
  const groups = useMemo(() => data?.groups ?? [], [data]);
  const groupColumns = useMemo<FilterableColumn<(typeof groups)[number]>[]>(() => [
    { key: 'facultyName', value: (row) => row.facultyName },
    { key: 'sectionCount', value: (row) => String(row.sectionCount), numeric: true },
    { key: 'averageScore', value: (row) => row.averageScore.toFixed(3), numeric: true },
    {
      key: 'standardDeviation',
      value: (row) => (row.standardDeviation === null ? '—' : row.standardDeviation.toFixed(3)),
      sortValue: (row) => row.standardDeviation,
    },
    {
      key: 'meanZScore',
      value: (row) => (row.meanZScore === null ? '—' : row.meanZScore.toFixed(2)),
      sortValue: (row) => row.meanZScore,
    },
    { key: 'verdict', value: (row) => zVerdict(row.meanZScore).label },
  ], []);
  const groupFilters = useColumnFilters(groups, groupColumns);
  const groupPagination = usePaginatedItems(groupFilters.visibleRows, analysisPageSize);

  if (!data || data.sections.length === 0) return emptyNormalization;

  return (
    <>
      <NormalizationSummary data={data} />

      <div className="analysis-group-table">
        <table className="statistics-table">
          <thead>
            <tr>
              <th scope="col">{groupFilters.filterHeader('facultyName', 'Khoa / Viện')}</th>
              <th scope="col">{groupFilters.filterHeader('sectionCount', 'Số lớp')}</th>
              <th scope="col">{groupFilters.filterHeader('averageScore', 'Điểm TB khoa')}</th>
              <th scope="col">{groupFilters.filterHeader('standardDeviation', 'Độ lệch chuẩn')}</th>
              <th
                scope="col"
                title="Điểm TB khoa lệch trung bình toàn trường bao nhiêu lần sai số chuẩn σ/√n"
              >
                {groupFilters.filterHeader('meanZScore', 'Z-Score so toàn trường')}
              </th>
              <th scope="col">{groupFilters.filterHeader('verdict', 'Nhận xét')}</th>
            </tr>
          </thead>
          <tbody>
            {groupPagination.visibleItems.map((group) => {
              const verdict = zVerdict(group.meanZScore);
              return (
                <tr key={group.facultyName}>
                  <td>{group.facultyName}</td>
                  <td className="num">{group.sectionCount}</td>
                  {/* Tô theo bậc Z chứ không theo thang điểm tuyệt đối: cả bảng này
                      đọc bằng một thước duy nhất là 68-95-99.7. */}
                  <td className={zTierClass(group.meanZScore)}>{group.averageScore.toFixed(3)}</td>
                  <td className="num">
                    {group.standardDeviation === null ? '—' : group.standardDeviation.toFixed(3)}
                  </td>
                  <td className={zTierClass(group.meanZScore)}>
                    {group.meanZScore === null
                      ? '—'
                      : `${group.meanZScore > 0 ? '+' : ''}${group.meanZScore.toFixed(2)}`}
                  </td>
                  <td>
                    <span className={verdict.className}>{verdict.label}</span>
                  </td>
                </tr>
              );
            })}
            <tr>
              <th scope="row">TOÀN TRƯỜNG</th>
              <td className="num is-sum">{data.schoolSectionCount}</td>
              <td className="num is-mean">{data.schoolAverageScore.toFixed(3)}</td>
              <td className="num is-mean">
                {data.schoolStandardDeviation === null
                  ? '—'
                  : data.schoolStandardDeviation.toFixed(3)}
              </td>
              {/* Toàn trường là chính mốc so, nên Z của nó luôn bằng 0 — để trống. */}
              <td />
              <td />
            </tr>
          </tbody>
        </table>
        <TablePagination
          page={groupPagination.page}
          pageSize={analysisPageSize}
          totalItems={groupFilters.visibleRows.length}
          itemLabel="khoa/viện"
          onPageChange={groupPagination.setPage}
        />
      </div>
    </>
  );
};

// ------------------------------------------- Tab 2: chuẩn hoá từng lớp

const NormalizationSectionTab: React.FC<{
  data: SemesterSurveyNormalization | null;
  flipCount: number;
}> = ({ data, flipCount }) => {
  const sections = useMemo(() => data?.sections ?? [], [data]);
  const sectionColumns = useMemo<FilterableColumn<(typeof sections)[number]>[]>(() => [
    { key: 'courseCode', value: (row) => row.courseCode },
    { key: 'sectionName', value: (row) => row.sectionName },
    { key: 'courseName', value: (row) => row.courseName },
    { key: 'lecturerName', value: (row) => row.lecturerName },
    { key: 'departmentName', value: (row) => row.departmentName },
    { key: 'facultyName', value: (row) => row.facultyName },
    { key: 'classSize', value: (row) => String(row.classSize), numeric: true },
    { key: 'averageScore', value: (row) => row.averageScore.toFixed(2), numeric: true },
    {
      key: 'zSchool',
      value: (row) => (row.zSchool === null ? '—' : row.zSchool.toFixed(2)),
      sortValue: (row) => row.zSchool,
    },
    {
      key: 'zFaculty',
      value: (row) => (row.zFaculty === null ? '—' : row.zFaculty.toFixed(2)),
      sortValue: (row) => row.zFaculty,
    },
    {
      key: 'zDifference',
      value: (row) => (row.zDifference === null ? '—' : row.zDifference.toFixed(2)),
      sortValue: (row) => row.zDifference,
    },
    { key: 'verdict', value: (row) => zVerdict(row.zFaculty).label },
  ], []);
  const sectionFilters = useColumnFilters(sections, sectionColumns);
  const sectionPagination = usePaginatedItems(sectionFilters.visibleRows, analysisPageSize);

  if (!data || data.sections.length === 0) return emptyNormalization;

  return (
    <>
      <NormalizationSummary data={data} showStandardDeviation flipCount={flipCount} />

      <div className="statistics-table-scroll" tabIndex={0} aria-label="Chi tiết chuẩn hoá từng lớp">
        <table className="statistics-table">
          <thead>
            <tr>
              <th className="col-left col-left-1" scope="col">
                {sectionFilters.filterHeader('courseCode', 'Mã HP')}
              </th>
              <th className="col-left col-left-2" scope="col">
                {sectionFilters.filterHeader('sectionName', 'Lớp')}
              </th>
              <th className="col-left col-left-3" scope="col">
                {sectionFilters.filterHeader('courseName', 'Học phần')}
              </th>
              <th scope="col">{sectionFilters.filterHeader('lecturerName', 'Giảng viên')}</th>
              <th scope="col">{sectionFilters.filterHeader('departmentName', 'Bộ môn')}</th>
              <th scope="col">{sectionFilters.filterHeader('facultyName', 'Khoa / Viện')}</th>
              <th scope="col">{sectionFilters.filterHeader('classSize', 'Sĩ số')}</th>
              <th scope="col">{sectionFilters.filterHeader('averageScore', 'Điểm')}</th>
              <th scope="col">{sectionFilters.filterHeader('zSchool', 'Z-Score toàn trường')}</th>
              <th scope="col">{sectionFilters.filterHeader('zFaculty', 'Z-Score trong khoa')}</th>
              <th scope="col">{sectionFilters.filterHeader('zDifference', 'Chênh lệch Z-Score')}</th>
              <th scope="col">{sectionFilters.filterHeader('verdict', 'Nhận xét')}</th>
            </tr>
          </thead>
          <tbody>
            {sectionPagination.visibleItems.map((section) => (
              <tr key={section.courseSectionSurveyId}>
                <td className="col-left col-left-1">
                  <span className="operations-code">{section.courseCode}</span>
                </td>
                <td className="col-left col-left-2">{section.sectionName}</td>
                <td className="col-left col-left-3" title={section.courseName}>
                  {section.courseName}
                </td>
                <td>{section.lecturerName}</td>
                <td>{section.departmentName}</td>
                <td>{section.facultyName}</td>
                <td className="num">{section.classSize}</td>
                <td className={zTierClass(section.zFaculty)}>
                  {section.averageScore.toFixed(2)}
                </td>
                <td className={zTierClass(section.zSchool)}>
                  {section.zSchool === null
                    ? '—'
                    : `${section.zSchool > 0 ? '+' : ''}${section.zSchool.toFixed(2)}`}
                </td>
                <td className={zTierClass(section.zFaculty)}>
                  {section.zFaculty === null
                    ? '—'
                    : `${section.zFaculty > 0 ? '+' : ''}${section.zFaculty.toFixed(2)}`}
                </td>
                <td className="num">
                  {section.zDifference === null
                    ? '—'
                    : `${section.zDifference > 0 ? '+' : ''}${section.zDifference.toFixed(2)}`}
                </td>
                <td>
                  {(() => {
                    const verdict = zVerdict(section.zFaculty);
                    return <span className={verdict.className}>{verdict.label}</span>;
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePagination
          page={sectionPagination.page}
          pageSize={analysisPageSize}
          totalItems={sectionFilters.visibleRows.length}
          itemLabel="lớp"
          onPageChange={sectionPagination.setPage}
        />
      </div>
    </>
  );
};

// -------------------------------------------- Tab 3: tổng hợp theo bộ môn

const DepartmentTab: React.FC<{ data: SemesterSurveyDepartmentSummary | null }> = ({ data }) => {
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const columns = useMemo<FilterableColumn<(typeof rows)[number]>[]>(() => [
    { key: 'facultyName', value: (row) => row.facultyName },
    { key: 'departmentName', value: (row) => row.departmentName },
    { key: 'sectionCount', value: (row) => String(row.sectionCount), numeric: true },
    { key: 'lecturerCount', value: (row) => String(row.lecturerCount), numeric: true },
    { key: 'totalClassSize', value: (row) => String(row.totalClassSize), numeric: true },
    { key: 'responseCount', value: (row) => String(row.responseCount), numeric: true },
    { key: 'validResponseCount', value: (row) => String(row.validResponseCount), numeric: true },
    {
      key: 'validResponseRate',
      value: (row) => `${row.validResponseRate.toFixed(1)}%`,
      sortValue: (row) => row.validResponseRate,
    },
    {
      key: 'averageScore',
      value: (row) => (row.averageScore === null ? '—' : row.averageScore.toFixed(2)),
      sortValue: (row) => row.averageScore,
    },
    { key: 'warningSectionCount', value: (row) => String(row.warningSectionCount), numeric: true },
  ], []);
  const filters = useColumnFilters(rows, columns);
  const pagination = usePaginatedItems(filters.visibleRows, analysisPageSize);

  if (!data || data.rows.length === 0) {
    return (
      <div className="operations-empty">
        <strong>Đợt này chưa có bộ môn nào thu được phiếu hợp lệ.</strong>
      </div>
    );
  }

  // Dòng tổng lấy thẳng số toàn trường từ backend chứ không cộng lại từ `rows`.
  // Trưởng bộ môn chỉ nhận đúng dòng bộ môn mình, cộng lại thì mất mặt bằng để so.
  const totalSections = data.schoolSectionCount;
  const totalResponses = data.schoolResponseCount;
  const totalWarnings = data.schoolWarningCount;
  const overallScore = data.schoolAverageScore;
  // Dòng tổng cộng từ các dòng đang hiện. Trưởng bộ môn chỉ thấy dòng của mình
  // nên hai số này là của bộ môn đó, khác các số toàn trường ở trên.
  const totalClassSize = rows.reduce((sum, row) => sum + row.totalClassSize, 0);
  const totalValidResponses = rows.reduce((sum, row) => sum + row.validResponseCount, 0);
  const isScoped = data.rows.length < data.schoolDepartmentCount;

  return (
    <>
      <section className="statistics-summary">
        <span>
          {isScoped
            ? `${data.rows.length} bộ môn của bạn · toàn trường ${data.schoolDepartmentCount} bộ môn`
            : `${data.rows.length} bộ môn`}
          {' · '}{totalSections} lớp có phiếu
        </span>
        <span>
          Tổng phiếu toàn trường: <strong>{totalResponses}</strong>
        </span>
        {totalWarnings > 0 && (
          <span className="statistics-trap-note">
            <strong>{totalWarnings} lớp</strong> thấp hơn trung bình toàn trường từ 1 độ lệch
            chuẩn trở lên (Z-Score ≤ −1)
          </span>
        )}
      </section>

      <div className="statistics-table-scroll" tabIndex={0} aria-label="Tổng hợp theo bộ môn">
        <table className="statistics-table statistics-table--fill">
          <thead>
            <tr>
              <th className="col-left col-dept-1" scope="col">
                {filters.filterHeader('facultyName', 'Khoa / Viện')}
              </th>
              <th className="col-left col-dept-2" scope="col">
                {filters.filterHeader('departmentName', 'Bộ môn')}
              </th>
              <th scope="col">{filters.filterHeader('sectionCount', 'Số lớp')}</th>
              <th scope="col">{filters.filterHeader('lecturerCount', 'Số GV')}</th>
              <th scope="col">{filters.filterHeader('totalClassSize', 'Tổng sĩ số')}</th>
              <th scope="col">{filters.filterHeader('responseCount', 'Số phiếu thu về')}</th>
              <th scope="col">{filters.filterHeader('validResponseCount', 'Số phiếu hợp lệ')}</th>
              <th scope="col" title="Số phiếu hợp lệ chia tổng sĩ số">
                {filters.filterHeader('validResponseRate', 'Tỷ lệ phiếu hợp lệ')}
              </th>
              <th scope="col">{filters.filterHeader('averageScore', 'Điểm trung bình')}</th>
              <th
                scope="col"
                title="Lớp có điểm thấp hơn trung bình toàn trường từ 1 độ lệch chuẩn trở lên"
              >
                {filters.filterHeader('warningSectionCount', 'Lớp cảnh báo')}
              </th>
            </tr>
          </thead>
          <tbody>
            {pagination.visibleItems.map((row) => (
              <tr key={`${row.facultyName}-${row.departmentName}`}>
                <td className="col-left col-dept-1" title={row.facultyName}>
                  {row.facultyName}
                </td>
                <td className="col-left col-dept-2" title={row.departmentName}>
                  {row.departmentName}
                </td>
                <td className="num">{row.sectionCount}</td>
                <td className="num">{row.lecturerCount}</td>
                <td className="num">{row.totalClassSize}</td>
                <td className="num">{row.responseCount}</td>
                <td className="num">{row.validResponseCount}</td>
                <td className="num">{row.validResponseRate.toFixed(1)}%</td>
                <td className={scoreClass(row.averageScore)}>
                  {row.averageScore === null ? '—' : row.averageScore.toFixed(2)}
                </td>
                <td className={row.warningSectionCount > 0 ? 'num is-flagged' : 'num'}>
                  {row.warningSectionCount}
                </td>
              </tr>
            ))}
            {/* Ô đệm nuốt chỗ thừa để dòng tổng kết luôn nằm sát đáy khung. */}
            <tr className="table-spacer" aria-hidden="true">
              <td colSpan={10} />
            </tr>
          </tbody>

          <tfoot>
            <tr>
              <th className="col-left col-dept-1" scope="row">Toàn trường</th>
              <td className="col-left col-dept-2">{data.schoolDepartmentCount} bộ môn</td>
              <td className="num is-sum">{totalSections}</td>
              <td />
              <td className="num is-sum">{totalClassSize}</td>
              <td className="num is-sum">{totalResponses}</td>
              <td className="num is-sum">{totalValidResponses}</td>
              <td className="num is-mean">
                {totalClassSize === 0
                  ? '—'
                  : `${((totalValidResponses / totalClassSize) * 100).toFixed(1)}%`}
              </td>
              <td className="num is-mean is-total">
                {overallScore === null ? '—' : overallScore.toFixed(2)}
              </td>
              <td className="num is-sum">{totalWarnings}</td>
            </tr>
          </tfoot>
        </table>
        <TablePagination
          page={pagination.page}
          pageSize={analysisPageSize}
          totalItems={filters.visibleRows.length}
          itemLabel="bộ môn"
          onPageChange={pagination.setPage}
        />
      </div>
    </>
  );
};

// ------------------------------------------- Tab 4: chẩn đoán học phần

/** Biên độ rộng thì tô đỏ — đó chính là tín hiệu để đọc bảng này. */
function spreadClass(spread: number): string {
  return spread >= 0.8 ? 'num is-flagged' : 'num';
}

const CourseDiagnosisTab: React.FC<{ data: SemesterSurveyCourseDiagnosis | null }> = ({ data }) => {
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const columns = useMemo<FilterableColumn<(typeof rows)[number]>[]>(() => [
    { key: 'courseCode', value: (row) => row.courseCode },
    { key: 'courseName', value: (row) => row.courseName },
    { key: 'departmentName', value: (row) => row.departmentName },
    { key: 'facultyName', value: (row) => row.facultyName },
    { key: 'sectionCount', value: (row) => String(row.sectionCount), numeric: true },
    { key: 'lecturerCount', value: (row) => String(row.lecturerCount), numeric: true },
    { key: 'averageScore', value: (row) => row.averageScore.toFixed(2), numeric: true },
    { key: 'minScore', value: (row) => row.minScore.toFixed(2), numeric: true },
    { key: 'maxScore', value: (row) => row.maxScore.toFixed(2), numeric: true },
    { key: 'spread', value: (row) => row.spread.toFixed(2), numeric: true },
    {
      key: 'weakestQuestionOrder',
      value: (row) => (row.weakestQuestionOrder === null ? '—' : `C${row.weakestQuestionOrder}`),
      sortValue: (row) => row.weakestQuestionOrder,
    },
    {
      key: 'weakestQuestionScore',
      value: (row) => (row.weakestQuestionScore === null ? '—' : row.weakestQuestionScore.toFixed(2)),
      sortValue: (row) => row.weakestQuestionScore,
    },
    { key: 'verdict', value: (row) => courseDiagnosisLabels[row.verdict] ?? row.verdict },
  ], []);
  const filters = useColumnFilters(rows, columns);
  const pagination = usePaginatedItems(filters.visibleRows, analysisPageSize);

  if (!data || data.rows.length === 0) {
    return (
      <div className="operations-empty">
        <strong>Đợt này chưa có học phần nào thu được phiếu hợp lệ.</strong>
      </div>
    );
  }

  const courseIssue = data.rows.filter((row) => row.verdict === 'COURSE_ISSUE').length;
  const lecturerVariance = data.rows.filter((row) => row.verdict === 'LECTURER_VARIANCE').length;
  const allGood = data.rows.filter((row) => row.verdict === 'ALL_GOOD').length;
  const multiSection = data.rows.filter((row) => row.sectionCount > 1).length;

  return (
    <>
      <section className="statistics-summary">
        <span>
          <strong>{data.rows.length}</strong> học phần thu được phiếu, trong đó{' '}
          <strong>{multiSection}</strong> học phần có từ 2 lớp trở lên nên mới so được các
          lớp với nhau
        </span>
        <span>
          <strong>{allGood}</strong> học phần tốt đều — lớp thấp điểm nhất vẫn đạt từ 4.00
        </span>
        {courseIssue > 0 && (
          <span className="statistics-trap-note">
            <strong>{courseIssue} học phần</strong> lỗi do học phần — lớp cao điểm nhất cũng
            ở mức cảnh báo
          </span>
        )}
        {lecturerVariance > 0 && (
          <span className="statistics-trap-note">
            <strong>{lecturerVariance} học phần</strong> lỗi do giảng viên — cùng học phần
            nhưng các lớp chấm chênh nhau nhiều
          </span>
        )}
      </section>

      <div className="statistics-table-scroll" tabIndex={0} aria-label="Chẩn đoán theo học phần">
        <table className="statistics-table">
          <thead>
            <tr>
              <th className="col-left col-course-1" scope="col">
                {filters.filterHeader('courseCode', 'Mã HP')}
              </th>
              <th className="col-left col-course-2" scope="col">
                {filters.filterHeader('courseName', 'Học phần')}
              </th>
              <th scope="col">{filters.filterHeader('departmentName', 'Bộ môn')}</th>
              <th scope="col">{filters.filterHeader('facultyName', 'Khoa / Viện')}</th>
              <th scope="col">{filters.filterHeader('sectionCount', 'Số lớp')}</th>
              <th scope="col">{filters.filterHeader('lecturerCount', 'Số GV')}</th>
              <th scope="col">{filters.filterHeader('averageScore', 'Điểm TB')}</th>
              <th scope="col">{filters.filterHeader('minScore', 'Lớp thấp nhất')}</th>
              <th scope="col">{filters.filterHeader('maxScore', 'Lớp cao nhất')}</th>
              <th scope="col" title="Điểm lớp cao nhất trừ điểm lớp thấp nhất">
                {filters.filterHeader('spread', 'Chênh lệch giữa các lớp')}
              </th>
              <th scope="col">{filters.filterHeader('weakestQuestionOrder', 'Câu hỏi yếu nhất')}</th>
              <th scope="col">{filters.filterHeader('weakestQuestionScore', 'Điểm câu yếu')}</th>
              <th scope="col">{filters.filterHeader('verdict', 'Kết luận')}</th>
            </tr>
          </thead>
          <tbody>
            {pagination.visibleItems.map((row) => (
              <tr key={row.courseId}>
                <td className="col-left col-course-1">
                  <span className="operations-code">{row.courseCode}</span>
                </td>
                <td className="col-left col-course-2" title={row.courseName}>
                  {row.courseName}
                </td>
                <td>{row.departmentName}</td>
                <td>{row.facultyName}</td>
                <td className="num">{row.sectionCount}</td>
                <td className="num">{row.lecturerCount}</td>
                <td className={scoreClass(row.averageScore)}>{row.averageScore.toFixed(2)}</td>
                <td className={scoreClass(row.minScore)}>{row.minScore.toFixed(2)}</td>
                <td className={scoreClass(row.maxScore)}>{row.maxScore.toFixed(2)}</td>
                <td className={spreadClass(row.spread)}>{row.spread.toFixed(2)}</td>
                <td title={row.weakestQuestionText ?? undefined}>
                  {row.weakestQuestionOrder === null ? '—' : `C${row.weakestQuestionOrder}`}
                </td>
                <td className="num">
                  {row.weakestQuestionScore === null ? '—' : row.weakestQuestionScore.toFixed(2)}
                </td>
                <td>
                  <span
                    className={verdictClass(row.verdict)}
                    title={courseDiagnosisDescriptions[row.verdict]}
                  >
                    {courseDiagnosisLabels[row.verdict] ?? row.verdict}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePagination
          page={pagination.page}
          pageSize={analysisPageSize}
          totalItems={filters.visibleRows.length}
          itemLabel="học phần"
          onPageChange={pagination.setPage}
        />
      </div>
    </>
  );
};

// ------------------------------------------ Tab 5: báo cáo cá nhân giảng viên

const LecturerTab: React.FC<{
  semesterSurveyId: number | null;
  lecturers: LecturerOption[];
}> = ({ semesterSurveyId, lecturers }) => {
  const lecturerListId = useId();
  const [faculty, setFaculty] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [report, setReport] = useState<LecturerReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Đổi đợt thì kết quả cũ không còn đúng nữa, xoá đi để không hiểu nhầm.
  useEffect(() => {
    setFaculty('');
    setQuery('');
    setReport(null);
    setError(null);
  }, [semesterSurveyId]);

  const faculties = useMemo(
    () => [...new Set(lecturers.map((x) => x.facultyName))].sort((a, b) => a.localeCompare(b, 'vi')),
    [lecturers]
  );

  // Hai ô lọc nối tầng: chọn khoa thì danh sách giảng viên co theo.
  const visibleLecturers = useMemo(
    () => lecturers.filter((x) => !faculty || x.facultyName === faculty),
    [lecturers, faculty]
  );

  // Ô giảng viên gõ được nên nhãn phải phân biệt được từng người: trùng tên thì
  // ghi kèm bộ môn, vẫn trùng nữa thì kèm mã để không bao giờ có hai nhãn giống nhau.
  const lecturerChoices = useMemo(() => {
    const nameCount = new Map<string, number>();
    for (const item of visibleLecturers) {
      nameCount.set(item.fullName, (nameCount.get(item.fullName) ?? 0) + 1);
    }
    const usedLabels = new Set<string>();
    return visibleLecturers.map((item) => {
      let label = (nameCount.get(item.fullName) ?? 0) > 1
        ? `${item.fullName} · ${item.departmentName}`
        : item.fullName;
      if (usedLabels.has(label)) label = `${label} · #${item.lecturerId}`;
      usedLabels.add(label);
      return { ...item, label };
    });
  }, [visibleLecturers]);

  // Gõ khớp đúng một nhãn thì mới coi là đã chọn; gõ dở dang thì nút Tìm khoá lại.
  const activeLecturer = useMemo(
    () => lecturerChoices.find((x) => x.label === query.trim()) ?? null,
    [lecturerChoices, query]
  );

  // Đang gõ thì lọc theo những gì đã gõ; vừa chọn xong thì ô chứa đúng nhãn của
  // người đó, lúc ấy vẫn hiện cả danh sách để còn đổi sang người khác.
  const menuChoices = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('vi');
    if (!needle || activeLecturer) return lecturerChoices;
    return lecturerChoices.filter((x) => x.label.toLocaleLowerCase('vi').includes(needle));
  }, [lecturerChoices, query, activeLecturer]);

  useEffect(() => {
    setHighlight(0);
  }, [menuChoices]);

  const pick = (label: string) => {
    setQuery(label);
    setMenuOpen(false);
  };

  const onPickerKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setMenuOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!menuOpen) {
        setMenuOpen(true);
        return;
      }
      if (menuChoices.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setHighlight((current) => (current + step + menuChoices.length) % menuChoices.length);
      return;
    }
    if (event.key === 'Enter' && menuOpen && menuChoices[highlight]) {
      event.preventDefault();
      pick(menuChoices[highlight].label);
    }
  };

  const search = async () => {
    if (!semesterSurveyId || !activeLecturer) return;
    setLoading(true);
    try {
      setReport(await surveyApi.lecturerReport(semesterSurveyId, activeLecturer.lecturerId));
      setError(null);
    } catch (loadError) {
      setError(messageFrom(loadError));
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  if (lecturers.length === 0) {
    return (
      <div className="operations-empty">
        <strong>Đợt này chưa có giảng viên nào gắn được với lớp có phiếu.</strong>
      </div>
    );
  }

  return (
    <>
      <section className="statistics-toolbar analysis-picker">
        <label className="form-group">
          <span>Khoa / Viện</span>
          <select
            value={faculty}
            onChange={(event) => {
              setFaculty(event.target.value);
              setQuery('');
            }}
          >
            <option value="">Tất cả khoa / viện</option>
            {faculties.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <div
          className="form-group analysis-combobox"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false);
          }}
        >
          <span>
            Giảng viên ({visibleLecturers.length})
            {activeLecturer && ` · ${activeLecturer.sectionCount} lớp`}
          </span>
          <div className="analysis-combobox__control">
            <input
              type="text"
              role="combobox"
              aria-expanded={menuOpen}
              aria-controls={lecturerListId}
              aria-autocomplete="list"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setMenuOpen(true);
              }}
              onFocus={() => setMenuOpen(true)}
              // Chọn xong menu đóng nhưng ô vẫn giữ focus, nên bấm lại phải mở
              // lại được bằng onClick — onFocus lúc đó không bắn nữa.
              onClick={() => setMenuOpen(true)}
              onKeyDown={onPickerKeyDown}
              placeholder="Gõ tên hoặc chọn trong danh sách..."
              autoComplete="off"
            />
            <ChevronDown className="analysis-combobox__caret" aria-hidden="true" size={16} />
          </div>

          {menuOpen && (
            /* Giữ chuột trên danh sách không được làm ô nhập mất focus, nếu không
               onBlur đóng menu trước khi kịp nhận cú bấm chọn. */
            <ul
              className="analysis-combobox__menu"
              id={lecturerListId}
              role="listbox"
              onMouseDown={(event) => event.preventDefault()}
            >
              {menuChoices.length === 0 ? (
                <li className="analysis-combobox__empty">Không có giảng viên nào khớp.</li>
              ) : (
                menuChoices.map((lecturer, index) => (
                  <li
                    key={lecturer.lecturerId}
                    className="analysis-combobox__option"
                    role="option"
                    aria-selected={index === highlight}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => pick(lecturer.label)}
                  >
                    <span>{lecturer.label}</span>
                    <small>{lecturer.sectionCount} lớp</small>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <div className="statistics-toolbar-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void search()}
            disabled={!activeLecturer || loading}
          >
            <Search aria-hidden="true" size={16} />
            Tìm
          </button>
        </div>
      </section>

      {error && (
        <div className="admin-alert" role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="operations-empty" role="status">
          <LoaderCircle className="operation-icon auth-spin" aria-hidden="true" />
          <strong>Đang tính toán...</strong>
        </div>
      ) : report === null ? (
        <div className="operations-empty">
          <strong>Chọn một giảng viên rồi bấm Tìm để xem báo cáo.</strong>
        </div>
      ) : (
        <LecturerReportView report={report} />
      )}
    </>
  );
};

const LecturerReportView: React.FC<{ report: LecturerReport }> = ({ report }) => {
  const columns = useMemo<FilterableColumn<LecturerReport['sections'][number]>[]>(() => [
    { key: 'courseCode', value: (row) => row.courseCode },
    { key: 'courseName', value: (row) => row.courseName },
    { key: 'sectionName', value: (row) => row.sectionName },
    { key: 'classSize', value: (row) => String(row.classSize), numeric: true },
    { key: 'responseCount', value: (row) => String(row.responseCount), numeric: true },
    { key: 'validResponseCount', value: (row) => String(row.validResponseCount), numeric: true },
    {
      key: 'validResponseRate',
      value: (row) => `${row.validResponseRate.toFixed(1)}%`,
      sortValue: (row) => row.validResponseRate,
    },
    { key: 'averageScore', value: (row) => row.averageScore.toFixed(2), numeric: true },
    {
      key: 'courseAverageScore',
      value: (row) => (row.courseAverageScore === null ? '—' : row.courseAverageScore.toFixed(2)),
      sortValue: (row) => row.courseAverageScore,
    },
    {
      key: 'differenceFromCourse',
      value: (row) => (row.differenceFromCourse === null ? '—' : row.differenceFromCourse.toFixed(2)),
      sortValue: (row) => row.differenceFromCourse,
    },
    {
      key: 'zSchool',
      value: (row) => (row.zSchool === null ? '—' : row.zSchool.toFixed(2)),
      sortValue: (row) => row.zSchool,
    },
    {
      key: 'zFaculty',
      value: (row) => (row.zFaculty === null ? '—' : row.zFaculty.toFixed(2)),
      sortValue: (row) => row.zFaculty,
    },
    {
      key: 'zDepartment',
      value: (row) => (row.zDepartment === null ? '—' : row.zDepartment.toFixed(2)),
      sortValue: (row) => row.zDepartment,
    },
    { key: 'verdict', value: (row) => zVerdict(row.zDepartment).label },
  ], []);
  const filters = useColumnFilters(report.sections, columns);
  const totalClassSize = report.sections.reduce((sum, row) => sum + row.classSize, 0);
  const overallRate =
    totalClassSize === 0 ? 0 : (report.totalResponseCount / totalClassSize) * 100;

  return (
    <>
      <section className="statistics-summary">
        <span className="summary-title">{report.fullName}</span>
        <span>
          {report.departmentName} · {report.facultyName}
        </span>
        <span>
          {report.sectionCount} lớp · {report.totalResponseCount} phiếu
        </span>
        <span>
          Tỷ lệ phản hồi: <strong>{overallRate.toFixed(1)}%</strong>
        </span>
        <span>
          Điểm trung bình: <strong>{report.averageScore.toFixed(2)}</strong>
        </span>
      </section>

      <div className="analysis-section analysis-section--grow">
        <h4 className="analysis-section-title">Các lớp giảng dạy trong kỳ</h4>
        <div
          className="statistics-table-scroll"
          tabIndex={0}
          aria-label="Các lớp giảng dạy trong kỳ"
        >
          <table className="statistics-table">
            <thead>
              <tr>
                <th scope="col">{filters.filterHeader('courseCode', 'Mã HP')}</th>
                <th scope="col">{filters.filterHeader('courseName', 'Học phần')}</th>
                <th scope="col">{filters.filterHeader('sectionName', 'Lớp')}</th>
                <th scope="col">{filters.filterHeader('classSize', 'Sĩ số')}</th>
                <th scope="col">{filters.filterHeader('responseCount', 'Số phiếu thu về')}</th>
                <th scope="col">{filters.filterHeader('validResponseCount', 'Số phiếu hợp lệ')}</th>
                <th scope="col" title="Số phiếu hợp lệ chia sĩ số">
                  {filters.filterHeader('validResponseRate', 'Tỷ lệ phiếu hợp lệ')}
                </th>
                <th scope="col">{filters.filterHeader('averageScore', 'Điểm')}</th>
                <th scope="col" title="Trung bình mọi lớp cùng học phần, kể cả lớp người khác dạy">
                  {filters.filterHeader('courseAverageScore', 'Điểm TB học phần')}
                </th>
                <th scope="col">{filters.filterHeader('differenceFromCourse', 'Chênh so học phần')}</th>
                <th scope="col">{filters.filterHeader('zSchool', 'Z-Score toàn trường')}</th>
                <th scope="col">{filters.filterHeader('zFaculty', 'Z-Score trong khoa')}</th>
                <th scope="col">{filters.filterHeader('zDepartment', 'Z-Score trong bộ môn')}</th>
                <th scope="col">{filters.filterHeader('verdict', 'Nhận xét')}</th>
              </tr>
            </thead>
            <tbody>
              {filters.visibleRows.map((section) => {
                const verdict = zVerdict(section.zDepartment);
                return (
                  <tr key={section.courseSectionSurveyId}>
                    <td>
                      <span className="operations-code">{section.courseCode}</span>
                    </td>
                    <td title={section.courseName}>{section.courseName}</td>
                    <td>{section.sectionName}</td>
                    <td className="num">{section.classSize}</td>
                    <td className="num">{section.responseCount}</td>
                    <td className="num">{section.validResponseCount}</td>
                    <td className="num">{section.validResponseRate.toFixed(1)}%</td>
                    <td className={zTierClass(section.zDepartment)}>
                      {section.averageScore.toFixed(2)}
                    </td>
                    <td className="num">
                      {section.courseAverageScore === null
                        ? '—'
                        : section.courseAverageScore.toFixed(2)}
                    </td>
                    <td className="num">
                      {section.differenceFromCourse === null ? (
                        '—'
                      ) : (
                        <span
                          className={
                            section.differenceFromCourse < 0
                              ? 'delta--down'
                              : section.differenceFromCourse > 0
                                ? 'delta--up'
                                : undefined
                          }
                        >
                          {section.differenceFromCourse > 0 ? '+' : ''}
                          {section.differenceFromCourse.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className={zTierClass(section.zSchool)}>
                      {section.zSchool === null
                        ? '—'
                        : `${section.zSchool > 0 ? '+' : ''}${section.zSchool.toFixed(2)}`}
                    </td>
                    <td className={zTierClass(section.zFaculty)}>
                      {section.zFaculty === null
                        ? '—'
                        : `${section.zFaculty > 0 ? '+' : ''}${section.zFaculty.toFixed(2)}`}
                    </td>
                    <td className={zTierClass(section.zDepartment)}>
                      {section.zDepartment === null
                        ? '—'
                        : `${section.zDepartment > 0 ? '+' : ''}${section.zDepartment.toFixed(2)}`}
                    </td>
                    <td>
                      <span className={verdict.className}>{verdict.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};
