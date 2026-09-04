import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  ChevronRight,
  CircleAlert,
  GitCompareArrows,
  Info,
  Layers,
  Lightbulb,
  LoaderCircle,
  RadioTower,
  Search,
  ShieldAlert,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useSemester } from '../context/semesterContext';
import { reportApi } from '../services/reportApi';
import { surveyApi } from '../services/surveyApi';
import { buildReportHash } from './reportRoute';
import { FacultyScoreChart } from '../components/reports/FacultyScoreChart';
import { FacultyCompletionChart } from '../components/reports/FacultyCompletionChart';
import { ScoreDistributionDonut } from '../components/reports/ScoreDistributionDonut';
import { WeakestQuestionsPanel } from '../components/reports/WeakestQuestionsPanel';
import { formatNumber, scoreColor, completionColor } from '../components/reports/theme';
import type {
  SchoolSurveyOverview as SchoolSurveyOverviewData,
  SchoolOverviewComparisonOption,
  CourseSectionSurvey,
  SemesterSurvey,
} from '../types';
import {
  COMPLETED_COMPLETION_RATE,
  LAGGING_COMPLETION_RATE,
} from '../utils/reportThresholds';
import '../styles/reports.css';
import '../styles/dashboard.css';

interface DashboardOverviewProps {
  semesterSurveys: SemesterSurvey[];
  sectionSurveys: CourseSectionSurvey[];
  surveyLoading: boolean;
  surveyLoadError: string | null;
  onNavigateTab: (tab: string) => void;
  permissions: readonly string[];
}

/**
 * Tắt ô "So sánh với" và nút "Báo cáo toàn diện" trên thanh đầu trang. Tạm thời
 * theo yêu cầu; đổi thành true là hiện lại y như cũ.
 */
const showComparisonControls = false;

const formatDate = (value: string) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('vi-VN');
};

const getRatingLabel = (score: number): { label: string; tone: string } => {
  if (score >= 4.5) return { label: 'Xuất sắc', tone: '#137b3b' };
  if (score >= 4.0) return { label: 'Tốt', tone: '#0788b8' };
  if (score >= 3.0) return { label: 'Đạt yêu cầu', tone: '#b86216' };
  if (score > 0) return { label: 'Cần cải thiện', tone: '#b52d2d' };
  return { label: 'Chưa có điểm', tone: '#64748b' };
};

/** Dưới ngưỡng này thì một đơn vị bị coi là chậm tiến độ, khớp với các trang khác. */
const LAGGING_THRESHOLD = LAGGING_COMPLETION_RATE;

const MIN_RESPONSES_FOR_PUBLISHED_SCORE = 30;
const MIN_COMPLETION_RATE_FOR_PUBLISHED_SCORE = 5;

const formatLoadedAt = (value: Date | null): string =>
  value
    ? value.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  semesterSurveys,
  sectionSurveys,
  surveyLoading,
  surveyLoadError,
  onNavigateTab,
}) => {
  const { academicYears, activeSemesterId, setActiveSemesterId } = useSemester();
  const [comparisonOptions, setComparisonOptions] = useState<SchoolOverviewComparisonOption[]>([]);
  const [selectedSemesterSurveyId, setSelectedSemesterSurveyId] = useState<number | undefined>(undefined);
  const [comparisonKey, setComparisonKey] = useState('auto');
  const [overviewData, setOverviewData] = useState<SchoolSurveyOverviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
  const hasResolvedInitialSemester = useRef(false);
  const currentSemesterSurveys = useMemo(
    () => semesterSurveys.filter((survey) => survey.semesterId === activeSemesterId),
    [activeSemesterId, semesterSurveys],
  );

  // Giữ lựa chọn đồng bộ với danh sách đợt mà App đã nạp gộp cho học kỳ hiện tại.
  useEffect(() => {
    if (!activeSemesterId) {
      setSelectedSemesterSurveyId(undefined);
      return;
    }
    setSelectedSemesterSurveyId((prev) => {
      if (prev && currentSemesterSurveys.some((survey) => survey.semesterSurveyId === prev)) {
        return prev;
      }
      return currentSemesterSurveys[0]?.semesterSurveyId;
    });
  }, [activeSemesterId, currentSemesterSurveys]);

  useEffect(() => {
    let cancelled = false;
    reportApi.schoolOverviewComparisonOptions()
      .then((options) => {
        if (!cancelled) setComparisonOptions(options);
      })
      .catch(() => {
        if (!cancelled) setComparisonOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setComparisonKey('auto');
  }, [activeSemesterId, selectedSemesterSurveyId]);

  const selectedSurvey = useMemo(
    () => currentSemesterSurveys.find((s) => s.semesterSurveyId === selectedSemesterSurveyId),
    [currentSemesterSurveys, selectedSemesterSurveyId],
  );

  const compatibleComparisonSurveys = useMemo(() => {
    if (!selectedSurvey) return [];
    return comparisonOptions
      .filter((survey) => survey.surveyTemplateId === selectedSurvey.surveyTemplateId
        && survey.semesterSurveyId !== selectedSurvey.semesterSurveyId)
      .sort((left, right) => right.semesterSurveyId - left.semesterSurveyId);
  }, [comparisonOptions, selectedSurvey]);

  const comparisonSelection = useMemo(() => {
    const [kind, rawId] = comparisonKey.split(':');
    const id = Number(rawId);
    return {
      semesterId: kind === 'semester' && Number.isFinite(id) ? id : undefined,
      semesterSurveyId: kind === 'campaign' && Number.isFinite(id) ? id : undefined,
    };
  }, [comparisonKey]);

  // View state cho biểu đồ
  const [facultyChartView, setFacultyChartView] = useState<'completion' | 'score'>('completion');
  const [qualityChartView, setQualityChartView] = useState<'distribution' | 'weakest'>('distribution');

  // Filter state cho bảng đơn vị
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'good' | 'progress' | 'lagging'>('all');

  const loadOverview = useCallback(async () => {
    if (!activeSemesterId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let data = await reportApi.schoolOverview(
        activeSemesterId,
        comparisonSelection.semesterId,
        selectedSemesterSurveyId,
        comparisonSelection.semesterSurveyId,
      );

      // Trang điều hành không nên mở mặc định ở một kỳ hoàn toàn rỗng. Chỉ tự
      // tìm kỳ gần nhất có dữ liệu đúng một lần; các lựa chọn thủ công sau đó
      // vẫn được tôn trọng.
      if (
        !hasResolvedInitialSemester.current
        && data.totalSections === 0
        && data.totalTargetResponses === 0
      ) {
        hasResolvedInitialSemester.current = true;
        const semesterCandidates = academicYears
          .flatMap((year) => year.semesters)
          .filter((semester) => semester.semesterId !== activeSemesterId);

        for (const semester of semesterCandidates) {
          const candidateSurveys = await surveyApi.semesterSurveys(semester.semesterId);
          const candidateSurveyId = candidateSurveys[0]?.semesterSurveyId;
          const candidate = await reportApi.schoolOverview(semester.semesterId, undefined, candidateSurveyId);
          if (candidate.totalSections > 0 && candidate.totalTargetResponses > 0) {
            data = candidate;
            setSelectionNotice(
              `Học kỳ được chọn ban đầu chưa có đợt khảo sát. Hệ thống đang hiển thị ${candidate.academicYearName} · ${candidate.semesterName}, là học kỳ gần nhất có dữ liệu.`,
            );
            setActiveSemesterId(candidate.semesterId);
            setSelectedSemesterSurveyId(candidateSurveyId);
            break;
          }
        }
      } else {
        hasResolvedInitialSemester.current = true;
      }

      setOverviewData(data);
      setLastUpdatedAt(new Date());
    } catch {
      setError('Không thể tải bảng tổng quan số liệu điều hành toàn trường.');
    } finally {
      setLoading(false);
    }
  }, [academicYears, activeSemesterId, comparisonSelection, selectedSemesterSurveyId, setActiveSemesterId]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const hasSurveyData = Boolean(
    overviewData
    && overviewData.totalSections > 0
    && overviewData.totalTargetResponses > 0,
  );
  const canPublishScore = Boolean(
    overviewData
    && overviewData.totalResponses >= MIN_RESPONSES_FOR_PUBLISHED_SCORE
    && overviewData.completionRate >= MIN_COMPLETION_RATE_FOR_PUBLISHED_SCORE,
  );
  const canPublishComparisonScore = Boolean(
    canPublishScore
    && overviewData?.semesterComparison
    && overviewData.semesterComparison.comparisonResponseCount >= MIN_RESPONSES_FOR_PUBLISHED_SCORE
    && overviewData.semesterComparison.comparisonCompletionRate >= MIN_COMPLETION_RATE_FOR_PUBLISHED_SCORE,
  );
  // Tóm tắt điều hành được suy ra trực tiếp từ số liệu báo cáo.
  const aiInsights = useMemo(() => {
    if (!overviewData || overviewData.totalSections === 0) return null;

    const sortedByCompletion = [...overviewData.faculties].sort(
      (a, b) => b.completionRate - a.completionRate
    );
    const topCompletionFaculty = sortedByCompletion[0];
    const laggingDepartments = overviewData.departments.filter(
      (d) => d.completionRate < LAGGING_THRESHOLD,
    );
    const laggingFaculties = overviewData.faculties.filter(
      (f) => f.completionRate < LAGGING_THRESHOLD,
    );

    const weakestQuestion =
      overviewData.weakestQuestions.length > 0 ? overviewData.weakestQuestions[0] : null;

    return {
      topCompletionFaculty,
      laggingCount: laggingDepartments.length + laggingFaculties.length,
      laggingDepartmentCount: laggingDepartments.length,
      laggingFacultyCount: laggingFaculties.length,
      weakestQuestion,
      completionRate: overviewData.completionRate,
      averageScore: overviewData.overallAverageScore,
    };
  }, [overviewData]);

  // Filtered Faculties Table Data
  const filteredFaculties = useMemo(() => {
    if (!overviewData?.faculties) return [];
    return overviewData.faculties.filter((f) => {
      const matchesSearch = f.facultyName.toLowerCase().includes(searchTerm.toLowerCase().trim());
      if (!matchesSearch) return false;

      if (filterStatus === 'good') return f.completionRate >= COMPLETED_COMPLETION_RATE;
      if (filterStatus === 'progress') {
        return f.completionRate >= LAGGING_THRESHOLD
          && f.completionRate < COMPLETED_COMPLETION_RATE;
      }
      if (filterStatus === 'lagging') return f.completionRate < LAGGING_THRESHOLD;
      return true;
    });
  }, [overviewData?.faculties, searchTerm, filterStatus]);

  // Dựng các đợt từ dữ liệu backend thật; gộp lớp bằng một danh sách đã tải sẵn, không gọi API theo từng đợt.
  const displayedCampaigns = useMemo(() => {
    const sectionsBySurvey = new Map<number, CourseSectionSurvey[]>();
    sectionSurveys.forEach((section) => {
      const sections = sectionsBySurvey.get(section.semesterSurveyId) ?? [];
      sections.push(section);
      sectionsBySurvey.set(section.semesterSurveyId, sections);
    });

    const now = Date.now();
    return currentSemesterSurveys.map((survey) => {
      const sections = sectionsBySurvey.get(survey.semesterSurveyId) ?? [];
      const start = new Date(survey.startTime).getTime();
      const end = new Date(survey.endTime).getTime();
      const status = Number.isFinite(start) && now < start
        ? 'Sắp diễn ra'
        : Number.isFinite(end) && now > end
          ? 'Đã kết thúc'
          : 'Đang diễn ra';
      return {
        id: survey.semesterSurveyId,
        title: survey.surveyName,
        semester: survey.semesterName,
        academicYear: survey.academicYearName,
        startDate: survey.startTime,
        endDate: survey.endTime,
        status,
        totalTargetResponses: sections.reduce((sum, section) => sum + section.classSize, 0),
        actualResponses: sections.reduce((sum, section) => sum + section.validResponseCount, 0),
        sectionCount: sections.length,
      };
    });
  }, [currentSemesterSurveys, sectionSurveys]);

  const handleDrillDownFaculty = (facultyId: number) => {
    if (activeSemesterId) {
      window.location.hash = buildReportHash({
        screen: 'overview',
        semesterId: activeSemesterId,
        facultyId,
        semesterSurveyId: selectedSemesterSurveyId,
      });
      onNavigateTab('reports');
    }
  };

  return (
    <div className="executive-dashboard">
      {/* 1. EXECUTIVE HEADER BAR */}
      <header className="executive-header-bar" aria-label="Bảng điều hành Ban Giám Hiệu">
        <div className="executive-title-group">
          <h1>
            <BarChart3 className="operation-icon text-cyan-600" aria-hidden="true" />
            Bảng Điều Hành Khảo Sát & Đánh Giá Chất Lượng (BGH)
          </h1>
          <p>
            {overviewData ? (
              <>
                <strong>{overviewData.academicYearName} · {overviewData.semesterName}</strong>
                {selectedSurvey && (
                  <>
                    {' '}— Đợt: <strong>{selectedSurvey.surveyName}</strong> ({selectedSurvey.sectionSurveyCount} lớp)
                  </>
                )}
              </>
            ) : (
              'Hệ thống Đánh giá & Khảo sát Chất lượng Dạy - Học Đại học Hàng hải Việt Nam'
            )}
          </p>
        </div>

        <div className="executive-header-controls">
          <div className="executive-compare-select">
            <label htmlFor="dashboard-survey-campaign">Đợt khảo sát:</label>
            <select
              id="dashboard-survey-campaign"
              value={selectedSemesterSurveyId ?? ''}
              disabled={currentSemesterSurveys.length === 0}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedSemesterSurveyId(val ? Number(val) : undefined);
              }}
            >
              {currentSemesterSurveys.length === 0 ? (
                <option value="">Chưa có đợt khảo sát nào</option>
              ) : (
                <>
                  {currentSemesterSurveys.map((survey) => (
                    <option key={survey.semesterSurveyId} value={survey.semesterSurveyId}>
                      {survey.surveyName} ({survey.sectionSurveyCount} lớp)
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* Tạm ẩn theo yêu cầu. Giữ nguyên mã bên trong để bật lại chỉ bằng cách
              đổi cờ này thành true, khỏi phải dựng lại toàn bộ. */}
          {showComparisonControls && (
          <div className="executive-compare-select">
            <label htmlFor="dashboard-comparison">So sánh với:</label>
            <select
              id="dashboard-comparison"
              value={comparisonKey}
              onChange={(event) => setComparisonKey(event.target.value)}
            >
              <option value="auto">Tự động: mốc trước phù hợp</option>
              {compatibleComparisonSurveys.length > 0 && (
                <optgroup label="Đợt cùng bộ câu hỏi">
                  {compatibleComparisonSurveys.map((survey) => (
                    <option key={survey.semesterSurveyId} value={`campaign:${survey.semesterSurveyId}`}>
                      {survey.academicYearName} · {survey.semesterName} · {survey.surveyName}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label={selectedSurvey ? 'Học kỳ (cùng bộ câu hỏi)' : 'Toàn bộ học kỳ'}>
                {academicYears.flatMap((year) => year.semesters
                  .filter((semester) => semester.semesterId !== activeSemesterId)
                  .map((semester) => (
                    <option key={semester.semesterId} value={`semester:${semester.semesterId}`}>
                      {year.academicYearName} · {semester.semesterName}
                    </option>
                  )))}
              </optgroup>
            </select>
          </div>
          )}

          {showComparisonControls && (
          <button
            type="button"
            className="executive-btn-primary"
            onClick={() => {
              if (activeSemesterId) {
                window.location.hash = buildReportHash({
                  screen: 'overview',
                  semesterId: activeSemesterId,
                  semesterSurveyId: selectedSemesterSurveyId,
                });
              }
              onNavigateTab('reports');
            }}
          >
            Báo cáo toàn diện
            <ArrowRight aria-hidden="true" />
          </button>
          )}
        </div>
      </header>

      {/* LOADING & ERROR STATES */}
      {loading && (
        <section className="reports-exec reports-exec--loading" aria-label="Đang nạp dữ liệu">
          <LoaderCircle className="operation-icon auth-spin" aria-hidden="true" />
          <strong>Đang tổng hợp số liệu điều hành toàn trường...</strong>
        </section>
      )}

      {error && !loading && (
        <section className="reports-exec reports-exec--error" role="alert">
          <CircleAlert className="operation-icon" aria-hidden="true" />
          <span>{error}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadOverview()}>
            Thử lại
          </button>
        </section>
      )}

      {selectionNotice && !loading && !error && (
        <section className="executive-context-notice" role="status">
          <Info aria-hidden="true" />
          <span>{selectionNotice}</span>
          <button type="button" onClick={() => setSelectionNotice(null)}>
            Đã hiểu
          </button>
        </section>
      )}

      {overviewData && !loading && !error && !hasSurveyData && (
        <section className="executive-empty-state" aria-labelledby="executive-empty-title">
          <AlertTriangle aria-hidden="true" />
          <div>
            <h2 id="executive-empty-title">Học kỳ này chưa triển khai khảo sát</h2>
            <p>
              Chưa có lớp học phần hoặc chỉ tiêu thu phiếu. Hệ thống không đưa ra kết luận về tiến độ,
              chất lượng hay đơn vị cần lưu ý cho đến khi có dữ liệu hợp lệ.
            </p>
          </div>
          <button type="button" className="executive-btn-secondary" onClick={() => onNavigateTab('reports')}>
            Mở báo cáo toàn diện
            <ArrowRight aria-hidden="true" />
          </button>
        </section>
      )}

      {overviewData && !loading && !error && hasSurveyData && !canPublishScore && (
        <section className="executive-data-warning" role="status">
          <ShieldAlert aria-hidden="true" />
          <div>
            <strong>Chưa đủ mẫu để công bố chỉ số chất lượng</strong>
            <span>
              Hiện có {formatNumber(overviewData.totalResponses)} phiếu ({overviewData.completionRate.toFixed(1)}%).
              CSAT và phân tích chất lượng chỉ được công bố khi đạt tối thiểu {MIN_RESPONSES_FOR_PUBLISHED_SCORE} phiếu
              và {MIN_COMPLETION_RATE_FOR_PUBLISHED_SCORE}% chỉ tiêu.
            </span>
          </div>
        </section>
      )}

      {/* 2. ĐIỂM TIN — chỉ hai điều mà các thẻ số phía dưới không nói được:
             đơn vị nào đang dẫn đầu và tiêu chí nào đang yếu nhất. */}
      {!loading && !error && hasSurveyData && aiInsights && (
        <section className="executive-brief-strip" aria-label="Điểm tin điều hành">
          <span className="executive-brief-item">
            <Building2 aria-hidden="true" />
            Dẫn đầu tiến độ:{' '}
            {aiInsights.topCompletionFaculty && aiInsights.topCompletionFaculty.completionRate > 0 ? (
              <strong>
                {aiInsights.topCompletionFaculty.facultyName}{' '}
                ({aiInsights.topCompletionFaculty.completionRate.toFixed(1)}%)
              </strong>
            ) : (
              <strong>chưa xác định</strong>
            )}
          </span>

          <span className="executive-brief-item">
            <Lightbulb aria-hidden="true" />
            Tiêu chí yếu nhất:{' '}
            {canPublishScore && aiInsights.weakestQuestion ? (
              <strong title={aiInsights.weakestQuestion.questionText}>
                {aiInsights.weakestQuestion.questionText} (
                {aiInsights.weakestQuestion.averageScore.toFixed(2)}/5.0)
              </strong>
            ) : (
              <strong>chưa đủ mẫu để công bố</strong>
            )}
          </span>

          <span className="executive-brief-time">Nạp lúc {formatLoadedAt(lastUpdatedAt)}</span>
        </section>
      )}

      {/* 3. 4-CARD MACRO KPIS GRID */}
      {overviewData && !loading && !error && hasSurveyData && (
        <section className="executive-kpis-grid" aria-label="Các chỉ tiêu vĩ mô">
          {/* KPI 1: Completion Gauge */}
          <div className="executive-kpi-box">
            <div className="executive-kpi-header">
              <span className="executive-kpi-title">Tiến độ thu phiếu toàn trường</span>
              <Target className="operation-icon text-cyan-600" aria-hidden="true" />
            </div>
            <div>
              <div className="executive-kpi-main-number">
                {overviewData.completionRate.toFixed(1)}
                <span className="executive-kpi-unit">%</span>
              </div>
              <div className="executive-mini-track" aria-hidden="true">
                <div
                  className="executive-mini-fill"
                  style={{
                    width: `${Math.min(100, overviewData.completionRate)}%`,
                    background: completionColor(overviewData.completionRate),
                  }}
                />
              </div>
              <div className="executive-kpi-desc">
                <strong>{formatNumber(overviewData.totalResponses)}</strong> /{' '}
                {formatNumber(overviewData.totalTargetResponses)} phiếu hợp lệ
              </div>
            </div>
          </div>

          {/* KPI 2: Satisfaction Score Gauge */}
          <div className="executive-kpi-box">
            <div className="executive-kpi-header">
              <span className="executive-kpi-title">Chỉ số chất lượng đào tạo (CSAT)</span>
              <Star className="operation-icon text-amber-500" style={{ fill: 'currentColor' }} aria-hidden="true" />
            </div>
            <div className="executive-kpi-body">
              <div>
                <div
                  className="executive-kpi-main-number"
                  style={{ color: canPublishScore ? scoreColor(overviewData.overallAverageScore) : '#64748b' }}
                >
                  {canPublishScore && overviewData.overallAverageScore > 0
                    ? overviewData.overallAverageScore.toFixed(2)
                    : '—'}
                  <span className="executive-kpi-unit">{canPublishScore ? '/ 5.0' : 'Chưa đủ mẫu'}</span>
                </div>
                <div className="executive-kpi-desc">
                  {canPublishScore ? (
                    <>
                      Đánh giá xếp loại:{' '}
                      <strong style={{ color: getRatingLabel(overviewData.overallAverageScore).tone }}>
                        {getRatingLabel(overviewData.overallAverageScore).label}
                      </strong>
                    </>
                  ) : (
                    `Cần ≥${MIN_RESPONSES_FOR_PUBLISHED_SCORE} phiếu và ≥${MIN_COMPLETION_RATE_FOR_PUBLISHED_SCORE}% chỉ tiêu`
                  )}
                </div>
              </div>
            </div>
            {!canPublishScore && (
              <div className="executive-score-withheld">
                <ShieldAlert aria-hidden="true" />
                <span>Chỉ số đang được tạm ẩn để tránh diễn giải sai từ mẫu quá nhỏ.</span>
              </div>
            )}
          </div>

          {/* KPI 3: Class Section Progress */}
          <div className="executive-kpi-box">
            <div className="executive-kpi-header">
              <span className="executive-kpi-title">Tiến độ theo lớp học phần</span>
              <Layers className="operation-icon text-slate-600" aria-hidden="true" />
            </div>
            <div>
              <div className="executive-kpi-main-number">
                {overviewData.completedSectionCount}
                <span className="executive-kpi-unit">/ {overviewData.totalSections} lớp đạt</span>
              </div>
              <div className="executive-status-segments" aria-hidden="true">
                <div
                  className="executive-status-seg is-done"
                  style={{ width: `${overviewData.totalSections > 0 ? (overviewData.completedSectionCount / overviewData.totalSections) * 100 : 0}%` }}
                  title={`Hoàn thành: ${overviewData.completedSectionCount}`}
                />
                <div
                  className="executive-status-seg is-in-progress"
                  style={{ width: `${overviewData.totalSections > 0 ? (overviewData.inProgressSectionCount / overviewData.totalSections) * 100 : 0}%` }}
                  title={`Đang thu: ${overviewData.inProgressSectionCount}`}
                />
                <div
                  className="executive-status-seg is-lagging"
                  style={{ width: `${overviewData.totalSections > 0 ? (overviewData.laggingSectionCount / overviewData.totalSections) * 100 : 0}%` }}
                  title={`Chậm: ${overviewData.laggingSectionCount}`}
                />
              </div>
              <div className="executive-status-legend">
                <span className="executive-status-legend-item">
                  <span className="legend-indicator" style={{ background: '#10b981' }} />
                  Đạt: <strong>{overviewData.completedSectionCount}</strong>
                </span>
                <span className="executive-status-legend-item">
                  <span className="legend-indicator" style={{ background: '#0284c7' }} />
                  Đang thu: <strong>{overviewData.inProgressSectionCount}</strong>
                </span>
                <span className="executive-status-legend-item">
                  <span className="legend-indicator" style={{ background: '#f59e0b' }} />
                  Chậm: <strong>{overviewData.laggingSectionCount}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* KPI 4: Units Alert */}
          <div className="executive-kpi-box">
            <div className="executive-kpi-header">
              <span className="executive-kpi-title">Đơn vị & Bộ môn cần lưu ý</span>
              <AlertTriangle className="operation-icon text-amber-600" aria-hidden="true" />
            </div>
            <div>
              <div className="executive-kpi-main-number" style={{ color: (overviewData.departments.filter(d => d.completionRate < LAGGING_THRESHOLD).length > 0) ? '#b52d2d' : '#137b3b' }}>
                {overviewData.departments.filter((d) => d.completionRate < LAGGING_THRESHOLD).length}
                <span className="executive-kpi-unit">Bộ môn &lt; {LAGGING_THRESHOLD}%</span>
              </div>
              <div className="executive-kpi-desc">
                {overviewData.departments.filter((d) => d.completionRate < LAGGING_THRESHOLD).length > 0 ? (
                  <button
                    type="button"
                    className="executive-action-link"
                    style={{ marginTop: 6 }}
                    onClick={() => setFilterStatus('lagging')}
                  >
                    Xem danh sách cảnh báo
                    <ChevronRight style={{ width: 14, height: 14 }} aria-hidden="true" />
                  </button>
                ) : overviewData.departments.length > 0 ? (
                  'Các bộ môn có dữ liệu đều đạt ngưỡng tiến độ.'
                ) : (
                  'Chưa có dữ liệu bộ môn để đánh giá.'
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {overviewData?.semesterComparison && !loading && !error && hasSurveyData && (
        <section className="executive-comparison-panel" aria-labelledby="executive-comparison-title">
          <div className="executive-comparison-heading">
            <GitCompareArrows aria-hidden="true" />
            <div>
              <h2 id="executive-comparison-title">So sánh kết quả khảo sát</h2>
              <p>
                Mốc đối chiếu:{' '}
                <strong>
                  {overviewData.semesterComparison.comparisonAcademicYearName} ·{' '}
                  {overviewData.semesterComparison.comparisonSemesterName}
                  {overviewData.semesterComparison.comparisonTemplateName
                    ? ` · ${overviewData.semesterComparison.comparisonTemplateName}`
                    : ''}
                </strong>
              </p>
            </div>
          </div>

          <div className="executive-comparison-metrics">
            <div className="executive-comparison-metric">
              <span>Tiến độ thu phiếu</span>
              <strong>{overviewData.completionRate.toFixed(1)}%</strong>
              <small>Đối chiếu {overviewData.semesterComparison.comparisonCompletionRate.toFixed(1)}%</small>
              <span className={`executive-delta-badge ${overviewData.semesterComparison.completionRateDelta > 0 ? 'is-up' : overviewData.semesterComparison.completionRateDelta < 0 ? 'is-down' : 'is-flat'}`}>
                {overviewData.semesterComparison.completionRateDelta > 0
                  ? <TrendingUp aria-hidden="true" />
                  : overviewData.semesterComparison.completionRateDelta < 0
                    ? <TrendingDown aria-hidden="true" />
                    : null}
                {overviewData.semesterComparison.completionRateDelta > 0 ? '+' : ''}
                {overviewData.semesterComparison.completionRateDelta.toFixed(1)} điểm %
              </span>
            </div>

            <div className="executive-comparison-metric">
              <span>Điểm micro-average</span>
              <strong>{canPublishComparisonScore ? overviewData.overallAverageScore.toFixed(2) : '—'}</strong>
              <small>
                Đối chiếu {canPublishComparisonScore
                  ? overviewData.semesterComparison.comparisonAverageScore.toFixed(2)
                  : 'chưa đủ mẫu'}
              </small>
              {canPublishComparisonScore && (
                <span className={`executive-delta-badge ${overviewData.semesterComparison.averageScoreDelta > 0 ? 'is-up' : overviewData.semesterComparison.averageScoreDelta < 0 ? 'is-down' : 'is-flat'}`}>
                  {overviewData.semesterComparison.averageScoreDelta > 0
                    ? <TrendingUp aria-hidden="true" />
                    : overviewData.semesterComparison.averageScoreDelta < 0
                      ? <TrendingDown aria-hidden="true" />
                      : null}
                  {overviewData.semesterComparison.averageScoreDelta > 0 ? '+' : ''}
                  {overviewData.semesterComparison.averageScoreDelta.toFixed(2)} điểm
                </span>
              )}
            </div>

            <div className="executive-comparison-sample">
              <span>Mẫu đối chiếu</span>
              <strong>{formatNumber(overviewData.semesterComparison.comparisonResponseCount)}</strong>
              <small>
                / {formatNumber(overviewData.semesterComparison.comparisonTargetResponses)} phiếu ·{' '}
                {overviewData.semesterComparison.comparisonSectionCount} lớp
              </small>
              <p>Tổng điểm phiếu hợp lệ / tổng số phiếu hợp lệ; không lấy trung bình của các trung bình lớp.</p>
            </div>
          </div>
        </section>
      )}

      {/* 4. 2-COLUMN ANALYTICS GRID (60% / 40%) */}
      {overviewData && !loading && !error && hasSurveyData && (
        <section className="executive-charts-row" aria-label="Phân tích chi tiết">
          {/* Left Card: Faculty Benchmarking (60%) */}
          <div className="executive-card">
            <div className="executive-card-header">
              <div className="executive-card-heading">
                <Building2 className="operation-icon text-cyan-600" aria-hidden="true" />
                <h3>Đối Sánh Hiệu Suất Theo Khoa / Viện</h3>
              </div>
              <div className="executive-tab-pill-group" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={facultyChartView === 'completion'}
                  className={`executive-tab-pill ${facultyChartView === 'completion' ? 'is-active' : ''}`}
                  onClick={() => setFacultyChartView('completion')}
                >
                  % Tiến độ thu phiếu
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={facultyChartView === 'score'}
                  className={`executive-tab-pill ${facultyChartView === 'score' ? 'is-active' : ''}`}
                  onClick={() => setFacultyChartView('score')}
                  disabled={!canPublishScore}
                  title={!canPublishScore ? 'Chưa đủ mẫu để công bố điểm chất lượng' : undefined}
                >
                  Điểm chất lượng TB
                </button>
              </div>
            </div>
            <div className="executive-card-body">
              {facultyChartView === 'completion' ? (
                <FacultyCompletionChart
                  faculties={overviewData.faculties}
                  onSelect={handleDrillDownFaculty}
                />
              ) : (
                <FacultyScoreChart
                  faculties={overviewData.faculties}
                  schoolAverage={overviewData.overallAverageScore}
                  onSelect={handleDrillDownFaculty}
                />
              )}
            </div>
          </div>

          {/* Right Card: Quality Breakdown & Weakest Questions (40%) */}
          <div className="executive-card">
            <div className="executive-card-header">
              <div className="executive-card-heading">
                <Star className="operation-icon text-amber-500" aria-hidden="true" />
                <h3>Cơ Cấu Đánh Giá & Tiêu Chí</h3>
              </div>
              <div className="executive-tab-pill-group" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={qualityChartView === 'distribution'}
                  className={`executive-tab-pill ${qualityChartView === 'distribution' ? 'is-active' : ''}`}
                  onClick={() => setQualityChartView('distribution')}
                  disabled={!canPublishScore}
                >
                  Phân bố mức độ
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={qualityChartView === 'weakest'}
                  className={`executive-tab-pill ${qualityChartView === 'weakest' ? 'is-active' : ''}`}
                  onClick={() => setQualityChartView('weakest')}
                  disabled={!canPublishScore}
                >
                  Top tiêu chí yếu nhất
                </button>
              </div>
            </div>
            <div className="executive-card-body">
              {!canPublishScore ? (
                <div className="executive-quality-withheld">
                  <ShieldAlert aria-hidden="true" />
                  <strong>Phân tích chất lượng đang được tạm ẩn</strong>
                  <span>Cần đủ cỡ mẫu trước khi công bố phân bố điểm và tiêu chí yếu.</span>
                </div>
              ) : qualityChartView === 'distribution' ? (
                <ScoreDistributionDonut
                  scoreDistribution={overviewData.scoreDistribution}
                  totalResponses={overviewData.totalResponses}
                />
              ) : (
                <WeakestQuestionsPanel
                  questions={overviewData.weakestQuestions}
                  totalResponses={overviewData.totalResponses}
                />
              )}
            </div>
          </div>
        </section>
      )}

      {/* 5. EXECUTIVE UNIT MONITORING TABLE */}
      {overviewData && !loading && !error && hasSurveyData && (
        <section className="executive-table-card" aria-label="Bảng giám sát chi tiết theo Khoa / Viện">
          <div className="executive-table-toolbar">
            <div className="executive-search-input">
              <Search style={{ width: 14, height: 14, color: '#94a3b8' }} aria-hidden="true" />
              <input
                type="text"
                placeholder="Tìm kiếm Khoa / Viện..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="executive-filter-chips">
              <button
                type="button"
                className={`executive-chip ${filterStatus === 'all' ? 'is-active' : ''}`}
                onClick={() => setFilterStatus('all')}
              >
                Tất cả ({overviewData.faculties.length})
              </button>
              <button
                type="button"
                className={`executive-chip ${filterStatus === 'good' ? 'is-active' : ''}`}
                onClick={() => setFilterStatus('good')}
              >
                Đạt chuẩn ≥{COMPLETED_COMPLETION_RATE}% (
                {overviewData.faculties.filter(
                  (f) => f.completionRate >= COMPLETED_COMPLETION_RATE
                ).length}
                )
              </button>
              <button
                type="button"
                className={`executive-chip ${filterStatus === 'progress' ? 'is-active' : ''}`}
                onClick={() => setFilterStatus('progress')}
              >
                Đang thu ({overviewData.faculties.filter((f) => f.completionRate >= LAGGING_THRESHOLD && f.completionRate < 80).length})
              </button>
              <button
                type="button"
                className={`executive-chip ${filterStatus === 'lagging' ? 'is-active' : ''}`}
                onClick={() => setFilterStatus('lagging')}
              >
                Chậm &lt;{LAGGING_THRESHOLD}% ({overviewData.faculties.filter((f) => f.completionRate < LAGGING_THRESHOLD).length})
              </button>
            </div>
          </div>

          <div className="dashboard-table-scroll">
            <table className="executive-grid-table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: 48 }}>STT</th>
                  <th scope="col">Khoa / Viện Đào tạo</th>
                  <th scope="col" style={{ width: 130 }}>Quy mô</th>
                  <th scope="col" style={{ width: 150 }}>Phiếu hợp lệ / Chỉ tiêu</th>
                  <th scope="col" style={{ width: 180 }}>Tiến độ thu phiếu</th>
                  <th scope="col" style={{ width: 110 }}>Điểm TB</th>
                  <th scope="col" style={{ width: 130 }}>Trạng thái</th>
                  <th scope="col" style={{ width: 110, textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredFaculties.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="dashboard-empty-cell">
                      <Info aria-hidden="true" />
                      <strong>Không tìm thấy đơn vị đào tạo phù hợp</strong>
                      <span>Thử đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái.</span>
                    </td>
                  </tr>
                ) : (
                  filteredFaculties.map((faculty, idx) => {
                    const color = completionColor(faculty.completionRate);
                    return (
                      <tr key={faculty.facultyId}>
                        <td style={{ color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                          {idx + 1}
                        </td>
                        <td>
                          <strong>{faculty.facultyName}</strong>
                        </td>
                        <td>
                          <span style={{ color: '#64748b' }}>
                            {faculty.departmentCount} BM · {faculty.sectionCount} Lớp
                          </span>
                        </td>
                        <td>
                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                            <strong>{formatNumber(faculty.responseCount)}</strong> / {formatNumber(faculty.targetResponses)}
                          </span>
                        </td>
                        <td>
                          <div className="executive-mini-bar">
                            <div className="executive-mini-track">
                              <div
                                className="executive-mini-fill"
                                style={{ width: `${Math.min(100, faculty.completionRate)}%`, background: color }}
                              />
                            </div>
                            <span style={{ color, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                              {faculty.completionRate.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td>
                          <span style={{ color: scoreColor(faculty.averageScore), fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {faculty.averageScore > 0 ? faculty.averageScore.toFixed(2) : '—'} / 5.0
                          </span>
                        </td>
                        <td>
                          {faculty.completionRate >= COMPLETED_COMPLETION_RATE ? (
                            <span className="executive-status-pill is-good">Đạt chuẩn</span>
                          ) : faculty.completionRate >= LAGGING_THRESHOLD ? (
                            <span className="executive-status-pill is-ok">Đang thu</span>
                          ) : (
                            <span className="executive-status-pill is-alert">Chậm tiến độ</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="executive-action-link"
                            onClick={() => handleDrillDownFaculty(faculty.facultyId)}
                          >
                            Chi tiết
                            <ChevronRight style={{ width: 14, height: 14 }} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 6. ĐỢT KHẢO SÁT ĐANG MỞ (CAMPAIGNS) */}
      <section className="dashboard-block dashboard-campaigns" aria-labelledby="dashboard-campaigns-title">
        <header className="dashboard-block-heading dashboard-campaigns-heading">
          <div>
            <h2 id="dashboard-campaigns-title">Đợt khảo sát đang tiếp nhận phản hồi</h2>
            <p>Theo dõi tiến độ phát phiếu và điều hướng trực tiếp tới từng đợt khảo sát</p>
          </div>
          <div className="dashboard-heading-actions">
            <span className="dashboard-result-count">
              {surveyLoading ? 'Đang tải...' : `${displayedCampaigns.length} đợt khảo sát`}
            </span>
          </div>
        </header>

        <div className="dashboard-table-scroll">
          <table className="dashboard-campaign-table">
            <thead>
              <tr>
                <th scope="col">Đợt khảo sát</th>
                <th scope="col">Phân loại</th>
                <th scope="col">Thời gian</th>
                <th scope="col">Tiến độ thu phiếu</th>
                <th scope="col">Trạng thái</th>
                <th scope="col" style={{ width: 120, textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {surveyLoading ? (
                <tr>
                  <td colSpan={6} className="dashboard-empty-cell">
                    <LoaderCircle className="auth-spin" aria-hidden="true" />
                    <strong>Đang nạp các đợt khảo sát</strong>
                    <span>Hệ thống đang tổng hợp tiến độ phiếu hợp lệ của học kỳ.</span>
                  </td>
                </tr>
              ) : surveyLoadError ? (
                <tr>
                  <td colSpan={6} className="dashboard-empty-cell">
                    <CircleAlert aria-hidden="true" />
                    <strong>Không tải được dữ liệu đợt khảo sát</strong>
                    <span>{surveyLoadError}</span>
                  </td>
                </tr>
              ) : displayedCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="dashboard-empty-cell">
                    <RadioTower aria-hidden="true" />
                    <strong>Chưa có đợt khảo sát đang mở</strong>
                    <span>Các đợt khảo sát mới sẽ xuất hiện tại đây.</span>
                  </td>
                </tr>
              ) : (
                displayedCampaigns.map((campaign) => {
                  const progress = campaign.totalTargetResponses > 0
                    ? Math.min(100, Math.round(
                        (campaign.actualResponses / campaign.totalTargetResponses) * 100,
                      ))
                    : 0;
                  return (
                    <tr
                      key={campaign.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => onNavigateTab('course-campaigns')}
                    >
                      <td className="dashboard-campaign-name">
                        <strong title={campaign.title}>{campaign.title}</strong>
                        <span>
                          {campaign.semester} · {campaign.academicYear} · {campaign.sectionCount} lớp
                        </span>
                      </td>
                      <td>
                        <span className="dashboard-type-label">Học phần</span>
                      </td>
                      <td className="dashboard-date-cell">
                        {formatDate(campaign.startDate)}
                        <span aria-hidden="true"> - </span>
                        {formatDate(campaign.endDate)}
                      </td>
                      <td>
                        <div
                          className="dashboard-progress"
                          aria-label={`Đã thu ${campaign.actualResponses} trên ${campaign.totalTargetResponses} phiếu, đạt ${progress}%`}
                        >
                          <div className="dashboard-progress-track" aria-hidden="true">
                            <span style={{ width: `${progress}%` }} />
                          </div>
                          <span className="dashboard-progress-value">
                            {campaign.actualResponses.toLocaleString('vi-VN')}
                            <small> / {campaign.totalTargetResponses.toLocaleString('vi-VN')}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`dashboard-status ${campaign.status === 'Đang diễn ra' ? 'is-active' : campaign.status === 'Sắp diễn ra' ? 'is-upcoming' : 'is-complete'}`}>
                          <span aria-hidden="true" />
                          {campaign.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="executive-action-link"
                          aria-label={`Vào đợt khảo sát ${campaign.title}`}
                          title="Vào đợt khảo sát"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateTab('course-campaigns');
                          }}
                        >
                          Vào khảo sát
                          <ChevronRight style={{ width: 14, height: 14 }} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
};
