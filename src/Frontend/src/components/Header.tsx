import React, { useState } from 'react';
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

const tabTitles: Record<string, { title: string; subtitle: string }> = {
  overview: {
    title: 'Tổng Quan Hệ Thống Đánh Giá VMU',
    subtitle: 'Thống kê & Theo dõi tiến độ khảo sát kết quả học phần và chương trình đào tạo',
  },
  faculties: {
    title: 'Quản Lý Danh Mục Khoa / Viện',
    subtitle: 'Danh sách các Khoa chuyên ngành & Viện đào tạo thuộc Trường ĐH Hàng hải VN',
  },
  majors: {
    title: 'Quản Lý Ngành & Chương Trình Đào Tạo',
    subtitle: 'Danh mục Ngành học, trình độ và chuẩn đầu ra đào tạo (PLO)',
  },
  courses: {
    title: 'Quản Lý Học Phần & Môn Học',
    subtitle: 'Danh mục Học phần, số tín chỉ và chuẩn đầu ra học phần (CLO)',
  },
  classes: {
    title: 'Quản Lý Lớp Học Phần & Giảng Viên',
    subtitle: 'Danh sách Lớp học phần mở khảo sát theo Học kỳ & Năm học',
  },
  criteria: {
    title: 'Quản Lý Bộ Tiêu Chí & Mẫu Phiếu Khảo Sát',
    subtitle: 'Bộ câu hỏi đánh giá chất lượng dạy - học & CSVC',
  },
  campaigns: {
    title: 'Quản Lý Đợt Khảo Sát & Mã QR Code',
    subtitle: 'Thiết lập đợt đánh giá và xuất Mã QR cho Sinh viên truy cập bài khảo sát',
  },
};

const roleNames: Record<string, string> = {
  ADMIN: 'Quản trị hệ thống',
  LECTURER: 'Giảng viên',
  DEPARTMENT_MANAGER: 'Quản lý đơn vị',
  SURVEY_ADMIN: 'Quản trị khảo sát',
};

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenStudentView,
  user,
  activeProfile,
  availableProfiles,
  onSwitchProfile,
  onLogout,
}) => {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const info = tabTitles[currentTab] || {
    title: 'Hệ Thống Đánh Giá VMU',
    subtitle: 'Trường Đại học Hàng hải Việt Nam',
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
        <h1>{info.title}</h1>
        <div className="header-breadcrumb">
          TRƯỜNG ĐẠI HỌC HÀNG HẢI VIỆT NAM &bull; {info.subtitle}
        </div>
      </div>

      <div className="header-actions">
        <button
          className="btn btn-qr btn-sm"
          onClick={onOpenStudentView}
          title="Thử nghiệm giao diện sinh viên khi quét mã QR"
        >
          <span>📱</span> Xem Giao Diện Quét QR Sinh Viên
        </button>

        <div className="user-badge">
          <div className="avatar">{initials}</div>
          <div className="user-info">
            <span className="user-name">{user.displayName ?? user.email}</span>
            <span className={`user-role ${actionError ? 'error' : ''}`}>
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
            title="Đăng xuất"
            onClick={() => void handleLogout()}
            disabled={busy}
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </header>
  );
};
