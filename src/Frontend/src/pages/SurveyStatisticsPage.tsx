import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calculator, CircleAlert, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useSemester } from '../context/semesterContext';
import { TablePagination } from '../components/TablePagination';
import { ExportDropdown } from '../components/ExportDropdown';
import { ApiError } from '../services/apiClient';
import { surveyApi, surveyErrorMessage } from '../services/surveyApi';
import type { SemesterSurvey } from '../types';
import type { SectionStatisticsRow, SemesterSurveyStatistics } from '../services/surveyApi';
import { useColumnFilters, type FilterableColumn } from '../hooks/useColumnFilters';
import { useAuth } from '../auth/authContext';
import { isUnrestrictedRole } from '../auth/roles';
import {
  COMPLETED_COMPLETION_RATE,
  hasEnoughResponsesToScore,
} from '../utils/reportThresholds';
import '../styles/survey-operations.css';
import '../styles/survey-statistics.css';

function messageFrom(error: unknown): string {
  return error instanceof ApiError ? surveyErrorMessage(error.errorCode) : surveyErrorMessage(null);
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
    .format(new Date(value));
}

/** Điểm dưới ngưỡng này thì tô đậm để dễ nhặt ra lớp cần để ý. */
const weakScoreThreshold = 3.5;
const statisticsPageSize = 20;

export const SurveyStatisticsPage: React.FC = () => {
  const { academicYears, activeSemesterId } = useSemester();

  const [semesterId, setSemesterId] = useState<string>(() =>
    activeSemesterId ? String(activeSemesterId) : ''
  );
  useEffect(() => {
    if (activeSemesterId) setSemesterId(String(activeSemesterId));
  }, [activeSemesterId]);

  const [semesterSurveys, setSemesterSurveys] = useState<SemesterSurvey[]>([]);
  const [semesterSurveyId, setSemesterSurveyId] = useState<string>('');
  const [statistics, setStatistics] = useState<SemesterSurveyStatistics | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [page, setPage] = useState(1);

  // Đổi học kỳ thì nạp lại danh sách đợt khảo sát của kỳ đó.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!semesterId) {
        setSemesterSurveys([]);
        setSemesterSurveyId('');
        setStatistics(null);
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

  const loadStatistics = useCallback(async () => {
    if (!semesterSurveyId) {
      setStatistics(null);
      return;
    }
    setLoading(true);
    try {
      setStatistics(await surveyApi.semesterSurveyStatistics(Number(semesterSurveyId)));
      setLoadError(null);
    } catch (error) {
      setLoadError(messageFrom(error));
      setStatistics(null);
    } finally {
      setLoading(false);
    }
  }, [semesterSurveyId]);

  useEffect(() => {
    void loadStatistics();
  }, [loadStatistics]);

  const handleRecalculate = async () => {
    if (!semesterSurveyId || recalculating) return;
    setRecalculating(true);
    try {
      const result = await surveyApi.recalculateScores(Number(semesterSurveyId));
      toast.success(`Đã tính lại ${result.updatedSectionCount} lớp học phần`, {
        description: `Thời điểm tính: ${formatDateTime(result.calculatedAt)}`,
      });
      await loadStatistics();
    } catch (error) {
      toast.error('Không tính lại được điểm', { description: messageFrom(error) });
    } finally {
      setRecalculating(false);
    }
  };

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

  // Bám vào chính statistics chứ không vào mảng dẫn xuất, vì mảng dẫn xuất tạo
  // tham chiếu mới mỗi lần render nên useMemo sẽ chạy lại vô ích.
  const { activeProfile } = useAuth();
  const canRecalculate = isUnrestrictedRole(activeProfile?.roleCode);

  const columns = useMemo(() => statistics?.questionColumns ?? [], [statistics]);
  const rows = useMemo(() => statistics?.rows ?? [], [statistics]);

  const questionTextById = useMemo(
    () => new Map(columns.map((column) => [column.questionId, column])),
    [columns]
  );

  // Lớp đã chốt điểm lên trên, lớp chưa có điểm xuống dưới — phần lớn việc cần
  // làm nằm ở nhóm trên, không phải lật vài trang mới thấy. Sort của JS ổn định
  // nên trong mỗi nhóm vẫn giữ nguyên thứ tự mã học phần / tên lớp của backend.
  const orderedRows = useMemo(
    () =>
      [...rows].sort(
        (left, right) =>
          Number(left.averageScore === null) - Number(right.averageScore === null)
      ),
    [rows]
  );

  /**
   * Cột lọc được. CỐ Ý bỏ qua 30 cột điểm từng câu: lọc theo một điểm lẻ như
   * "4.33" không giúp được gì, mà mỗi menu lại phải quét lại toàn bộ gần 2000
   * dòng để dựng danh sách giá trị — thêm 30 menu là mỗi lần vẽ lại tốn gấp mười.
   */
  const filterColumns = useMemo<FilterableColumn<SectionStatisticsRow>[]>(
    () => [
      { key: 'courseCode', value: (row) => row.courseCode },
      { key: 'sectionName', value: (row) => row.sectionName },
      { key: 'courseName', value: (row) => row.courseName },
      { key: 'departmentName', value: (row) => row.departmentName },
      { key: 'lecturerName', value: (row) => row.lecturerName },
      { key: 'classSize', value: (row) => String(row.classSize), numeric: true },
      {
        key: 'totalResponseCount',
        value: (row) => String(row.totalResponseCount),
        numeric: true,
      },
      {
        key: 'validResponseCount',
        value: (row) => String(row.validResponseCount),
        numeric: true,
      },
      {
        key: 'completionRate',
        value: (row) => `${row.completionRate.toFixed(1)}%`,
        sortValue: (row) => row.completionRate,
      },
      {
        key: 'averageScore',
        // Ô trống hiện "—" trong menu, và luôn bị đẩy xuống cuối khi sắp xếp.
        value: (row) => (row.averageScore === null ? '—' : row.averageScore.toFixed(2)),
        sortValue: (row) => row.averageScore,
      },
      {
        key: 'weakestQuestion',
        value: (row) => {
          const weakest = row.weakestQuestionId === null
            ? null
            : questionTextById.get(row.weakestQuestionId);
          return weakest ? `C${weakest.order}` : '—';
        },
        sortValue: (row) => {
          const weakest = row.weakestQuestionId === null
            ? null
            : questionTextById.get(row.weakestQuestionId);
          return weakest ? weakest.order : null;
        },
      },
      {
        key: 'weakestQuestionScore',
        value: (row) =>
          row.weakestQuestionScore === null ? '—' : row.weakestQuestionScore.toFixed(2),
        sortValue: (row) => row.weakestQuestionScore,
      },
      {
        key: 'invalidResponseCount',
        value: (row) => String(row.invalidResponseCount),
        numeric: true,
      },
      {
        key: 'openCommentCount',
        value: (row) => String(row.openCommentCount),
        numeric: true,
      },
    ],
    [questionTextById]
  );

  const filters = useColumnFilters(orderedRows, filterColumns);
  const filteredRows = filters.visibleRows;
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / statisticsPageSize));
  const visibleRows = useMemo(
    () => filteredRows.slice((page - 1) * statisticsPageSize, page * statisticsPageSize),
    [page, filteredRows]
  );

  useEffect(() => {
    setPage(1);
  }, [semesterSurveyId]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);
  const rowsWithResponses = rows.filter((row) => row.totalResponseCount > 0);

  /**
   * Dòng tổng kết cuối bảng. Cột nào là số đếm thì cộng dồn, cột nào là điểm thì
   * lấy trung bình và chỉ tính trên lớp thật sự có số liệu — lớp chưa ai làm mà
   * tính là 0 thì kéo tụt trung bình chung một cách vô lý.
   */
  const footer = useMemo(() => {
    const mean = (values: number[]) =>
      values.length === 0 ? null : values.reduce((sum, x) => sum + x, 0) / values.length;

    const questionMeans = new Map<number, number | null>();
    for (const column of columns) {
      const scores = rows
        .map((row) => row.questionScores.find((s) => s.questionId === column.questionId))
        .filter((score) => score !== undefined && score.answerCount > 0)
        .map((score) => score!.averageScore);
      questionMeans.set(column.questionId, mean(scores));
    }

    return {
      classSizeTotal: rows.reduce((sum, row) => sum + row.classSize, 0),
      responseTotal: rows.reduce((sum, row) => sum + row.totalResponseCount, 0),
      completionMean: mean(rows.filter((r) => r.classSize > 0).map((r) => r.completionRate)),
      questionMeans,
      averageScoreMean: mean(
        rows.filter((r) => r.averageScore !== null).map((r) => r.averageScore!)
      ),
      invalidTotal: rows.reduce((sum, row) => sum + row.invalidResponseCount, 0),
      validTotal: rows.reduce((sum, row) => sum + row.validResponseCount, 0),
      commentTotal: rows.reduce((sum, row) => sum + row.openCommentCount, 0),
    };
  }, [columns, rows]);

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
          {statistics && rows.length > 0 && (
            <ExportDropdown
              buttonLabel="Xuất bảng điểm"
              size="sm"
              options={{
                fileName: 'thong-ke-diem-khao-sat-dot',
                metadata: {
                  title: 'BÁO CÁO THỐNG KÊ ĐIỂM SỐ ĐỢT KHẢO SÁT',
                  subtitle: `Bộ câu hỏi: ${statistics.templateName}`,
                  subInstitution: 'PHÒNG ĐẢM BẢO CHẤT LƯỢNG',
                  info: {
                    'Bộ câu hỏi': statistics.templateName,
                    'Số lượng lớp học phần': filteredRows.length,
                    'Tổng sĩ số sinh viên': footer.classSizeTotal,
                    'Tổng phiếu khảo sát đã thu': footer.responseTotal,
                    'Điểm trung bình toàn đợt':
                      footer.averageScoreMean !== null ? footer.averageScoreMean.toFixed(2) : '—',
                  },
                  summaryNotes: [
                    'Điểm trung bình mỗi câu hỏi và điểm tổng hợp được tính trên thang điểm 5.0 từ phiếu hợp lệ.',
                    'Dữ liệu được cập nhật tại thời điểm chốt tính điểm.',
                    ...(filters.isFiltered
                      ? ['Tệp này chỉ chứa các lớp còn lại sau bộ lọc đang áp trên màn hình.']
                      : []),
                  ],
                },
                sheets: [
                  {
                    sheetName: 'Bang diem chi tiet',
                    title: filters.isFiltered
                      ? `1. BẢNG ĐIỂM CHI TIẾT THEO BỘ LỌC ĐANG ÁP (${filteredRows.length} LỚP)`
                      : `1. BẢNG ĐIỂM CHI TIẾT TẤT CẢ CÁC LỚP HỌC PHẦN (${filteredRows.length} LỚP)`,
                    columns: [
                      { key: 'courseCode', header: 'Mã HP', width: 12, align: 'center' as const },
                      { key: 'sectionName', header: 'Lớp HP', width: 14, align: 'center' as const },
                      { key: 'courseName', header: 'Tên học phần', width: 26 },
                      { key: 'departmentName', header: 'Bộ môn', width: 20 },
                      { key: 'lecturerName', header: 'Họ tên GV', width: 22 },
                      { key: 'classSize', header: 'Sĩ số', width: 10, type: 'number' as const, align: 'right' as const },
                      { key: 'totalResponseCount', header: 'Số phiếu', width: 10, type: 'number' as const, align: 'right' as const },
                      { key: 'invalidResponseCount', header: 'Phiếu lỗi', width: 10, type: 'number' as const, align: 'right' as const },
                      { key: 'validResponseCount', header: 'Phiếu hợp lệ', width: 12, type: 'number' as const, align: 'right' as const },
                      {
                        // Xuất SỐ kèm mã định dạng, không xuất chuỗi "18.2%": ô chữ
                        // thì Excel sắp theo bảng chữ cái, "100.0%" rơi xuống dưới
                        // "18.2%" vì so ký tự thứ hai 0 < 8.
                        key: 'completionRate',
                        header: 'Tỷ lệ PH',
                        width: 12,
                        type: 'number' as const,
                        align: 'right' as const,
                        numberFormat: '0.0"%"',
                      },
                      ...columns.map((c) => ({
                        key: `c_${c.questionId}`,
                        header: `C${c.order}`,
                        width: 8,
                        type: 'number' as const,
                        align: 'right' as const,
                        format: (_: any, row: any) => {
                          const score = row.questionScores?.find((s: any) => s.questionId === c.questionId);
                          return score?.answerCount ? score.averageScore.toFixed(2) : '—';
                        },
                      })),
                      {
                        key: 'averageScore',
                        header: 'Điểm tổng hợp',
                        width: 14,
                        type: 'number' as const,
                        align: 'right' as const,
                        format: (val: any) => (val !== null ? Number(val).toFixed(2) : '—'),
                      },
                      { key: 'openCommentCount', header: 'Ý kiến mở', width: 10, type: 'number' as const, align: 'right' as const },
                    ],
                    data: filteredRows,
                  },
                  {
                    sheetName: 'Lop diem thap & Luu y',
                    title: '2. DANH SÁCH LỚP CÓ ĐIỂM THẤP HOẶC CÓ TIÊU CHÍ CẦN CẢI THIỆN',
                    subtitle: 'Các lớp có Điểm tổng hợp < 3.50 hoặc có tiêu chí đơn lẻ bị đánh giá thấp',
                    columns: [
                      { key: 'courseCode', header: 'Mã HP', width: 12, align: 'center' as const },
                      { key: 'sectionName', header: 'Lớp HP', width: 14, align: 'center' as const },
                      { key: 'courseName', header: 'Tên học phần', width: 26 },
                      { key: 'lecturerName', header: 'Giảng viên', width: 22 },
                      { key: 'departmentName', header: 'Bộ môn', width: 20 },
                      { key: 'classSize', header: 'Sĩ số', width: 10, type: 'number' as const, align: 'right' as const },
                      { key: 'totalResponseCount', header: 'Phiếu thu', width: 10, type: 'number' as const, align: 'right' as const },
                      {
                        key: 'averageScore',
                        header: 'Điểm tổng hợp',
                        width: 14,
                        type: 'number' as const,
                        align: 'right' as const,
                        format: (v: any) => (v !== null ? Number(v).toFixed(2) : '—'),
                      },
                      {
                        key: 'weakestQuestionOrder',
                        header: 'Câu yếu nhất',
                        width: 14,
                        align: 'center' as const,
                        format: (v: any, item: any) => v ? `C${v} (${item.weakestQuestionScore?.toFixed(2)})` : '—',
                      },
                      {
                        key: 'weakestQuestionText',
                        header: 'Nội dung câu hỏi yếu nhất',
                        width: 36,
                        format: (_: any, item: any) => {
                          const q = item.weakestQuestionId ? questionTextById.get(item.weakestQuestionId) : null;
                          return q?.questionText || item.weakestQuestionText || '—';
                        },
                      },
                    ],
                    data: filteredRows.filter((r) => (r.averageScore !== null && r.averageScore < 3.5) || (r.weakestQuestionScore !== null && r.weakestQuestionScore < 3.0)),
                  },
                  {
                    sheetName: 'Thong ke theo Tieu chi',
                    title: '3. THỐNG KÊ ĐIỂM TRUNG BÌNH THEO TỪNG TIÊU CHÍ CÂU HỎI',
                    columns: [
                      { key: 'order', header: 'Mã câu', width: 10, align: 'center' as const, format: (v: any) => `C${v}` },
                      { key: 'questionText', header: 'Nội dung tiêu chí câu hỏi', width: 50 },
                      {
                        key: 'questionId',
                        header: 'Điểm TB toàn trường',
                        width: 18,
                        type: 'number' as const,
                        align: 'right' as const,
                        format: (qid: any) => {
                          const mean = footer.questionMeans.get(Number(qid));
                          return mean !== null && mean !== undefined ? mean.toFixed(2) : '—';
                        },
                      },
                      {
                        key: 'questionId',
                        header: 'Số lớp < 3.5 điểm',
                        width: 16,
                        type: 'number' as const,
                        align: 'right' as const,
                        format: (qid: any) => {
                          const id = Number(qid);
                          return rows.filter((r) => {
                            const sc = r.questionScores?.find((s) => s.questionId === id);
                            return sc && sc.answerCount > 0 && sc.averageScore < 3.5;
                          }).length;
                        },
                      },
                    ],
                    data: columns,
                  },
                ],
              }}
            />
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void loadStatistics()}
            disabled={!semesterSurveyId || loading}
          >
            <RefreshCw aria-hidden="true" size={16} />
            Tải lại
          </button>
          {/* Tính lại điểm ghi đè điểm của MỌI lớp trong đợt, không cắt được theo
              bộ môn — nên chỉ quản trị toàn hệ thống mới thấy nút. Backend cũng
              chặn, đây chỉ là để người không có quyền khỏi bấm rồi ăn lỗi. */}
          {canRecalculate && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void handleRecalculate()}
              disabled={!semesterSurveyId || recalculating}
            >
              {recalculating ? (
                <LoaderCircle className="auth-spin" aria-hidden="true" size={16} />
              ) : (
                <Calculator aria-hidden="true" size={16} />
              )}
              {recalculating ? 'Đang tính...' : 'Tính lại điểm'}
            </button>
          )}
        </div>
      </section>

      {loadError && (
        <div className="admin-alert" role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      )}

      {statistics && (
        <section className="statistics-summary">
          <span>
            Bộ câu hỏi: <strong>{statistics.templateName}</strong>
          </span>
          <span>
            {columns.length} câu chấm điểm · {rows.length} lớp · {rowsWithResponses.length} lớp đã có phiếu
            {/* Đang lọc thì nói rõ còn bao nhiêu dòng, không thì người xem tưởng mất dữ liệu. */}
            {filters.isFiltered && ` · đang lọc còn ${filteredRows.length} lớp`}
          </span>
          {/* Bảng nhảy cóc số câu vì câu bẫy không có cột; nói rõ để khỏi bị hiểu
              là thiếu dữ liệu. */}
          {statistics.attentionCheckOrders.length > 0 && (
            <span className="statistics-trap-note">
              Câu bẫy (không lên bảng):{' '}
              <strong>
                {statistics.attentionCheckOrders.map((order) => `C${order}`).join(', ')}
              </strong>
            </span>
          )}
          <span>
            Tính điểm lần cuối: <strong>{formatDateTime(statistics.lastCalculatedAt)}</strong>
          </span>
        </section>
      )}

      {/* Số đang xem là ảnh chụp lúc bấm nút, không tự cập nhật khi có phiếu mới. */}
      {statistics && statistics.responsesSinceLastCalculation > 0 && (
        <div className="admin-alert admin-alert--warning" role="status">
          <TriangleAlert aria-hidden="true" />
          <span>
            Có <strong>{statistics.responsesSinceLastCalculation} phiếu</strong> về sau lần tính gần
            nhất. Bấm <strong>Tính lại điểm</strong> để cập nhật.
          </span>
        </div>
      )}

      {/* Các cột đếm phiếu luôn có số; riêng cột điểm phải bấm nút mới tính, nên
          nói rõ để khỏi bị hiểu là bảng lỗi. */}
      {statistics && statistics.lastCalculatedAt === null && (
        <div className="admin-alert" role="status">
          <CircleAlert aria-hidden="true" />
          <span>
            Đợt này chưa chốt điểm lần nào, nên các cột điểm (C1, C2…, Điểm tổng hợp, Câu yếu
            nhất) đang để trống. Bấm <strong>Tính lại điểm</strong> để tính.
          </span>
        </div>
      )}

      {loading ? (
        <div className="operations-empty" role="status">
          <LoaderCircle className="operation-icon auth-spin" aria-hidden="true" />
          <strong>Đang tải bảng dữ liệu...</strong>
        </div>
      ) : rows.length === 0 ? (
        <div className="operations-empty">
          <strong>Chưa có lớp học phần nào trong đợt khảo sát này.</strong>
        </div>
      ) : (
        // Bảng rất rộng vì số cột C thay đổi theo bộ câu hỏi: cuộn ngang và ghim
        // các cột đầu để không lạc dòng.
        <div className="statistics-table-scroll" tabIndex={0} aria-label="Bảng dữ liệu, cuộn ngang">
          <table className="statistics-table statistics-table--fill">
            <thead>
              <tr>
                <th className="col-left col-left-1" scope="col">
                  {filters.filterHeader('courseCode', 'Mã HP')}
                </th>
                <th className="col-left col-left-2" scope="col">
                  {filters.filterHeader('sectionName', 'Lớp')}
                </th>
                <th className="col-left col-left-3" scope="col">
                  {filters.filterHeader('courseName', 'Tên HP')}
                </th>
                <th className="col-meta" scope="col">
                  {filters.filterHeader('departmentName', 'Bộ môn')}
                </th>
                <th className="col-meta" scope="col">
                  {filters.filterHeader('lecturerName', 'Họ tên GV')}
                </th>
                <th className="col-metric" scope="col">
                  {filters.filterHeader('classSize', 'Sĩ số')}
                </th>
                <th className="col-metric" scope="col">
                  {filters.filterHeader('totalResponseCount', 'Số phiếu')}
                </th>
                <th className="col-metric" scope="col" title="Phiếu bị bộ lọc nhiễu loại">
                  {filters.filterHeader('invalidResponseCount', 'Phiếu lỗi')}
                </th>
                <th className="col-metric" scope="col" title="Số phiếu qua được bộ lọc nhiễu">
                  {filters.filterHeader('validResponseCount', 'Phiếu hợp lệ')}
                </th>
                <th className="col-metric" scope="col" title="Phiếu hợp lệ chia sĩ số">
                  {filters.filterHeader('completionRate', 'Tỷ lệ PH')}
                </th>
                {columns.map((column) => (
                  <th
                    key={column.questionId}
                    className="col-question"
                    scope="col"
                    title={column.questionText}
                  >
                    C{column.order}
                  </th>
                ))}
                <th className="col-right col-right-4" scope="col">
                  {filters.filterHeader('averageScore', 'Điểm tổng hợp')}
                </th>
                <th className="col-right col-right-3" scope="col">
                  {filters.filterHeader('weakestQuestion', 'Câu yếu nhất')}
                </th>
                <th className="col-right col-right-2" scope="col">
                  {filters.filterHeader('weakestQuestionScore', 'Điểm câu yếu')}
                </th>
                <th className="col-right col-right-1" scope="col">
                  {filters.filterHeader('openCommentCount', 'Số ý kiến mở')}
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const weakest = row.weakestQuestionId === null
                  ? null
                  : questionTextById.get(row.weakestQuestionId);
                const scoreByQuestion = new Map(
                  row.questionScores.map((score) => [score.questionId, score])
                );
                // Điểm trống có hai lý do khác hẳn nhau: lớp chưa thu đủ phiếu nên
                // cố ý không chốt, hay cả đợt chưa ai bấm tính. Nói rõ ra chứ đừng
                // để người xem đoán.
                const enoughToScore = hasEnoughResponsesToScore(
                  row.classSize,
                  row.totalResponseCount,
                  row.validResponseCount
                );
                const missingScoreReason = enoughToScore
                  ? 'Đợt chưa được bấm tính điểm.'
                  : `Chưa đủ phiếu để tính điểm: cần ${COMPLETED_COMPLETION_RATE}% phiếu hợp lệ`
                    + ' so với sĩ số, hoặc cả lớp đã nộp đủ.';

                return (
                  <tr key={row.courseSectionSurveyId}>
                    <td className="col-left col-left-1">
                      <span className="operations-code">{row.courseCode}</span>
                    </td>
                    <td className="col-left col-left-2">{row.sectionName}</td>
                    <td className="col-left col-left-3" title={row.courseName}>
                      {row.courseName}
                    </td>
                    <td className="col-meta">{row.departmentName}</td>
                    <td className="col-meta">{row.lecturerName}</td>
                    <td className="num col-metric">{row.classSize}</td>
                    <td className="num col-metric">{row.totalResponseCount}</td>
                    <td
                      className={
                        row.invalidResponseCount > 0
                          ? 'num is-flagged col-metric'
                          : 'num col-metric'
                      }
                    >
                      {row.invalidResponseCount}
                    </td>
                    <td className="num col-metric">{row.validResponseCount}</td>
                    <td className="num col-metric">{row.completionRate.toFixed(1)}%</td>
                    {columns.map((column) => {
                      const score = scoreByQuestion.get(column.questionId);
                      const value = score?.answerCount ? score.averageScore : null;
                      return (
                        <td
                          key={column.questionId}
                          className={
                            value !== null && value < weakScoreThreshold
                              ? 'num col-question is-weak'
                              : 'num col-question'
                          }
                        >
                          {value === null ? '—' : value.toFixed(2)}
                        </td>
                      );
                    })}
                    <td
                      className={
                        row.averageScore === null && !enoughToScore
                          ? 'num is-total is-muted col-right col-right-4'
                          : 'num is-total col-right col-right-4'
                      }
                      title={row.averageScore === null ? missingScoreReason : undefined}
                    >
                      {row.averageScore === null ? '—' : row.averageScore.toFixed(2)}
                    </td>
                    <td className="col-right col-right-3" title={weakest?.questionText}>
                      {weakest === null || weakest === undefined ? '—' : `C${weakest.order}`}
                    </td>
                    <td className="num col-right col-right-2">
                      {row.weakestQuestionScore === null
                        ? '—'
                        : row.weakestQuestionScore.toFixed(2)}
                    </td>
                    <td className="num col-right col-right-1">{row.openCommentCount}</td>
                  </tr>
                );
              })}
              {/* Ô đệm nuốt chỗ thừa để dòng tổng kết luôn nằm sát đáy khung. */}
              <tr className="table-spacer" aria-hidden="true">
                <td colSpan={14 + columns.length} />
              </tr>
            </tbody>

            {/* Dòng tổng kết ghim đáy bảng: ô điểm lấy trung bình (nền xanh),
                ô đếm lấy tổng (nền vàng). */}
            <tfoot>
              <tr>
                <th className="col-left col-left-1" scope="row">Tổng kết</th>
                <td className="col-left col-left-2" />
                <td className="col-left col-left-3">{rows.length} lớp</td>
                <td className="col-meta" />
                <td className="col-meta" />
                <td className="num is-sum col-metric">{footer.classSizeTotal}</td>
                <td className="num is-sum col-metric">{footer.responseTotal}</td>
                <td className="num is-sum col-metric">{footer.invalidTotal}</td>
                <td className="num is-sum col-metric">{footer.validTotal}</td>
                <td className="num is-mean col-metric">
                  {footer.completionMean === null ? '—' : `${footer.completionMean.toFixed(1)}%`}
                </td>
                {columns.map((column) => {
                  const value = footer.questionMeans.get(column.questionId) ?? null;
                  return (
                    <td key={column.questionId} className="num is-mean col-question">
                      {value === null ? '—' : value.toFixed(2)}
                    </td>
                  );
                })}
                <td className="num is-mean is-total col-right col-right-4">
                  {footer.averageScoreMean === null ? '—' : footer.averageScoreMean.toFixed(2)}
                </td>
                {/* Câu yếu nhất và điểm của nó là chỉ số của từng lớp; gộp lại
                    cho cả đợt thì không có ý nghĩa nên để trống. */}
                <td className="col-right col-right-3" />
                <td className="col-right col-right-2" />
                <td className="num is-sum col-right col-right-1">{footer.commentTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Phân trang nằm NGOÀI khung cuộn: để bên trong thì kéo ngang bảng là nó
          trôi theo, mất hút khỏi màn hình. */}
      {!loading && rows.length > 0 && (
        <TablePagination
          page={page}
          pageSize={statisticsPageSize}
          totalItems={filteredRows.length}
          itemLabel="lớp"
          onPageChange={setPage}
        />
      )}
    </div>
  );
};
