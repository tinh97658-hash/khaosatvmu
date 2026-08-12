import { useState } from 'react';
import {
  Building2,
  CircleAlert,
  FlaskConical,
  GraduationCap,
  LogIn,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { authMessage } from '../auth/authMessages';
import { useAuth } from '../auth/authContext';
import '../styles/auth-admin.css';

export function LoginPage() {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const queryError = new URLSearchParams(window.location.search).get('error');
  const error = authMessage(localError ?? queryError ?? auth.errorCode);
  const googleAvailable = auth.configuration?.googleConfigured === true;

  const handleDevLogin = async () => {
    setBusy(true);
    setLocalError(null);
    try {
      await auth.devLogin();
      window.history.replaceState(null, '', '/');
    } catch {
      setLocalError('AUTH_REQUEST_FAILED');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell auth-login-shell">
      <header className="auth-site-header" aria-label="Trường Đại học Hàng hải Việt Nam">
        <div className="auth-brand-lockup">
          <div className="auth-brand-mark" aria-hidden="true">VMU</div>
          <div>
            <p>TRƯỜNG ĐẠI HỌC HÀNG HẢI VIỆT NAM</p>
            <span>Hệ thống Đánh giá chất lượng đào tạo</span>
          </div>
        </div>
        <div className="auth-secure-label">
          <ShieldCheck aria-hidden="true" />
          Cổng truy cập an toàn
        </div>
      </header>

      <section className="auth-login-content" aria-labelledby="login-title">
        <div className="auth-context-panel">
          <span className="auth-section-label">HỆ THỐNG NỘI BỘ</span>
          <h1>Quản lý khảo sát và chất lượng đào tạo</h1>
          <p>
            Không gian làm việc dành cho cán bộ, giảng viên và đơn vị quản lý được cấp quyền.
          </p>
          <div className="auth-context-list" aria-label="Phạm vi hệ thống">
            <div>
              <GraduationCap aria-hidden="true" />
              <span>Khảo sát học phần</span>
            </div>
            <div>
              <Building2 aria-hidden="true" />
              <span>Đánh giá chương trình đào tạo</span>
            </div>
          </div>
        </div>

        <div className="auth-panel" aria-busy={busy}>
          <div className="auth-panel-heading">
            <span className="auth-section-label">XÁC THỰC TÀI KHOẢN</span>
            <h2 id="login-title">Đăng nhập hệ thống</h2>
          </div>

          <p className="auth-panel-copy">
            Tiếp tục bằng tài khoản Google đã được quản trị viên cấp quyền.
          </p>

          {error && (
            <div className="auth-alert" role="alert">
              <CircleAlert aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="auth-actions">
            <button
              type="button"
              className="auth-google-button"
              onClick={() => window.location.assign('/api/auth/login')}
              disabled={!googleAvailable || busy}
            >
              <LogIn aria-hidden="true" />
              Tiếp tục với Google
            </button>

            {!googleAvailable && auth.configuration && (
              <p className="auth-inline-status" role="status">
                Đăng nhập Google hiện chưa khả dụng.
              </p>
            )}

            {auth.configuration?.development && (
              <button
                type="button"
                className="auth-dev-button"
                onClick={() => void handleDevLogin()}
                disabled={busy}
              >
                <FlaskConical aria-hidden="true" />
                {busy ? 'Đang đăng nhập...' : 'Tài khoản thử nghiệm'}
              </button>
            )}

            {auth.status === 'error' && (
              <button
                type="button"
                className="auth-dev-button"
                onClick={() => void auth.refresh()}
                disabled={busy}
              >
                <RefreshCw aria-hidden="true" />
                Thử lại kết nối
              </button>
            )}
          </div>

          <div className="auth-domain-note">
            Chỉ tài khoản Google có trong danh sách được cấp quyền mới có thể truy cập.
          </div>
        </div>
      </section>

      <footer className="auth-site-footer">
        <span>VMU Survey Operations</span>
        <span>Phiên truy cập được bảo vệ</span>
      </footer>
    </main>
  );
}
