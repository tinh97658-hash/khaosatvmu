import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleAlert, LoaderCircle, RefreshCw, Search } from 'lucide-react';
import { useSemester } from '../context/semesterContext';
import { TablePagination } from '../components/TablePagination';
import { usePaginatedItems } from '../hooks/usePaginatedItems';
import { ApiError } from '../services/apiClient';
import {
  courseDiagnosisLabels,
  normalizationVerdictLabels,
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

type TabId = 'normalization' | 'departments' | 'courses' | 'lecturer';

const tabs: { id: TabId; label: string; hint: string }[] = [
  {
    id: 'normalization',
    label: 'Chuẩn hoá điểm',
    hint: 'So điểm thô giữa các lớp khác khoa là so sai. Z-score đưa mọi lớp về cùng một thước.',
  },
  {
    id: 'departments',
    label: 'Tổng hợp theo bộ môn',
    hint: 'Phục vụ trưởng khoa: mỗi dòng là một bộ môn trong đợt khảo sát.',
  },
  {
    id: 'courses',
    label: 'Chẩn đoán học phần',
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

/** Z âm nhiều thì tô đỏ, dương nhiều thì tô xanh. */
function zClass(value: number | null): string {
  if (value === null) return 'num';
  if (value <= -1) return 'num score-band score-band--bad';
  if (value >= 1) return 'num score-band score-band--good';
  return 'num';
}

export const SurveyAnalysisPage: React.FC = () => {
  const { academicYears, activeSemesterId } = useSemester();

  const [tab, setTab] = useState<TabId>('normalization');
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
        {tabs.map((item) => (
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

      <p className="analysis-hint">{activeTab.hint}</p>

      {loadError && (
        <div className="admin-alert" role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      )}

      {loading ? (
        <div className="operations-empty" role="status">
          <LoaderCircle className="operation-icon auth-spin" aria-hidden="true" />
          <strong>Đang tính toán...</strong>
        </div>
      ) : tab === 'normalization' ? (
        <NormalizationTab data={normalization} flipCount={flipCount} />
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

// ------------------------------------------------ Tab 1: chuẩn hoá điểm

const NormalizationTab: React.FC<{
  data: SemesterSurveyNormalization | null;
  flipCount: number;
}> = ({ data, flipCount }) => {
  const groups = useMemo(() => data?.groups ?? [], [data]);
  const sections = useMemo(() => data?.sections ?? [], [data]);
  const groupPagination = usePaginatedItems(groups, analysisPageSize);
  const sectionPagination = usePaginatedItems(sections, analysisPageSize);

  if (!data || data.sections.length === 0) {
    return (
      <div className="operations-empty">
        <strong>Đợt này chưa có lớp nào thu được phiếu hợp lệ.</strong>
      </div>
    );
  }

  return (
    <>
      <section className="statistics-summary">
        <span>
          Mặt bằng toàn đợt: <strong>{data.schoolAverageScore.toFixed(2)}</strong>
        </span>
        <span>
          Độ lệch chuẩn:{' '}
          <strong>
            {data.schoolStandardDeviation === null
              ? '—'
              : data.schoolStandardDeviation.toFixed(3)}
          </strong>
        </span>
        <span>
          {data.schoolSectionCount} lớp có phiếu · {data.groups.length} khoa/viện
        </span>
        {flipCount > 0 && (
          <span className="statistics-trap-note">
            <strong>{flipCount} lớp</strong> đổi kết luận sau khi chuẩn hoá
          </span>
        )}
      </section>

      <div className="analysis-group-table">
        <table className="statistics-table">
          <thead>
            <tr>
              <th scope="col">Khoa / Viện</th>
              <th scope="col">Số lớp</th>
              <th scope="col">Điểm TB khoa</th>
              <th scope="col">Độ lệch chuẩn</th>
              <th scope="col">Chuẩn hoá được</th>
            </tr>
          </thead>
          <tbody>
            {groupPagination.visibleItems.map((group) => (
              <tr key={group.facultyName}>
                <td>{group.facultyName}</td>
                <td className="num">{group.sectionCount}</td>
                <td className={scoreClass(group.averageScore)}>{group.averageScore.toFixed(3)}</td>
                <td className="num">
                  {group.standardDeviation === null ? '—' : group.standardDeviation.toFixed(3)}
                </td>
                <td>
                  {group.canNormalize ? (
                    'Có'
                  ) : (
                    <span className="verdict verdict--muted">Quá ít lớp</span>
                  )}
                </td>
              </tr>
            ))}
            <tr>
              <th scope="row">TOÀN TRƯỜNG</th>
              <td className="num is-sum">{data.schoolSectionCount}</td>
              <td className="num is-mean">{data.schoolAverageScore.toFixed(3)}</td>
              <td className="num is-mean">
                {data.schoolStandardDeviation === null
                  ? '—'
                  : data.schoolStandardDeviation.toFixed(3)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
        <TablePagination
          page={groupPagination.page}
          pageSize={analysisPageSize}
          totalItems={data.groups.length}
          itemLabel="khoa/viện"
          onPageChange={groupPagination.setPage}
        />
      </div>

      <div className="statistics-table-scroll" tabIndex={0} aria-label="Chi tiết chuẩn hoá từng lớp">
        <table className="statistics-table">
          <thead>
            <tr>
              <th className="col-left col-left-1" scope="col">Mã HP</th>
              <th className="col-left col-left-2" scope="col">Lớp</th>
              <th className="col-left col-left-3" scope="col">Học phần</th>
              <th scope="col">Giảng viên</th>
              <th scope="col">Khoa / Viện</th>
              <th scope="col">Sĩ số</th>
              <th scope="col">Điểm</th>
              <th scope="col">Z toàn trường</th>
              <th scope="col">Z trong khoa</th>
              <th scope="col">Chênh 2 cách</th>
              <th scope="col">Diễn giải</th>
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
                <td>{section.facultyName}</td>
                <td className="num">{section.classSize}</td>
                <td className={scoreClass(section.averageScore)}>
                  {section.averageScore.toFixed(2)}
                </td>
                <td className={zClass(section.zSchool)}>
                  {section.zSchool === null ? '—' : section.zSchool.toFixed(2)}
                </td>
                <td className={zClass(section.zFaculty)}>
                  {section.zFaculty === null ? '—' : section.zFaculty.toFixed(2)}
                </td>
                <td className="num">
                  {section.zDifference === null
                    ? '—'
                    : `${section.zDifference > 0 ? '+' : ''}${section.zDifference.toFixed(2)}`}
                </td>
                <td>
                  <span className={verdictClass(section.verdict)}>
                    {normalizationVerdictLabels[section.verdict] ?? section.verdict}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePagination
          page={sectionPagination.page}
          pageSize={analysisPageSize}
          totalItems={data.sections.length}
          itemLabel="lớp"
          onPageChange={sectionPagination.setPage}
        />
      </div>
    </>
  );
};

// -------------------------------------------- Tab 2: tổng hợp theo bộ môn

const DepartmentTab: React.FC<{ data: SemesterSurveyDepartmentSummary | null }> = ({ data }) => {
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const pagination = usePaginatedItems(rows, analysisPageSize);

  if (!data || data.rows.length === 0) {
    return (
      <div className="operations-empty">
        <strong>Đợt này chưa có bộ môn nào thu được phiếu hợp lệ.</strong>
      </div>
    );
  }

  const totalSections = data.rows.reduce((sum, row) => sum + row.sectionCount, 0);
  const totalResponses = data.rows.reduce((sum, row) => sum + row.responseCount, 0);
  const totalWarnings = data.rows.reduce((sum, row) => sum + row.warningSectionCount, 0);
  const scored = data.rows.filter((row) => row.averageScore !== null);
  const overallScore =
    scored.length === 0
      ? null
      : scored.reduce((sum, row) => sum + row.averageScore!, 0) / scored.length;

  return (
    <>
      <section className="statistics-summary">
        <span>
          {data.rows.length} bộ môn · {totalSections} lớp có phiếu
        </span>
        <span>
          Tổng phiếu: <strong>{totalResponses}</strong>
        </span>
        {totalWarnings > 0 && (
          <span className="statistics-trap-note">
            <strong>{totalWarnings} lớp</strong> dưới ngưỡng {lowScore.toFixed(2)}
          </span>
        )}
      </section>

      <div className="statistics-table-scroll" tabIndex={0} aria-label="Tổng hợp theo bộ môn">
        <table className="statistics-table statistics-table--fill">
          <thead>
            <tr>
              <th className="col-left col-dept-1" scope="col">Khoa / Viện</th>
              <th className="col-left col-dept-2" scope="col">Bộ môn</th>
              <th scope="col">Số lớp</th>
              <th scope="col">Số GV</th>
              <th scope="col">Số phiếu</th>
              <th scope="col">Tỷ lệ PH BQ</th>
              <th scope="col">Điểm tổng hợp</th>
              <th scope="col">Lớp cảnh báo</th>
              <th scope="col">Câu hỏi yếu nhất</th>
              <th scope="col">Điểm câu yếu</th>
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
                <td className="num">{row.responseCount}</td>
                <td className="num">{row.averageCompletionRate.toFixed(1)}%</td>
                <td className={scoreClass(row.averageScore)}>
                  {row.averageScore === null ? '—' : row.averageScore.toFixed(2)}
                </td>
                <td className={row.warningSectionCount > 0 ? 'num is-flagged' : 'num'}>
                  {row.warningSectionCount}
                </td>
                <td title={row.weakestQuestionText ?? undefined}>
                  {row.weakestQuestionOrder === null ? '—' : `C${row.weakestQuestionOrder}`}
                </td>
                <td className="num">
                  {row.weakestQuestionScore === null ? '—' : row.weakestQuestionScore.toFixed(2)}
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
              <th className="col-left col-dept-1" scope="row">Tổng kết</th>
              <td className="col-left col-dept-2">{data.rows.length} bộ môn</td>
              <td className="num is-sum">{totalSections}</td>
              <td />
              <td className="num is-sum">{totalResponses}</td>
              <td />
              <td className="num is-mean is-total">
                {overallScore === null ? '—' : overallScore.toFixed(2)}
              </td>
              <td className="num is-sum">{totalWarnings}</td>
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
        <TablePagination
          page={pagination.page}
          pageSize={analysisPageSize}
          totalItems={data.rows.length}
          itemLabel="bộ môn"
          onPageChange={pagination.setPage}
        />
      </div>
    </>
  );
};

// ------------------------------------------- Tab 3: chẩn đoán học phần

/** Biên độ rộng thì tô đỏ — đó chính là tín hiệu để đọc bảng này. */
function spreadClass(spread: number): string {
  return spread >= 0.8 ? 'num is-flagged' : 'num';
}

const CourseDiagnosisTab: React.FC<{ data: SemesterSurveyCourseDiagnosis | null }> = ({ data }) => {
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const pagination = usePaginatedItems(rows, analysisPageSize);

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
          {data.rows.length} học phần · {multiSection} học phần có từ 2 lớp trở lên
        </span>
        <span>
          Nên nhân rộng: <strong>{allGood}</strong>
        </span>
        {courseIssue > 0 && (
          <span className="statistics-trap-note">
            <strong>{courseIssue} học phần</strong> mọi lớp đều thấp
          </span>
        )}
        {lecturerVariance > 0 && (
          <span className="statistics-trap-note">
            <strong>{lecturerVariance} học phần</strong> chênh lệch lớn giữa các lớp
          </span>
        )}
      </section>

      <div className="statistics-table-scroll" tabIndex={0} aria-label="Chẩn đoán theo học phần">
        <table className="statistics-table">
          <thead>
            <tr>
              <th className="col-left col-course-1" scope="col">Mã HP</th>
              <th className="col-left col-course-2" scope="col">Học phần</th>
              <th scope="col">Khoa / Viện</th>
              <th scope="col">Số lớp</th>
              <th scope="col">Số GV</th>
              <th scope="col">Điểm TB</th>
              <th scope="col">Lớp thấp nhất</th>
              <th scope="col">Lớp cao nhất</th>
              <th scope="col">Biên độ</th>
              <th scope="col">Câu hỏi yếu nhất</th>
              <th scope="col">Điểm câu yếu</th>
              <th scope="col">Kết luận</th>
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
                  <span className={verdictClass(row.verdict)}>
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
          totalItems={data.rows.length}
          itemLabel="học phần"
          onPageChange={pagination.setPage}
        />
      </div>
    </>
  );
};

// ------------------------------------------ Tab 4: báo cáo cá nhân giảng viên

const LecturerTab: React.FC<{
  semesterSurveyId: number | null;
  lecturers: LecturerOption[];
}> = ({ semesterSurveyId, lecturers }) => {
  const [faculty, setFaculty] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [selected, setSelected] = useState<string>('');
  const [report, setReport] = useState<LecturerReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Đổi đợt thì kết quả cũ không còn đúng nữa, xoá đi để không hiểu nhầm.
  useEffect(() => {
    setFaculty('');
    setDepartment('');
    setSelected('');
    setReport(null);
    setError(null);
  }, [semesterSurveyId]);

  const faculties = useMemo(
    () => [...new Set(lecturers.map((x) => x.facultyName))].sort((a, b) => a.localeCompare(b, 'vi')),
    [lecturers]
  );

  // Ba ô lọc nối tầng: chọn khoa thì danh sách bộ môn co lại, chọn bộ môn thì
  // danh sách giảng viên co theo.
  const departments = useMemo(
    () =>
      [
        ...new Set(
          lecturers.filter((x) => !faculty || x.facultyName === faculty).map((x) => x.departmentName)
        ),
      ].sort((a, b) => a.localeCompare(b, 'vi')),
    [lecturers, faculty]
  );

  const visibleLecturers = useMemo(
    () =>
      lecturers.filter(
        (x) =>
          (!faculty || x.facultyName === faculty) && (!department || x.departmentName === department)
      ),
    [lecturers, faculty, department]
  );

  // Người đang chọn có thể rơi ra ngoài bộ lọc vừa đổi; bỏ chọn để không gửi đi
  // một giảng viên không còn nằm trong danh sách trước mắt.
  useEffect(() => {
    if (selected && !visibleLecturers.some((x) => String(x.lecturerId) === selected)) {
      setSelected('');
    }
  }, [visibleLecturers, selected]);

  const search = async () => {
    if (!semesterSurveyId || !selected) return;
    setLoading(true);
    try {
      setReport(await surveyApi.lecturerReport(semesterSurveyId, Number(selected)));
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
              setDepartment('');
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

        <label className="form-group">
          <span>Bộ môn</span>
          <select value={department} onChange={(event) => setDepartment(event.target.value)}>
            <option value="">Tất cả bộ môn</option>
            {departments.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="form-group">
          <span>Giảng viên ({visibleLecturers.length})</span>
          <select value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="">Chọn giảng viên</option>
            {visibleLecturers.map((lecturer) => (
              <option key={lecturer.lecturerId} value={String(lecturer.lecturerId)}>
                {lecturer.fullName} · {lecturer.sectionCount} lớp
              </option>
            ))}
          </select>
        </label>

        <div className="statistics-toolbar-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void search()}
            disabled={!selected || loading}
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

      <div className="analysis-section">
        <h4 className="analysis-section-title">Các lớp giảng dạy trong kỳ</h4>
        <div
          className="statistics-table-scroll analysis-scroll--compact"
          tabIndex={0}
          aria-label="Các lớp giảng dạy trong kỳ"
        >
          <table className="statistics-table">
            <thead>
              <tr>
                <th scope="col">Mã HP</th>
                <th scope="col">Học phần</th>
                <th scope="col">Lớp</th>
                <th scope="col">Sĩ số</th>
                <th scope="col">Số phiếu</th>
                <th scope="col">Tỷ lệ PH</th>
                <th scope="col">Điểm</th>
                <th scope="col">Z trong khoa</th>
              </tr>
            </thead>
            <tbody>
              {report.sections.map((section) => (
                <tr key={section.courseSectionSurveyId}>
                  <td>
                    <span className="operations-code">{section.courseCode}</span>
                  </td>
                  <td title={section.courseName}>{section.courseName}</td>
                  <td>{section.sectionName}</td>
                  <td className="num">{section.classSize}</td>
                  <td className="num">{section.responseCount}</td>
                  <td className="num">{section.completionRate.toFixed(1)}%</td>
                  <td className={scoreClass(section.averageScore)}>
                    {section.averageScore.toFixed(2)}
                  </td>
                  <td className={zClass(section.zFaculty)}>
                    {section.zFaculty === null ? '—' : section.zFaculty.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="analysis-section analysis-section--grow">
        <h4 className="analysis-section-title">So với mặt bằng bộ môn và khoa/viện</h4>
        <div
          className="statistics-table-scroll"
          tabIndex={0}
          aria-label="So với mặt bằng bộ môn và khoa/viện"
        >
          <table className="statistics-table">
            <thead>
              <tr>
                <th scope="col">Câu</th>
                <th scope="col">Nội dung</th>
                <th scope="col">Điểm GV</th>
                <th scope="col">Trung vị bộ môn</th>
                <th scope="col">Trung vị khoa</th>
                <th scope="col">Chênh so bộ môn</th>
              </tr>
            </thead>
            <tbody>
              {report.comparisons.map((row) => (
                <tr key={row.questionOrder}>
                  <th scope="row">C{row.questionOrder}</th>
                  <td title={row.questionText}>{row.questionText}</td>
                  <td className={scoreClass(row.lecturerScore)}>{row.lecturerScore.toFixed(2)}</td>
                  <td className="num">
                    {row.departmentMedian === null ? '—' : row.departmentMedian.toFixed(2)}
                  </td>
                  <td className="num">
                    {row.facultyMedian === null ? '—' : row.facultyMedian.toFixed(2)}
                  </td>
                  <td className="num">
                    {row.differenceFromDepartment === null ? (
                      '—'
                    ) : (
                      <span
                        className={
                          row.differenceFromDepartment < 0
                            ? 'delta--down'
                            : row.differenceFromDepartment > 0
                              ? 'delta--up'
                              : undefined
                        }
                      >
                        {row.differenceFromDepartment > 0 ? '+' : ''}
                        {row.differenceFromDepartment.toFixed(2)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};
