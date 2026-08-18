import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Clock4,
  LoaderCircle,
  Minus,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { reportApi } from '../../services/reportApi';
import type { SchoolSurveyOverview as SchoolSurveyOverviewData } from '../../types';
import { CompletionGauge } from './CompletionGauge';
import { SatisfactionGauge } from './SatisfactionGauge';
import { FacultyScoreChart } from './FacultyScoreChart';
import { FacultyCompletionChart } from './FacultyCompletionChart';
import { ScoreDistributionDonut } from './ScoreDistributionDonut';
import { WeakestQuestionsPanel } from './WeakestQuestionsPanel';
import { LaggingDepartmentsTable } from './LaggingDepartmentsTable';
import { formatNumber } from './theme';

export interface SchoolOverviewDrillDown {
  facultyId?: number;
  departmentId?: number;
}

interface SchoolSurveyOverviewProps {
  semesterId: number;
  onDrillDown?: (filter: SchoolOverviewDrillDown) => void;
}

const deltaClass = (delta: number): string => {
  if (delta > 0.005) return 'is-up';
  if (delta < -0.005) return 'is-down';
  return 'is-flat';
};

/** Bảng tổng quan toàn trường — executive dashboard đặt đầu trang Thống kê & Báo cáo. */
export const SchoolSurveyOverview: React.FC<SchoolSurveyOverviewProps> = ({
  semesterId,
  onDrillDown,
}) => {
  const [data, setData] = useState<SchoolSurveyOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!semesterId) return;
    setLoading(true);
    setError(null);
    try {
      const overview = await reportApi.schoolOverview(semesterId);
      setData(overview);
    } catch {
      setError('Không thể tải bảng tổng quan kết quả khảo sát toàn trường.');
    } finally {
      setLoading(false);
    }
  }, [semesterId]);

  useEffect(() => {
    void load();
  }, [load]);

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
  const comparison = data.previousSemester;

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
        {comparison && (
          <div className="reports-exec-compare" aria-label={`So sánh với ${comparison.previousSemesterName}`}>
            <span className="reports-exec-compare-label">
              So với {comparison.previousSemesterName} · {comparison.previousAcademicYearName}
            </span>
            <span className={`reports-exec-delta ${deltaClass(comparison.completionRateDelta)}`}>
              {comparison.completionRateDelta > 0.005 ? <TrendingUp aria-hidden="true" /> : comparison.completionRateDelta < -0.005 ? <TrendingDown aria-hidden="true" /> : <Minus aria-hidden="true" />}
              Tiến độ {comparison.completionRateDelta > 0 ? '+' : ''}{comparison.completionRateDelta.toFixed(1)}%
            </span>
            <span className={`reports-exec-delta ${deltaClass(comparison.averageScoreDelta)}`}>
              {comparison.averageScoreDelta > 0.005 ? <TrendingUp aria-hidden="true" /> : comparison.averageScoreDelta < -0.005 ? <TrendingDown aria-hidden="true" /> : <Minus aria-hidden="true" />}
              Điểm TB {comparison.averageScoreDelta > 0 ? '+' : ''}{comparison.averageScoreDelta.toFixed(2)}
            </span>
          </div>
        )}
      </header>

      {!hasData ? (
        <div className="reports-exec-empty">
          <AlertTriangle className="operation-icon" aria-hidden="true" />
          <strong>Chưa có dữ liệu cho học kỳ này</strong>
          <span>Hệ thống chưa phát đợt khảo sát nào hoặc chưa có phiếu trả lời.</span>
        </div>
      ) : (
        <>
          {/* Hàng KPI: tiến độ + điểm hài lòng + trạng thái lớp */}
          <div className="reports-exec-kpis">
            <div className="reports-exec-kpi reports-exec-kpi--gauge">
              <CompletionGauge
                value={data.completionRate}
                collected={data.totalResponses}
                target={data.totalTargetResponses}
              />
              <div className="reports-exec-kpi-copy">
                <span>Tiến độ thu phiếu</span>
                <strong>{data.completionRate.toFixed(1)}%</strong>
                <small>
                  {formatNumber(data.totalResponses)} / {formatNumber(data.totalTargetResponses)} phiếu
                </small>
              </div>
            </div>

            <div className="reports-exec-kpi">
              <SatisfactionGauge score={data.overallAverageScore} label="Điểm hài lòng toàn trường" />
            </div>

            <div className="reports-exec-kpi reports-exec-kpi--status">
              <span className="reports-exec-kpi-label">Trạng thái các lớp khảo sát</span>
              <div className="reports-exec-statusbar" aria-hidden="true">
                <span
                  className="reports-exec-statusbar-seg is-complete"
                  style={{ width: `${data.totalSections > 0 ? (data.completedSectionCount / data.totalSections) * 100 : 0}%` }}
                  title={`Hoàn thành: ${data.completedSectionCount}`}
                />
                <span
                  className="reports-exec-statusbar-seg is-progress"
                  style={{ width: `${data.totalSections > 0 ? (data.inProgressSectionCount / data.totalSections) * 100 : 0}%` }}
                  title={`Đang thu: ${data.inProgressSectionCount}`}
                />
                <span
                  className="reports-exec-statusbar-seg is-lagging"
                  style={{ width: `${data.totalSections > 0 ? (data.laggingSectionCount / data.totalSections) * 100 : 0}%` }}
                  title={`Chậm tiến độ: ${data.laggingSectionCount}`}
                />
              </div>
              <ul className="reports-exec-statuslegend">
                <li>
                  <span className="legend-dot" style={{ background: '#137b3b' }} />
                  Hoàn thành <strong>{data.completedSectionCount}</strong>
                </li>
                <li>
                  <span className="legend-dot" style={{ background: '#0788b8' }} />
                  Đang thu <strong>{data.inProgressSectionCount}</strong>
                </li>
                <li>
                  <span className="legend-dot" style={{ background: '#b86216' }} />
                  Chậm tiến độ <strong>{data.laggingSectionCount}</strong>
                </li>
              </ul>
              <small className="reports-exec-kpi-sub">
                Tổng <strong>{data.totalSections}</strong> lớp đã phát phiếu
              </small>
            </div>
          </div>

          {/* Hàng biểu đồ: điểm TB + tiến độ theo Khoa */}
          <div className="reports-exec-grid">
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

          {/* Hàng thứ 2: tiêu chí yếu nhất + phân bố điểm */}
          <div className="reports-exec-grid">
            <div className="reports-exec-card">
              <header className="reports-exec-card-head">
                <AlertTriangle className="operation-icon" aria-hidden="true" />
                <h3>Tiêu chí cần cải tiến (điểm thấp nhất)</h3>
              </header>
              <WeakestQuestionsPanel
                questions={data.weakestQuestions}
                totalResponses={data.totalResponses}
              />
            </div>

            <div className="reports-exec-card">
              <header className="reports-exec-card-head">
                <CheckCircle2 className="operation-icon" aria-hidden="true" />
                <h3>Phân bố điểm toàn trường</h3>
              </header>
              <ScoreDistributionDonut
                scoreDistribution={data.scoreDistribution}
                totalResponses={data.totalResponses}
              />
            </div>
          </div>

          {/* Bảng bộ môn chậm tiến độ nhất */}
          <div className="reports-exec-card">
            <header className="reports-exec-card-head">
              <Clock4 className="operation-icon" aria-hidden="true" />
              <h3>Bộ môn chậm tiến độ thu phiếu nhất</h3>
              <span className="reports-exec-card-note">Click vào dòng để lọc chi tiết</span>
            </header>
            <LaggingDepartmentsTable
              departments={data.departments}
              limit={6}
              onSelect={onDrillDown ? (departmentId) => onDrillDown({ departmentId }) : undefined}
            />
          </div>
        </>
      )}
    </section>
  );
};
