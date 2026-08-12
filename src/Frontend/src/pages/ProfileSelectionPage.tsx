import { useEffect, useState } from 'react';
import { authMessage } from '../auth/authMessages';
import { useAuth } from '../auth/authContext';
import type { AuthProfile } from '../types';

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

  useEffect(() => {
    auth.loadPendingProfiles()
      .then(setProfiles)
      .catch(() => setErrorCode('AUTH_SESSION_EXPIRED'));
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
        <div className="auth-brand-mark compact">VMU</div>
        <div>
          <p>TRƯỜNG ĐẠI HỌC HÀNG HẢI VIỆT NAM</p>
          <h1>Chọn hồ sơ làm việc</h1>
        </div>
      </header>

      <section className="profile-selection-content">
        {errorCode && (
          <div className="auth-alert" role="alert">
            {authMessage(errorCode)} <a href="/login">Đăng nhập lại</a>
          </div>
        )}

        <div className="profile-list">
          {profiles.map((profile) => (
            <article className="profile-option" key={profile.id}>
              <div className="profile-option-mark">
                {profile.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="profile-option-body">
                <h2>{profile.name}</h2>
                <p>{roleNames[profile.roleCode] ?? profile.roleCode}</p>
                <span>{profile.organizationUnitName ?? 'Phạm vi toàn hệ thống'}</span>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void selectProfile(profile.id)}
                disabled={selectedId !== null}
              >
                {selectedId === profile.id ? 'Đang mở...' : 'Sử dụng hồ sơ'}
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
