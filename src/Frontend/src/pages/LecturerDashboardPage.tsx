import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  LoaderCircle,
  type LucideIcon,
} from 'lucide-react';
import { useSemester } from '../context/semesterContext';
import { catalogApi } from '../services/catalogApi';
import { surveyApi } from '../services/surveyApi';
import '../styles/dashboard.css';

interface LecturerDashboardPageProps {
  onNavigateTab: (tab: string) => void;
}

interface QuickAction {
  tab: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: 'blue' | 'teal' | 'green';
}

/**
 * Đúng ba thẻ, và cả ba đều nằm trong quyền giảng viên đang có nên không thẻ nào bấm
 * vào lại bị đá ra. Trang Học phần không lên thẻ, vẫn vào được từ menu bên trái.
 * Xem congviec3.md mục I2.
 */
const quickActions: QuickAction[] = [
  {
    tab: 'classes',
    title: 'Lớp học phần',
    description: 'Lớp tôi dạy',
    icon: BookOpen,
    tone: 'blue',
  },
  {
    tab: 'course-campaigns',
    title: 'Khảo sát học phần',
    description: 'Phiếu của lớp tôi',
    icon: ClipboardCheck,
    tone: 'teal',
  },
  {
    tab: 'progress',
    title: 'Tiến độ thu phiếu',
    description: 'Vận hành khảo sát',
    icon: BarChart3,
    tone: 'green',
  },
];

interface LecturerMetrics {
  /** Lớp mình dạy trong học kỳ, kể cả lớp chưa được phát phiếu. */
  sectionCount: number;
  /** Lớp đã được phát phiếu trong đợt mới nhất. */
  surveyedCount: number;
  responseCount: number;
  targetCount: number;
}

export const LecturerDashboardPage: React.FC<LecturerDashboardPageProps> = ({
  onNavigateTab,
}) => {
  const { activeSemesterId, activeSemesterLabel } = useSemester();
  const [metrics, setMetrics] = useState<LecturerMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeSemesterId === null) {
      setMetrics(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        // Cả hai lời gọi đều đã được backend lọc về lớp của chính người đang đăng
        // nhập, nên trang này không phải biết gì về chuyện phân quyền.
        const [sections, surveys] = await Promise.all([
          catalogApi.courseSections(activeSemesterId),
          surveyApi.semesterSurveys(activeSemesterId),
        ]);
        if (cancelled) return;

        // Danh sách đợt trả về đã sắp mới nhất lên đầu.
        const latest = surveys[0] ?? null;
        const sectionSurveys = latest
          ? await surveyApi.courseSectionSurveys(latest.semesterSurveyId)
          : [];
        if (cancelled) return;

        setMetrics({
          sectionCount: sections.length,
          surveyedCount: sectionSurveys.length,
          responseCount: sectionSurveys.reduce((total, item) => total + item.responseCount, 0),
          targetCount: sectionSurveys.reduce((total, item) => total + item.classSize, 0),
        });
      } catch {
        // Hỏng một phần thì vẫn hiện ba thẻ, không chặn cả trang.
        if (!cancelled) setMetrics(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeSemesterId]);

  const completionRate = metrics && metrics.targetCount > 0
    ? (metrics.responseCount / metrics.targetCount) * 100
    : null;

  return (
    <div className="dashboard-page department-dashboard">
      <section className="dashboard-block">
        <div className="dashboard-block-heading">
          <div>
            <h2>Bảng điều khiển</h2>
            <p>Học kỳ đang xem: {activeSemesterLabel}</p>
          </div>
        </div>

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

      {/* Hai ô, không có ô điểm và không có số toàn trường để so: câu H-e chốt giảng
          viên chỉ xem tiến độ thu phiếu. Xem congviec3.md mục I3. */}
      <section className="dashboard-block">
        <div className="dashboard-block-heading">
          <div>
            <h2>Lớp của tôi</h2>
            <p>
              {metrics && metrics.surveyedCount > 0
                ? 'Số liệu của đợt khảo sát mới nhất trong học kỳ'
                : 'Học kỳ này chưa có đợt khảo sát nào cho lớp của bạn'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="dashboard-empty-cell" role="status">
            <LoaderCircle className="auth-spin" aria-hidden="true" />
            <span>Đang nạp số liệu...</span>
          </div>
        ) : (
          <div className="department-metric-grid">
            <div className="department-metric">
              <span className="department-metric__label">Lớp tôi dạy</span>
              <strong className="department-metric__value">
                {metrics ? metrics.sectionCount : '—'}
              </strong>
              <span className="department-metric__compare">
                {metrics ? `${metrics.surveyedCount} lớp đã phát phiếu` : '—'}
              </span>
            </div>

            <div className="department-metric">
              <span className="department-metric__label">Tiến độ thu phiếu</span>
              <strong className="department-metric__value">
                {completionRate === null ? '—' : `${completionRate.toFixed(1)}%`}
              </strong>
              <span className="department-metric__compare">
                {metrics
                  ? `${metrics.responseCount} / ${metrics.targetCount} phiếu`
                  : '—'}
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
