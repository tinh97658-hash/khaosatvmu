import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CircleAlert,
  Clock4,
  LoaderCircle,
  Star,
  Target,
  Timer,
} from 'lucide-react';
import { reportApi } from '../../services/reportApi';
import type {
  QuestionRating,
  SchoolSurveyOverview as SchoolSurveyOverviewData,
} from '../../types';
import { FacultyScoreChart } from './FacultyScoreChart';
import { FacultyCompletionChart } from './FacultyCompletionChart';
import { WeakestQuestionsPanel } from './WeakestQuestionsPanel';
import { LaggingDepartmentsTable } from './LaggingDepartmentsTable';
import { formatNumber } from './theme';
import type { ReportAnalysisView } from '../../pages/reportRoute';

export interface SchoolOverviewDrillDown {
  facultyId?: number;
  departmentId?: number;
}

interface SchoolSurveyOverviewProps {
  semesterId: number;
  /** Chỉ phân tích một bài khảo sát của kỳ; bỏ trống là gộp cả kỳ. */
  semesterSurveyId?: number;
  analysisView: ReportAnalysisView;
  onAnalysisViewChange: (view: ReportAnalysisView) => void;
  onDrillDown?: (filter: SchoolOverviewDrillDown) => void;
}

/** Dưới ngưỡng này thì một đơn vị bị coi là chậm tiến độ thu phiếu. */
const laggingThreshold = 20;

/** Số tiêu chí mặc định của bảng xếp hạng câu hỏi. */
const defaultQuestionCount = 5;

/** Trần số tiêu chí, khớp với giới hạn phía API. */
const maxQuestionCount = 50;

/** Bảng tổng quan toàn trường — executive dashboard đặt đầu trang Thống kê & Báo cáo. */
export const SchoolSurveyOverview: React.FC<SchoolSurveyOverviewProps> = ({
  semesterId,
  semesterSurveyId,
  analysisView,
  onAnalysisViewChange,
  onDrillDown,
}) => {
  const [data, setData] = useState<SchoolSurveyOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bảng xếp hạng tiêu chí tự gọi API riêng: đổi số lượng hay đổi đầu bảng thì
  // chỉ nạp lại đúng khối đó, không dựng lại cả trang tổng quan.
  const [questionCount, setQuestionCount] = useState(defaultQuestionCount);
  const [questionInput, setQuestionInput] = useState(String(defaultQuestionCount));
  const [questionLowest, setQuestionLowest] = useState(true);
  const [rankedQuestions, setRankedQuestions] = useState<QuestionRating[] | null>(null);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!semesterId) return;
    setLoading(true);
    setError(null);
    try {
      const overview = await reportApi.schoolOverview(semesterId, undefined, semesterSurveyId);
      setData(overview);
    } catch {
      setError('Không thể tải bảng tổng quan kết quả khảo sát toàn trường.');
    } finally {
      setLoading(false);
    }
  }, [semesterId, semesterSurveyId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Chỉ tải khi tab chất lượng đang mở, và bỏ luôn lần gọi thừa khi người dùng
  // còn đang gõ dở số lượng.
  useEffect(() => {
    if (analysisView !== 'quality' || !semesterId) return;
    let cancelled = false;
    setQuestionsLoading(true);
    reportApi
      .questionRanking({
        semesterId,
        semesterSurveyId,
        count: questionCount,
        lowest: questionLowest,
      })
      .then((questions) => {
        if (!cancelled) setRankedQuestions(questions);
      })
      .catch(() => {
        if (!cancelled) setRankedQuestions([]);
      })
      .finally(() => {
        if (!cancelled) setQuestionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [analysisView, semesterId, semesterSurveyId, questionCount, questionLowest]);

  /** Ô số nhận mọi thao tác gõ, nhưng chỉ chốt lại khi giá trị nằm trong khoảng hợp lệ. */
  const changeQuestionCount = (value: string) => {
    setQuestionInput(value);
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= maxQuestionCount) {
      setQuestionCount(parsed);
    }
  };

  if (loading) {
    return (
      <section className="reports-exec reports-exec--loading" aria-label="Đang tải bảng tổng quan">
        <LoaderCircle className="operation-icon auth-spin" aria-hidden="true" />
        <strong>Đang tổng hợp số liệu toàn trường...</strong>
      </section>
    );
  }

  if (error) {
    return (
      <section className="reports-exec reports-exec--error" role="alert">
        <CircleAlert className="operation-icon" aria-hidden="true" />
        <span>{error}</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()}>
          Thử lại
        </button>
      </section>
    );
  }

  if (!data) {
    return null;
  }

  const hasData = data.totalSections > 0;
  const laggingDepartments = data.departments.filter(
    (department) => department.completionRate < laggingThreshold,
  );
  const laggingDepartmentCount = laggingDepartments.length;

  return (
    <section className="reports-exec" aria-label="Bảng tổng quan kết quả khảo sát toàn trường">
      <header className="reports-exec-header">
        <div className="reports-exec-heading">
          <BarChart3 className="operation-icon" aria-hidden="true" />
          <div>
            <h2>Bảng tổng quan kết quả khảo sát toàn trường</h2>
            <p>
              {data.academicYearName} · {data.semesterName} — dữ liệu toàn trường, cập nhật gần thời gian thực
            </p>
          </div>
        </div>
      </header>

      {!hasData ? (
        <div className="reports-exec-empty">
          <AlertTriangle className="operation-icon" aria-hidden="true" />
          <strong>Chưa có dữ liệu cho học kỳ này</strong>
          <span>Hệ thống chưa phát đợt khảo sát nào hoặc chưa có phiếu trả lời.</span>
        </div>
      ) : (
        <>
          {/* Một dải KPI mỏng thay cho ba thẻ cao: cùng chừng ấy con số nhưng
              không đẩy phần phân tích xuống dưới màn hình. */}
          <div className="reports-exec-band">
            <span className="reports-exec-stat" title="Phiếu hợp lệ trên tổng chỉ tiêu">
              <Timer className="operation-icon" style={{ color: '#0788b8' }} aria-hidden="true" />
              Tiến độ thu phiếu
              <strong>{data.completionRate.toFixed(1)}%</strong>
              <small>
                {formatNumber(data.totalResponses)} / {formatNumber(data.totalTargetResponses)} phiếu hợp lệ
              </small>
            </span>

            <span className="reports-exec-stat" title="Điểm hài lòng toàn trường">
              <Star className="operation-icon" style={{ color: '#b86216' }} aria-hidden="true" />
              Điểm hài lòng
              <strong>{data.overallAverageScore.toFixed(2)}</strong>
              <small>/ 5.0</small>
            </span>

            <span className="reports-exec-stat" title="Lớp đạt từ 80% phiếu hợp lệ">
              <span className="legend-dot" style={{ background: '#137b3b' }} />
              Hoàn thành
              <strong>{data.completedSectionCount}</strong>
            </span>

            <span className="reports-exec-stat" title="Lớp đạt 20-80% phiếu hợp lệ">
              <span className="legend-dot" style={{ background: '#0788b8' }} />
              Đang thu
              <strong>{data.inProgressSectionCount}</strong>
            </span>

            <span className="reports-exec-stat" title="Lớp dưới 20% phiếu hợp lệ">
              <span className="legend-dot" style={{ background: '#b86216' }} />
              Chậm tiến độ
              <strong>{data.laggingSectionCount}</strong>
            </span>

            <span className="reports-exec-stat" title="Tổng số lớp đã phát phiếu">
              <Target className="operation-icon" style={{ color: '#20262c' }} aria-hidden="true" />
              Tổng lớp
              <strong>{formatNumber(data.totalSections)}</strong>
            </span>
          </div>

          <div className="reports-analysis-tabs" role="tablist" aria-label="Chọn nhóm phân tích">
            <button
              type="button"
              role="tab"
              aria-selected={analysisView === 'faculties'}
              className={analysisView === 'faculties' ? 'is-active' : ''}
              onClick={() => onAnalysisViewChange('faculties')}
            >
              So sánh theo Khoa
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={analysisView === 'quality'}
              className={analysisView === 'quality' ? 'is-active' : ''}
              onClick={() => onAnalysisViewChange('quality')}
            >
              Chất lượng phản hồi
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={analysisView === 'progress'}
              className={analysisView === 'progress' ? 'is-active' : ''}
              onClick={() => onAnalysisViewChange('progress')}
            >
              Đơn vị chậm tiến độ
              {laggingDepartmentCount > 0 && <span>{laggingDepartmentCount}</span>}
            </button>
          </div>

          {/* Hàng biểu đồ: điểm TB + tiến độ theo Khoa */}
          {analysisView === 'faculties' && (
          <div className="reports-exec-grid reports-analysis-panel" role="tabpanel">
            <div className="reports-exec-card">
              <header className="reports-exec-card-head">
                <Target className="operation-icon" aria-hidden="true" />
                <h3>Điểm TB theo Khoa / Viện</h3>
                <span className="reports-exec-card-note">Đường nét đứt = điểm TB toàn trường</span>
              </header>
              <FacultyScoreChart
                faculties={data.faculties}
                schoolAverage={data.schoolAverageScore}
                onSelect={onDrillDown ? (facultyId) => onDrillDown({ facultyId }) : undefined}
              />
            </div>

            <div className="reports-exec-card">
              <header className="reports-exec-card-head">
                <Timer className="operation-icon" aria-hidden="true" />
                <h3>Tỷ lệ hoàn thành theo Khoa / Viện</h3>
              </header>
              <FacultyCompletionChart
                faculties={data.faculties}
                onSelect={onDrillDown ? (facultyId) => onDrillDown({ facultyId }) : undefined}
              />
            </div>
          </div>
          )}

          {/* Hàng thứ 2: xếp hạng tiêu chí, số lượng và đầu bảng do người dùng chọn */}
          {analysisView === 'quality' && (
          <div className="reports-exec-card reports-analysis-panel" role="tabpanel">
            <header className="reports-exec-card-head">
              <AlertTriangle className="operation-icon" aria-hidden="true" />
              <h3>{questionLowest ? 'Tiêu chí cần cải tiến' : 'Tiêu chí được đánh giá cao'}</h3>
              <div className="reports-question-controls">
                <label htmlFor="reports-question-count">Hiển thị</label>
                <input
                  id="reports-question-count"
                  type="number"
                  min={1}
                  max={maxQuestionCount}
                  value={questionInput}
                  onChange={(event) => changeQuestionCount(event.target.value)}
                  onBlur={() => setQuestionInput(String(questionCount))}
                />
                <label className="catalog-sr-only" htmlFor="reports-question-order">
                  Đầu bảng điểm
                </label>
                <select
                  id="reports-question-order"
                  value={questionLowest ? 'lowest' : 'highest'}
                  onChange={(event) => setQuestionLowest(event.target.value === 'lowest')}
                >
                  <option value="lowest">tiêu chí điểm thấp nhất</option>
                  <option value="highest">tiêu chí điểm cao nhất</option>
                </select>
              </div>
            </header>
            {/* Giữ nguyên danh sách đang xem trong lúc nạp, chỉ làm mờ đi cho biết. */}
            <div
              className={questionsLoading ? 'reports-question-body is-loading' : 'reports-question-body'}
              aria-busy={questionsLoading}
            >
              <WeakestQuestionsPanel
                questions={rankedQuestions ?? data.weakestQuestions}
                totalResponses={data.totalResponses}
                lowestFirst={questionLowest}
              />
            </div>
          </div>
          )}

          {/* Bảng bộ môn chậm tiến độ nhất */}
          {analysisView === 'progress' && (
          <div className="reports-exec-card reports-analysis-panel" role="tabpanel">
            <header className="reports-exec-card-head">
              <Clock4 className="operation-icon" aria-hidden="true" />
              <h3>Bộ môn chậm tiến độ thu phiếu</h3>
              <span className="reports-exec-card-note">
                Đầy đủ Bộ môn dưới {laggingThreshold}% · sắp xếp tại tiêu đề cột
              </span>
            </header>
            <LaggingDepartmentsTable
              departments={laggingDepartments}
              onSelect={onDrillDown ? (departmentId) => onDrillDown({ departmentId }) : undefined}
            />
          </div>
          )}
        </>
      )}
    </section>
  );
};
