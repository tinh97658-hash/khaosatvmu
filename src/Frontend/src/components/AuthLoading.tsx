import { LoaderCircle, ShieldCheck } from 'lucide-react';
import '../styles/auth-admin.css';

export function AuthLoading() {
  return (
    <main className="auth-loading" aria-live="polite">
      <div className="auth-loading-panel">
        <img className="auth-brand-mark compact" src="/vmu-logo.png" alt="" aria-hidden="true" />
        <div className="auth-loading-copy">
          <span><ShieldCheck aria-hidden="true" /> CỔNG XÁC THỰC</span>
          <strong>Đang kiểm tra phiên đăng nhập</strong>
          <p>Vui lòng chờ trong giây lát.</p>
        </div>
        <LoaderCircle className="auth-spin auth-loading-spinner" aria-hidden="true" />
      </div>
    </main>
  );
}
