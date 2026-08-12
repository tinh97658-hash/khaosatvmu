import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Building2,
  CircleAlert,
  LoaderCircle,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react';
import { authMessage } from '../auth/authMessages';
import { useAuth } from '../auth/authContext';
import type { AuthProfile } from '../types';
import '../styles/auth-admin.css';

const roleNames: Record<string, string> = {
  ADMIN: 'Quản trị hệ thống',
  LECTURER: 'Giảng viên',
  DEPARTMENT_MANAGER: 'Quản lý đơn vị',
  SURVEY_ADMIN: 'Quản trị khảo sát',
};

export function ProfileSelectionPage() {
  const auth = useAuth();
  const [profiles, setProfiles] = useState<AuthProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auth.loadPendingProfiles()
      .then(setProfiles)
      .catch(() => setErrorCode('AUTH_SESSION_EXPIRED'))
      .finally(() => setLoading(false));
  }, [auth]);

  const selectProfile = async (profileId: string) => {
    setSelectedId(profileId);
    setErrorCode(null);
    try {
      await auth.selectPendingProfile(profileId);
    } catch {
      setErrorCode('AUTH_REQUEST_FAILED');
      setSelectedId(null);
    }
  };

  return (
    <main className="profile-selection-shell">
      <header className="profile-selection-header">
        <div className="auth-brand-lockup">
          <div className="auth-brand-mark compact" aria-hidden="true">VMU</div>
          <div>
            <p>TRƯỜNG ĐẠI HỌC HÀNG HẢI VIỆT NAM</p>
            <span>Hệ thống Đánh giá chất lượng đào tạo</span>
          </div>
        </div>
        <div className="auth-secure-label">
          <ShieldCheck aria-hidden="true" />
          Đã xác thực
        </div>
      </header>

      <section className="profile-selection-content" aria-labelledby="profile-selection-title">
        <div className="profile-selection-intro">
          <span className="auth-section-label">PHẠM VI LÀM VIỆC</span>
          <h1 id="profile-selection-title">Chọn hồ sơ làm việc</h1>
          <p>Mỗi hồ sơ sử dụng một vai trò và phạm vi quyền độc lập.</p>
        </div>

        {errorCode && (
          <div className="auth-alert" role="alert">
            <CircleAlert aria-hidden="true" />
            <span>{authMessage(errorCode)} <a href="/login">Đăng nhập lại</a></span>
          </div>
        )}

        {loading ? (
          <div className="auth-state-panel" role="status">
            <LoaderCircle className="auth-spin" aria-hidden="true" />
            <div>
              <strong>Đang tải hồ sơ</strong>
              <span>Vui lòng chờ trong giây lát.</span>
            </div>
          </div>
        ) : profiles.length > 0 ? (
          <div className="profile-list">
            {profiles.map((profile) => (
              <article className="profile-option" key={profile.id}>
                <div className="profile-option-mark" aria-hidden="true">
                  <UserRoundCheck />
                </div>
                <div className="profile-option-body">
                  <div className="profile-option-title">
                    <h2>{profile.name}</h2>
                    {profile.isDefault && <span className="profile-default-label">Mặc định</span>}
                  </div>
                  <p>{roleNames[profile.roleCode] ?? profile.roleCode}</p>
                  <span>
                    <Building2 aria-hidden="true" />
                    {profile.organizationUnitName ?? 'Phạm vi toàn hệ thống'}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-primary profile-select-button"
                  onClick={() => void selectProfile(profile.id)}
                  disabled={selectedId !== null}
                >
                  {selectedId === profile.id ? (
                    <><LoaderCircle className="auth-spin" aria-hidden="true" />Đang mở...</>
                  ) : (
                    <>Sử dụng hồ sơ<ArrowRight aria-hidden="true" /></>
                  )}
                </button>
              </article>
            ))}
          </div>
        ) : !errorCode && (
          <div className="auth-state-panel auth-state-panel-empty">
            <UserRoundCheck aria-hidden="true" />
            <div>
              <strong>Chưa có hồ sơ khả dụng</strong>
              <span>Liên hệ quản trị viên để được cấp hồ sơ làm việc.</span>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
