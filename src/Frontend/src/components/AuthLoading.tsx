export function AuthLoading() {
  return (
    <main className="auth-loading" aria-live="polite">
      <div className="auth-brand-mark compact">VMU</div>
      <div className="auth-loading-line" />
      <p>Đang kiểm tra phiên đăng nhập...</p>
    </main>
  );
}
