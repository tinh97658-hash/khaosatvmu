import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  ChevronRight,
  CircleAlert,
  GraduationCap,
  Info,
  Layers,
  Lightbulb,
  ListChecks,
  LoaderCircle,
  Minus,
  QrCode,
  RadioTower,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { useSemester } from '../context/semesterContext';
import { reportApi } from '../services/reportApi';
import { buildReportHash } from './reportRoute';
import { CompletionGauge } from '../components/reports/CompletionGauge';
import { SatisfactionGauge } from '../components/reports/SatisfactionGauge';
import { FacultyScoreChart } from '../components/reports/FacultyScoreChart';
import { FacultyCompletionChart } from '../components/reports/FacultyCompletionChart';
import { ScoreDistributionDonut } from '../components/reports/ScoreDistributionDonut';
import { WeakestQuestionsPanel } from '../components/reports/WeakestQuestionsPanel';
import { formatNumber, scoreColor, completionColor } from '../components/reports/theme';
import type {
  SchoolSurveyOverview as SchoolSurveyOverviewData,
  SurveyCampaign,
  SystemStats,
} from '../types';
import '../styles/reports.css';
import '../styles/dashboard.css';

interface DashboardOverviewProps {
  stats: SystemStats;
  campaigns: SurveyCampaign[];
  onOpenQR: (campaign: SurveyCampaign) => void;
  onNavigateTab: (tab: string) => void;
}

interface QuickAction {
  tab: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: 'blue' | 'teal' | 'green' | 'amber';
}

const quickActions: QuickAction[] = [
  {
    tab: 'faculties',
    title: 'Khoa / Viện',
    description: 'Cơ cấu đơn vị đào tạo',
    icon: Building2,
    tone: 'blue',
  },
  {
    tab: 'majors',
    title: 'Ngành đào tạo',
    description: 'Chương trình & chuẩn đầu ra',
    icon: GraduationCap,
    tone: 'teal',
  },
  {
    tab: 'courses',
    title: 'Học phần',
    description: 'Môn học & số tín chỉ',
    icon: BookOpen,
    tone: 'green',
  },
  {
    tab: 'course-question-sets',
    title: 'Bộ câu hỏi',
    description: 'Bộ câu hỏi & thang đánh giá',
    icon: ListChecks,
    tone: 'amber',
  },
];

const formatDate = (value: string) => {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const getProgress = (campaign: SurveyCampaign) => {
  if (campaign.totalTargetResponses <= 0) return 0;
  return Math.min(100, Math.round((campaign.actualResponses / campaign.totalTargetResponses) * 100));
};

const deltaClass = (delta: number): string => {
  if (delta > 0.005) return 'is-up';
  if (delta < -0.005) return 'is-down';
  return 'is-flat';
};

const getRatingLabel = (score: number): { label: string; tone: string } => {
  if (score >= 4.5) return { label: 'Xuất sắc', tone: '#137b3b' };
  if (score >= 4.0) return { label: 'Tốt', tone: '#0788b8' };
  if (score >= 3.0) return { label: 'Đạt yêu cầu', tone: '#b86216' };
  if (score > 0) return { label: 'Cần cải thiện', tone: '#b52d2d' };
  return { label: 'Chưa có điểm', tone: '#64748b' };
};

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
  stats,
  campaigns,
  onOpenQR,
  onNavigateTab,
}) => {
  const { academicYears, activeSemesterId, setActiveSemesterId } = useSemester();
  const [comparisonSemesterId, setComparisonSemesterId] = useState<number | undefined>(undefined);
  const [overviewData, setOverviewData] = useState<SchoolSurveyOverviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
  const hasResolvedInitialSemester = useRef(false);

  // View state cho biểu đồ
  const [facultyChartView, setFacultyChartView] = useState<'completion' | 'score'>('completion');
  const [qualityChartView, setQualityChartView] = useState<'distribution' | 'weakest'>('distribution');

  // Filter state cho bảng đơn vị
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'good' | 'progress' | 'lagging'>('all');

  const comparisonOptions = useMemo(() => {
    return academicYears.flatMap((year) =>
      year.semesters.map((sem) => ({
        semesterId: sem.semesterId,
        label: `${sem.semesterName} (${year.academicYearName})`,
      }))
    );
  }, [academicYears]);

  const loadOverview = useCallback(async () => {
    if (!activeSemesterId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let data = await reportApi.schoolOverview(activeSemesterId, comparisonSemesterId);

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
          const candidate = await reportApi.schoolOverview(semester.semesterId);
          if (candidate.totalSections > 0 && candidate.totalTargetResponses > 0) {
            data = candidate;
            setSelectionNotice(
              `Học kỳ được chọn ban đầu chưa có đợt khảo sát. Hệ thống đang hiển thị ${candidate.academicYearName} · ${candidate.semesterName}, là học kỳ gần nhất có dữ liệu.`,
            );
            setActiveSemesterId(candidate.semesterId);
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
  }, [academicYears, activeSemesterId, comparisonSemesterId, setActiveSemesterId]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    setComparisonSemesterId(undefined);
  }, [activeSemesterId]);

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
  const hasValidComparison = Boolean(
    overviewData?.semesterComparison
    && overviewData.semesterComparison.comparisonCompletionRate > 0
    && overviewData.semesterComparison.comparisonAverageScore > 0,
  );

  // Tóm tắt điều hành được suy ra trực tiếp từ số liệu báo cáo.
  const aiInsights = useMemo(() => {
    if (!overviewData || overviewData.totalSections === 0) return null;

    const sortedByCompletion = [...overviewData.faculties].sort(
      (a, b) => b.completionRate - a.completionRate
    );
    const topCompletionFaculty = sortedByCompletion[0];
    const laggingDepartments = overviewData.departments.filter((d) => d.completionRate < 40);
    const laggingFaculties = overviewData.faculties.filter((f) => f.completionRate < 40);

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
      comparison: hasValidComparison ? overviewData.semesterComparison : null,
    };
  }, [hasValidComparison, overviewData]);

  // Filtered Faculties Table Data
  const filteredFaculties = useMemo(() => {
    if (!overviewData?.faculties) return [];
    return overviewData.faculties.filter((f) => {
      const matchesSearch = f.facultyName.toLowerCase().includes(searchTerm.toLowerCase().trim());
      if (!matchesSearch) return false;

      if (filterStatus === 'good') return f.completionRate >= 80;
      if (filterStatus === 'progress') return f.completionRate >= 40 && f.completionRate < 80;
      if (filterStatus === 'lagging') return f.completionRate < 40;
      return true;
    });
  }, [overviewData?.faculties, searchTerm, filterStatus]);

  const handleDrillDownFaculty = (facultyId: number) => {
    if (activeSemesterId) {
      window.location.hash = buildReportHash({
        screen: 'overview',
        semesterId: activeSemesterId,
        facultyId,
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
                <strong>{overviewData.academicYearName} · {overviewData.semesterName}</strong> — Số liệu điều hành toàn trường
              </>
            ) : (
              'Hệ thống Đánh giá & Khảo sát Chất lượng Dạy - Học Đại học Hàng hải Việt Nam'
            )}
          </p>
        </div>

        <div className="executive-header-controls">
          <div className="executive-compare-select">
            <label htmlFor="exec-compare-semester">So sánh với:</label>
            <select
              id="exec-compare-semester"
              value={comparisonSemesterId ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                setComparisonSemesterId(val ? Number(val) : undefined);
              }}
            >
              <option value="">Học kỳ liền trước (Mặc định)</option>
              {comparisonOptions
                .filter((opt) => opt.semesterId !== activeSemesterId)
                .map((opt) => (
                  <option key={opt.semesterId} value={opt.semesterId}>
                    {opt.label}
                  </option>
                ))}
            </select>
          </div>

          {overviewData?.semesterComparison && hasValidComparison && (
            <div className="executive-deltas">
              <span className={`executive-delta-badge ${deltaClass(overviewData.semesterComparison.completionRateDelta)}`}>
                {overviewData.semesterComparison.completionRateDelta > 0.005 ? (
                  <TrendingUp aria-hidden="true" />
                ) : overviewData.semesterComparison.completionRateDelta < -0.005 ? (
                  <TrendingDown aria-hidden="true" />
                ) : (
                  <Minus aria-hidden="true" />
                )}
                Tiến độ {overviewData.semesterComparison.completionRateDelta > 0 ? '+' : ''}
                {overviewData.semesterComparison.completionRateDelta.toFixed(1)}%
              </span>
              <span className={`executive-delta-badge ${deltaClass(overviewData.semesterComparison.averageScoreDelta)}`}>
                {overviewData.semesterComparison.averageScoreDelta > 0.005 ? (
                  <TrendingUp aria-hidden="true" />
                ) : overviewData.semesterComparison.averageScoreDelta < -0.005 ? (
                  <TrendingDown aria-hidden="true" />
                ) : (
                  <Minus aria-hidden="true" />
                )}
                Điểm TB {overviewData.semesterComparison.averageScoreDelta > 0 ? '+' : ''}
                {overviewData.semesterComparison.averageScoreDelta.toFixed(2)}
              </span>
            </div>
          )}

          <button
            type="button"
            className="executive-btn-primary"
            onClick={() => onNavigateTab('reports')}
          >
            Báo cáo toàn diện
            <ArrowRight aria-hidden="true" />
          </button>
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

      {overviewData && !loading && !error && (
        <section className="executive-trust-strip" aria-label="Thông tin độ tin cậy của báo cáo">
          <span>
            <strong>Kỳ báo cáo:</strong> {overviewData.academicYearName} · {overviewData.semesterName}
          </span>
          <span>
            <strong>Độ phủ:</strong> {overviewData.faculties.length}/{stats.totalFaculties} Khoa/Viện có lớp được phát phiếu
          </span>
          <span>
            <strong>Cỡ mẫu:</strong> {formatNumber(overviewData.totalResponses)}/{formatNumber(overviewData.totalTargetResponses)} phiếu
          </span>
          <span>
            <strong>Nạp dữ liệu lúc:</strong> {formatLoadedAt(lastUpdatedAt)}
          </span>
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

      {/* 2. EXECUTIVE BRIEFING PANEL */}
      {!loading && !error && hasSurveyData && aiInsights && (
        <section className="executive-ai-brief" aria-label="Tóm tắt điều hành">
          <div className="executive-ai-header">
            <span className="executive-ai-tag">
              <Sparkles aria-hidden="true" />
              Tóm tắt điều hành · Thông tin nhanh cho Lãnh đạo
            </span>
            <span className="executive-ai-timestamp">Nạp lúc {formatLoadedAt(lastUpdatedAt)}</span>
          </div>

          <div className="executive-ai-grid">
            <div className="executive-ai-card is-highlight">
              <span className="executive-ai-label">
                <Target aria-hidden="true" />
                Tiến độ toàn trường
              </span>
              <div className="executive-ai-text">
                Đạt <strong>{aiInsights.completionRate.toFixed(1)}%</strong> chỉ tiêu thu phiếu (
                {formatNumber(overviewData?.totalResponses || 0)} / {formatNumber(overviewData?.totalTargetResponses || 0)} phiếu).
                {aiInsights.comparison && (
                  <span>
                    {' '}
                    Biến động: <strong>{aiInsights.comparison.completionRateDelta > 0 ? '+' : ''}{aiInsights.comparison.completionRateDelta.toFixed(1)}%</strong> so với {aiInsights.comparison.comparisonSemesterName}.
                  </span>
                )}
              </div>
            </div>

            <div className="executive-ai-card is-success">
              <span className="executive-ai-label">
                <Building2 aria-hidden="true" />
                Đơn vị dẫn đầu
              </span>
              <div className="executive-ai-text">
                {aiInsights.topCompletionFaculty && aiInsights.topCompletionFaculty.completionRate > 0 ? (
                  <>
                    <strong>{aiInsights.topCompletionFaculty.facultyName}</strong> dẫn đầu về tiến độ (
                    <strong>{aiInsights.topCompletionFaculty.completionRate.toFixed(1)}%</strong>)
                    {canPublishScore ? (
                      <>
                        {' '}với điểm TB{' '}
                        <strong>{aiInsights.topCompletionFaculty.averageScore.toFixed(2)}/5.0</strong>.
                      </>
                    ) : (
                      '. Điểm chất lượng đang được tạm ẩn do cỡ mẫu nhỏ.'
                    )}
                  </>
                ) : (
                  'Chưa có đơn vị đạt tiến độ để xác định đơn vị dẫn đầu.'
                )}
              </div>
            </div>

            <div className={`executive-ai-card ${aiInsights.laggingCount > 0 ? 'is-warning' : 'is-success'}`}>
              <span className="executive-ai-label">
                <ShieldAlert aria-hidden="true" />
                Cảnh báo đôn đốc
              </span>
              <div className="executive-ai-text">
                {aiInsights.laggingCount > 0 ? (
                  <>
                    Có <strong>{aiInsights.laggingFacultyCount} Khoa/Viện</strong> và{' '}
                    <strong>{aiInsights.laggingDepartmentCount} Bộ môn</strong> có tỷ lệ thu phiếu dưới{' '}
                    <strong>40%</strong>, cần đôn đốc hoàn thành chỉ tiêu.
                  </>
                ) : (
                  (overviewData?.faculties.length ?? 0) > 0
                    ? 'Các đơn vị có dữ liệu đều đạt ngưỡng tiến độ an toàn (≥40%).'
                    : 'Chưa có đủ dữ liệu đơn vị để đánh giá tiến độ.'
                )}
              </div>
            </div>

            <div className="executive-ai-card is-highlight">
              <span className="executive-ai-label">
                <Lightbulb aria-hidden="true" />
                Trọng tâm cải tiến
              </span>
              <div className="executive-ai-text">
                {canPublishScore && aiInsights.weakestQuestion ? (
                  <>
                    Tiêu chí điểm thấp nhất: <strong>"{aiInsights.weakestQuestion.questionText}"</strong> (
                    <strong>{aiInsights.weakestQuestion.averageScore.toFixed(2)}/5.0</strong>).
                  </>
                ) : (
                  'Chưa đủ mẫu hợp lệ để công bố tiêu chí cần cải tiến.'
                )}
              </div>
            </div>
          </div>
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
            <div className="executive-kpi-body">
              <CompletionGauge
                value={overviewData.completionRate}
                collected={overviewData.totalResponses}
                target={overviewData.totalTargetResponses}
                size={88}
              />
              <div>
                <div className="executive-kpi-main-number">
                  {overviewData.completionRate.toFixed(1)}
                  <span className="executive-kpi-unit">%</span>
                </div>
                <div className="executive-kpi-desc">
                  <strong>{formatNumber(overviewData.totalResponses)}</strong> / {formatNumber(overviewData.totalTargetResponses)} phiếu đã nộp
                </div>
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
            {canPublishScore ? (
              <SatisfactionGauge score={overviewData.overallAverageScore} label="Thang điểm chuẩn VMU" />
            ) : (
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
              <div className="executive-kpi-main-number" style={{ color: (overviewData.departments.filter(d => d.completionRate < 40).length > 0) ? '#b52d2d' : '#137b3b' }}>
                {overviewData.departments.filter((d) => d.completionRate < 40).length}
                <span className="executive-kpi-unit">Bộ môn &lt; 40%</span>
              </div>
              <div className="executive-kpi-desc">
                {overviewData.departments.filter((d) => d.completionRate < 40).length > 0 ? (
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
                Đạt chuẩn ≥80% ({overviewData.faculties.filter((f) => f.completionRate >= 80).length})
              </button>
              <button
                type="button"
                className={`executive-chip ${filterStatus === 'progress' ? 'is-active' : ''}`}
                onClick={() => setFilterStatus('progress')}
              >
                Đang thực hiện ({overviewData.faculties.filter((f) => f.completionRate >= 40 && f.completionRate < 80).length})
              </button>
              <button
                type="button"
                className={`executive-chip ${filterStatus === 'lagging' ? 'is-active' : ''}`}
                onClick={() => setFilterStatus('lagging')}
              >
                Cảnh báo chậm &lt;40% ({overviewData.faculties.filter((f) => f.completionRate < 40).length})
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
                  <th scope="col" style={{ width: 140 }}>Phiếu thu / Chỉ tiêu</th>
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
                          {faculty.completionRate >= 80 ? (
                            <span className="executive-status-pill is-good">Đạt chuẩn</span>
                          ) : faculty.completionRate >= 40 ? (
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
            <p>Theo dõi tiến độ phát phiếu và mã QR truy cập trực tiếp cho từng đợt</p>
          </div>
          <div className="dashboard-heading-actions">
            <span className="dashboard-result-count">{campaigns.length} đợt khảo sát</span>
            <button
              type="button"
              className="dashboard-manage-button"
              onClick={() => onNavigateTab('course-campaigns')}
            >
              Quản lý đợt khảo sát
              <ArrowRight aria-hidden="true" />
            </button>
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
                <th scope="col" className="dashboard-action-column">Mã QR</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="dashboard-empty-cell">
                    <RadioTower aria-hidden="true" />
                    <strong>Chưa có đợt khảo sát đang mở</strong>
                    <span>Các đợt khảo sát mới sẽ xuất hiện tại đây.</span>
                  </td>
                </tr>
              ) : (
                campaigns.map((campaign) => {
                  const progress = getProgress(campaign);
                  return (
                    <tr key={campaign.id}>
                      <td className="dashboard-campaign-name">
                        <strong title={campaign.title}>{campaign.title}</strong>
                        <span>
                          {campaign.semester} · {campaign.academicYear}
                        </span>
                      </td>
                      <td>
                        <span className="dashboard-type-label">{campaign.type}</span>
                      </td>
                      <td className="dashboard-date-cell">
                        {formatDate(campaign.startDate)}
                        <span aria-hidden="true">-</span>
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
                      <td className="dashboard-action-column">
                        <button
                          type="button"
                          className="dashboard-qr-button"
                          aria-label={`Mở mã QR cho ${campaign.title}`}
                          title="Mở mã QR"
                          onClick={() => onOpenQR(campaign)}
                        >
                          <QrCode aria-hidden="true" />
                          <span>Mã QR</span>
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

      {/* 7. PHÍM TẮT DANH MỤC ĐÀO TẠO */}
      <section className="dashboard-block" aria-labelledby="dashboard-catalog-title">
        <header className="dashboard-block-heading">
          <div>
            <h2 id="dashboard-catalog-title">Cơ cấu & Danh mục đào tạo</h2>
            <p>Truy cập nhanh dữ liệu nền phục vụ công tác khảo sát & đánh giá chất lượng</p>
          </div>
          <div className="dashboard-heading-actions">
            <span className="dashboard-result-count">
              {stats.totalFaculties} Khoa · {stats.totalMajors} Ngành · {stats.totalCourses} Học phần · {stats.totalClasses} Lớp
            </span>
          </div>
        </header>

        <div className="dashboard-quick-grid">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                type="button"
                key={action.tab}
                className={`dashboard-quick-action is-${action.tone}`}
                onClick={() => onNavigateTab(action.tab)}
              >
                <span className="dashboard-quick-icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="dashboard-quick-copy">
                  <strong>{action.title}</strong>
                  <small>{action.description}</small>
                </span>
                <ArrowRight className="dashboard-quick-arrow" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
