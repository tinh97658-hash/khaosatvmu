import { useState } from 'react';
import { authMessage } from '../auth/authMessages';
import { useAuth } from '../auth/authContext';

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
    <main className="auth-shell">
      <section className="auth-brand-band" aria-label="Trường Đại học Hàng hải Việt Nam">
        <div className="auth-brand-mark">VMU</div>
        <div>
          <p className="auth-brand-kicker">TRƯỜNG ĐẠI HỌC HÀNG HẢI VIỆT NAM</p>
          <h1>Hệ thống Đánh giá chất lượng đào tạo</h1>
          <p className="auth-brand-copy">
            Không gian làm việc dành cho cán bộ, giảng viên và đơn vị quản lý khảo sát.
          </p>
        </div>
        <div className="auth-brand-meta">
          <span>Khảo sát học phần</span>
          <span>Đánh giá chương trình đào tạo</span>
        </div>
      </section>

      <section className="auth-action-area">
        <div className="auth-panel">
          <div className="auth-panel-heading">
            <span className="auth-status-line" />
            <p>CỔNG XÁC THỰC VMU</p>
            <h2>Đăng nhập</h2>
          </div>

          <p className="auth-panel-copy">
            Sử dụng tài khoản Google Workspace do nhà trường cấp.
          </p>

          {error && <div className="auth-alert" role="alert">{error}</div>}

          <button
            type="button"
            className="auth-google-button"
            onClick={() => window.location.assign('/api/auth/login')}
            disabled={!googleAvailable || busy}
          >
            <span className="google-mark" aria-hidden="true">G</span>
            Đăng nhập bằng Google
          </button>

          {!googleAvailable && auth.configuration && (
            <p className="auth-inline-status">Đăng nhập Google hiện chưa khả dụng.</p>
          )}

          {auth.configuration?.development && (
            <button
              type="button"
              className="auth-dev-button"
              onClick={() => void handleDevLogin()}
              disabled={busy}
            >
              {busy ? 'Đang đăng nhập...' : 'Dùng tài khoản thử nghiệm'}
            </button>
          )}

          {auth.status === 'error' && (
            <button
              type="button"
              className="auth-dev-button"
              onClick={() => void auth.refresh()}
              disabled={busy}
            >
              Thử lại kết nối
            </button>
          )}

          <div className="auth-domain-note">
            Chỉ chấp nhận tài khoản @{auth.configuration?.allowedDomain || 'vmu.edu.vn'}
          </div>
        </div>
      </section>
    </main>
  );
}
