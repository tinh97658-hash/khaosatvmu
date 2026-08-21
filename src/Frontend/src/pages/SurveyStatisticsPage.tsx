import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calculator, CircleAlert, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useSemester } from '../context/semesterContext';
import { ApiError } from '../services/apiClient';
import { surveyApi, surveyErrorMessage } from '../services/surveyApi';
import type { SemesterSurvey } from '../types';
import type { SemesterSurveyStatistics } from '../services/surveyApi';
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
  const columns = useMemo(() => statistics?.questionColumns ?? [], [statistics]);
  const rows = useMemo(() => statistics?.rows ?? [], [statistics]);
  const rowsWithResponses = rows.filter((row) => row.totalResponseCount > 0);
  const questionTextById = useMemo(
    () => new Map(columns.map((column) => [column.questionId, column])),
    [columns]
  );

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
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void loadStatistics()}
            disabled={!semesterSurveyId || loading}
          >
            <RefreshCw aria-hidden="true" size={16} />
            Tải lại
          </button>
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
                <th className="col-left col-left-1" scope="col">Mã HP</th>
                <th className="col-left col-left-2" scope="col">Lớp</th>
                <th className="col-left col-left-3" scope="col">Tên HP</th>
                <th scope="col">Bộ môn</th>
                <th scope="col">Họ tên GV</th>
                <th scope="col">Sĩ số</th>
                <th scope="col">Số phiếu</th>
                <th scope="col">Tỷ lệ PH</th>
                {columns.map((column) => (
                  <th key={column.questionId} scope="col" title={column.questionText}>
                    C{column.order}
                  </th>
                ))}
                <th className="col-right col-right-5" scope="col">Điểm tổng hợp</th>
                <th className="col-right col-right-4" scope="col">Câu yếu nhất</th>
                <th className="col-right col-right-3" scope="col">Điểm câu yếu</th>
                <th className="col-right col-right-2" scope="col">Phiếu lỗi</th>
                <th className="col-right col-right-1" scope="col">Số ý kiến mở</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const weakest = row.weakestQuestionId === null
                  ? null
                  : questionTextById.get(row.weakestQuestionId);
                const scoreByQuestion = new Map(
                  row.questionScores.map((score) => [score.questionId, score])
                );

                return (
                  <tr key={row.courseSectionSurveyId}>
                    <td className="col-left col-left-1">
                      <span className="operations-code">{row.courseCode}</span>
                    </td>
                    <td className="col-left col-left-2">{row.sectionName}</td>
                    <td className="col-left col-left-3" title={row.courseName}>
                      {row.courseName}
                    </td>
                    <td>{row.departmentName}</td>
                    <td>{row.lecturerName}</td>
                    <td className="num">{row.classSize}</td>
                    <td className="num">{row.totalResponseCount}</td>
                    <td className="num">{row.completionRate.toFixed(1)}%</td>
                    {columns.map((column) => {
                      const score = scoreByQuestion.get(column.questionId);
                      const value = score?.answerCount ? score.averageScore : null;
                      return (
                        <td
                          key={column.questionId}
                          className={
                            value !== null && value < weakScoreThreshold ? 'num is-weak' : 'num'
                          }
                        >
                          {value === null ? '—' : value.toFixed(2)}
                        </td>
                      );
                    })}
                    <td className="num is-total col-right col-right-5">
                      {row.averageScore === null ? '—' : row.averageScore.toFixed(2)}
                    </td>
                    <td className="col-right col-right-4" title={weakest?.questionText}>
                      {weakest === null || weakest === undefined ? '—' : `C${weakest.order}`}
                    </td>
                    <td className="num col-right col-right-3">
                      {row.weakestQuestionScore === null
                        ? '—'
                        : row.weakestQuestionScore.toFixed(2)}
                    </td>
                    <td
                      className={
                        row.invalidResponseCount > 0
                          ? 'num is-flagged col-right col-right-2'
                          : 'num col-right col-right-2'
                      }
                    >
                      {row.invalidResponseCount}
                    </td>
                    <td className="num col-right col-right-1">{row.openCommentCount}</td>
                  </tr>
                );
              })}
              {/* Ô đệm nuốt chỗ thừa để dòng tổng kết luôn nằm sát đáy khung. */}
              <tr className="table-spacer" aria-hidden="true">
                <td colSpan={13 + columns.length} />
              </tr>
            </tbody>

            {/* Dòng tổng kết ghim đáy bảng: ô điểm lấy trung bình (nền xanh),
                ô đếm lấy tổng (nền vàng). */}
            <tfoot>
              <tr>
                <th className="col-left col-left-1" scope="row">Tổng kết</th>
                <td className="col-left col-left-2" />
                <td className="col-left col-left-3">{rows.length} lớp</td>
                <td />
                <td />
                <td className="num is-sum">{footer.classSizeTotal}</td>
                <td className="num is-sum">{footer.responseTotal}</td>
                <td className="num is-mean">
                  {footer.completionMean === null ? '—' : `${footer.completionMean.toFixed(1)}%`}
                </td>
                {columns.map((column) => {
                  const value = footer.questionMeans.get(column.questionId) ?? null;
                  return (
                    <td key={column.questionId} className="num is-mean">
                      {value === null ? '—' : value.toFixed(2)}
                    </td>
                  );
                })}
                <td className="num is-mean is-total col-right col-right-5">
                  {footer.averageScoreMean === null ? '—' : footer.averageScoreMean.toFixed(2)}
                </td>
                {/* Câu yếu nhất và điểm của nó là chỉ số của từng lớp; gộp lại
                    cho cả đợt thì không có ý nghĩa nên để trống. */}
                <td className="col-right col-right-4" />
                <td className="col-right col-right-3" />
                <td className="num is-sum col-right col-right-2">{footer.invalidTotal}</td>
                <td className="num is-sum col-right col-right-1">{footer.commentTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};
