import { useState } from 'react';
import { ChevronRight, LogOut, QrCode } from 'lucide-react';
import type { AuthProfile, AuthUser } from '../types';

interface HeaderProps {
  currentTab: string;
  onOpenStudentView: () => void;
  user: AuthUser;
  activeProfile: AuthProfile;
  availableProfiles: AuthProfile[];
  onSwitchProfile: (profileId: string) => Promise<void>;
  onLogout: () => Promise<void>;
}

interface TabContext {
  section: string;
  title: string;
}

const tabContexts: Record<string, TabContext> = {
  overview: { section: 'Tổng quan', title: 'Bảng điều khiển' },
  progress: { section: 'Tổng quan', title: 'Tiến độ thu phiếu' },
  faculties: { section: 'Danh mục đào tạo', title: 'Khoa / Viện' },
  departments: { section: 'Danh mục đào tạo', title: 'Bộ môn' },
  lecturers: { section: 'Danh mục đào tạo', title: 'Giảng viên' },
  majors: { section: 'Danh mục đào tạo', title: 'Ngành đào tạo' },
  courses: { section: 'Danh mục đào tạo', title: 'Học phần' },
  classes: { section: 'Danh mục đào tạo', title: 'Lớp học phần' },
  criteria: { section: 'Khảo sát học phần', title: 'Tiêu chí học phần' },
  campaigns: { section: 'Khảo sát học phần', title: 'Đợt khảo sát học phần' },
  'course-criteria': { section: 'Khảo sát học phần', title: 'Tiêu chí học phần' },
  'course-campaigns': { section: 'Khảo sát học phần', title: 'Đợt khảo sát học phần' },
  'program-criteria': { section: 'Khảo sát chương trình', title: 'Tiêu chí CTĐT' },
  'program-campaigns': { section: 'Khảo sát chương trình', title: 'Đợt khảo sát CTĐT' },
  'users-admin': { section: 'Quản trị', title: 'Người dùng & phân quyền' },
};

const roleNames: Record<string, string> = {
  ADMIN: 'Quản trị hệ thống',
  LECTURER: 'Giảng viên',
  DEPARTMENT_MANAGER: 'Quản lý đơn vị',
  SURVEY_ADMIN: 'Quản trị khảo sát',
};

export function Header({
  currentTab,
  onOpenStudentView,
  user,
  activeProfile,
  availableProfiles,
  onSwitchProfile,
  onLogout,
}: HeaderProps) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const context = tabContexts[currentTab] ?? {
    section: 'Hệ thống khảo sát',
    title: 'Trường Đại học Hàng hải Việt Nam',
  };
  const initials = (user.displayName ?? user.email)
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleSwitch = async (profileId: string) => {
    if (profileId === activeProfile.id) return;
    setBusy(true);
    setActionError(null);
    try {
      await onSwitchProfile(profileId);
    } catch {
      setActionError('Không thể đổi hồ sơ');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await onLogout();
    } catch {
      setActionError('Không thể đăng xuất');
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="top-header">
      <div className="header-title-area">
        <div className="header-breadcrumb">
          <span>Hệ thống khảo sát</span>
          <ChevronRight aria-hidden="true" />
          <span>{context.section}</span>
        </div>
        <h1>{context.title}</h1>
      </div>

      <div className="header-actions">
        <button
          type="button"
          className="header-preview-button"
          onClick={onOpenStudentView}
          title="Xem giao diện khảo sát của sinh viên"
        >
          <QrCode aria-hidden="true" />
          <span>Xem bản khảo sát</span>
        </button>

        <div className="user-badge">
          <div className="avatar" aria-hidden="true">{initials}</div>
          <div className="user-info">
            <span className="user-name">{user.displayName ?? user.email}</span>
            <span
              className={`user-role ${actionError ? 'error' : ''}`}
              role={actionError ? 'alert' : undefined}
            >
              {actionError ?? roleNames[activeProfile.roleCode] ?? activeProfile.roleCode}
            </span>
          </div>
          <select
            className="profile-switcher"
            aria-label="Hồ sơ làm việc"
            value={activeProfile.id}
            disabled={busy}
            onChange={(event) => void handleSwitch(event.target.value)}
          >
            {availableProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.name}</option>
            ))}
          </select>
          <button
            type="button"
            className="header-logout-button"
            aria-label="Đăng xuất"
            title="Đăng xuất"
            onClick={() => void handleLogout()}
            disabled={busy}
          >
            <LogOut aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
