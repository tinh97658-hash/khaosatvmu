import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bell,
  BookOpen,
  CircleAlert,
  LoaderCircle,
  Sigma,
  Users,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import { useSemester } from '../context/semesterContext';
import { catalogApi, type UnidentifiedLecturerReport } from '../services/catalogApi';
import { surveyApi, type DepartmentDashboard } from '../services/surveyApi';
import '../styles/dashboard.css';

interface DepartmentDashboardPageProps {
  onNavigateTab: (tab: string) => void;
}

interface QuickAction {
  tab: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: 'blue' | 'teal' | 'green' | 'amber';
}

/**
 * Bốn thẻ chọn theo VIỆC PHẢI LÀM chứ không theo bản của quản trị. Đây là bốn thứ
 * trưởng bộ môn thực sự phải động vào: sửa lớp thiếu giảng viên, quản nhân sự bộ môn,
 * giục thu phiếu, xem chẩn đoán. Năm trang còn lại vẫn vào được từ menu bên trái.
 * Xem congviec2.md mục F2.
 */
const quickActions: QuickAction[] = [
  {
    tab: 'classes',
    title: 'Lớp học phần',
    description: 'Dữ liệu khảo sát của bộ môn',
    icon: BookOpen,
    tone: 'blue',
  },
  {
    tab: 'lecturers',
    title: 'Giảng viên',
    description: 'Nhân sự bộ môn',
    icon: Users,
    tone: 'teal',
  },
  {
    tab: 'progress',
    title: 'Tiến độ thu phiếu',
    description: 'Vận hành khảo sát',
    icon: BarChart3,
    tone: 'green',
  },
  {
    tab: 'survey-analysis',
    title: 'Phân tích chuyên sâu',
    description: 'Chuẩn hoá và chẩn đoán',
    icon: Sigma,
    tone: 'amber',
  },
];

const formatScore = (value: number | null) => (value === null ? '—' : value.toFixed(2));
const formatRate = (value: number) => `${value.toFixed(1)}%`;

export const DepartmentDashboardPage: React.FC<DepartmentDashboardPageProps> = ({
  onNavigateTab,
}) => {
  const { activeSemesterId, activeSemesterLabel } = useSemester();
  const [metrics, setMetrics] = useState<DepartmentDashboard | null>(null);
  const [unidentified, setUnidentified] = useState<UnidentifiedLecturerReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeSemesterId === null) {
      setMetrics(null);
      setUnidentified(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        // Chỉ số gắn với ĐỢT khảo sát, còn danh sách lớp thiếu giảng viên gắn với HỌC
        // KỲ. Học kỳ chưa mở đợt nào thì phần chỉ số để trống, phần thông báo vẫn chạy.
        const [surveys, report] = await Promise.all([
          surveyApi.semesterSurveys(activeSemesterId),
          catalogApi.unidentifiedLecturers(activeSemesterId),
        ]);
        if (cancelled) return;
        setUnidentified(report);

        const latest = surveys.at(-1) ?? null;
        setMetrics(latest ? await surveyApi.departmentDashboard(latest.semesterSurveyId) : null);
      } catch {
        // Bảng điều khiển hỏng một phần thì vẫn hiện phần còn lại, không chặn cả trang.
        if (!cancelled) setMetrics(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeSemesterId]);

  const unidentifiedCount = unidentified?.sectionCount ?? 0;

  return (
    <div className="dashboard-page department-dashboard">
      <section className="dashboard-block">
        <div className="dashboard-block-heading">
          <div>
            <h2>
              Bảng điều khiển
              {metrics?.departmentName && <> · Bộ môn {metrics.departmentName}</>}
            </h2>
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

      {/* Mỗi ô một số của bộ môn và một số toàn trường ngay dưới. Số toàn trường LUÔN
          tính trên toàn bộ dữ liệu, không tính lại trong phạm vi bộ môn — nếu không thì
          "so với mặt bằng" mất hết ý nghĩa. Xem congviec2.md mục D6. */}
      <section className="dashboard-block">
        <div className="dashboard-block-heading">
          <div>
            <h2>Chỉ số bộ môn</h2>
            <p>
              {metrics
                ? `Đợt khảo sát: ${metrics.templateName}`
                : 'Học kỳ này chưa có đợt khảo sát nào'}
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
              <span className="department-metric__label">Tiến độ thu phiếu</span>
              <strong className="department-metric__value">
                {metrics ? formatRate(metrics.completionRate) : '—'}
              </strong>
              <span className="department-metric__compare">
                Toàn trường {metrics ? formatRate(metrics.schoolCompletionRate) : '—'}
              </span>
            </div>

            <div className="department-metric">
              <span className="department-metric__label">Điểm trung bình</span>
              <strong className="department-metric__value">
                {metrics ? formatScore(metrics.averageScore) : '—'}
              </strong>
              <span className="department-metric__compare">
                Toàn trường {metrics ? formatScore(metrics.schoolAverageScore) : '—'}
              </span>
            </div>

            <div className="department-metric">
              <span className="department-metric__label">Lớp cần lưu ý</span>
              <strong className="department-metric__value">
                {metrics ? metrics.weakSectionCount : '—'}
              </strong>
              <span className="department-metric__compare">
                Dưới {metrics ? metrics.weakScoreThreshold.toFixed(2) : '—'} điểm
              </span>
            </div>

            <div className="department-metric">
              <span className="department-metric__label">Lớp chưa có giảng viên</span>
              <strong className="department-metric__value">{unidentifiedCount}</strong>
              <span className="department-metric__compare">
                {unidentified && unidentified.lecturerCount > 0
                  ? `Thuộc ${unidentified.lecturerCount} người`
                  : 'Đã đủ giảng viên'}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Thông báo suy ra từ dữ liệu, không có bảng Notifications và không có trạng
          thái đã đọc: mở trang là tính lại, làm xong thì dòng tự biến mất. Đợt này chỉ
          một loại, hai loại còn lại ghi ở congviec2.md mục F3 để sau. */}
      <section className="dashboard-block">
        <div className="dashboard-block-heading">
          <div>
            <h2>Việc cần làm</h2>
            <p>Cập nhật theo dữ liệu hiện tại, không cần bấm làm mới</p>
          </div>
        </div>

        {unidentifiedCount > 0 ? (
          <ul className="department-feed">
            <li>
              <button
                type="button"
                className="department-feed__item"
                onClick={() => onNavigateTab('classes')}
              >
                <span className="department-feed__icon is-warning" aria-hidden="true">
                  <Bell />
                </span>
                <span className="department-feed__copy">
                  <strong>
                    {unidentifiedCount} lớp chưa xác định giảng viên
                    {unidentified && unidentified.lecturerCount > 0
                      && `, thuộc ${unidentified.lecturerCount} người`}
                  </strong>
                  <small>
                    Xin email của từng người rồi thêm vào trang Giảng viên, sau đó quay lại gán
                    cho lớp. Bấm để mở danh sách.
                  </small>
                </span>
                <ArrowRight className="dashboard-quick-arrow" aria-hidden="true" />
              </button>
            </li>
          </ul>
        ) : (
          <div className="department-feed__empty">
            <CircleAlert aria-hidden="true" size={18} />
            <span>Không có việc nào cần xử lý trong học kỳ này.</span>
          </div>
        )}
      </section>
    </div>
  );
};
