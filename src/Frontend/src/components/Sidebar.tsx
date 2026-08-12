import { useEffect, useState } from 'react';
import {
  BookOpen,
  Building2,
  ChartColumn,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Network,
  PanelLeftOpen,
  Presentation,
  School,
  ShieldCheck,
  UserCog,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  activeCampaignsCount: number;
  canManageUsers: boolean;
}

interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

interface SidebarGroup {
  section: string;
  items: SidebarItem[];
}

export function Sidebar({
  currentTab,
  onSelectTab,
  activeCampaignsCount,
  canManageUsers,
}: SidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (!isMobileOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isMobileOpen]);

  const menuGroups: SidebarGroup[] = [
    {
      section: 'TỔNG QUAN',
      items: [
        { id: 'overview', label: 'Bảng điều khiển', icon: LayoutDashboard },
        { id: 'progress', label: 'Tiến độ thu phiếu', icon: ChartColumn },
      ],
    },
    {
      section: 'DANH MỤC ĐÀO TẠO',
      items: [
        { id: 'faculties', label: 'Khoa / Viện', icon: Building2 },
        { id: 'departments', label: 'Bộ môn', icon: Network },
        { id: 'lecturers', label: 'Giảng viên', icon: Presentation },
        { id: 'majors', label: 'Ngành đào tạo', icon: GraduationCap },
        { id: 'courses', label: 'Học phần', icon: BookOpen },
        { id: 'classes', label: 'Lớp học phần', icon: UsersRound },
      ],
    },
    {
      section: 'KHẢO SÁT HỌC PHẦN',
      items: [
        {
          id: 'course-campaigns',
          label: 'Đợt khảo sát học phần',
          icon: ClipboardCheck,
          badge: activeCampaignsCount > 0 ? activeCampaignsCount : undefined,
        },
        { id: 'course-criteria', label: 'Tiêu chí học phần', icon: ListChecks },
      ],
    },
    {
      section: 'KHẢO SÁT CHƯƠNG TRÌNH',
      items: [
        { id: 'program-campaigns', label: 'Đợt khảo sát CTĐT', icon: School },
        { id: 'program-criteria', label: 'Tiêu chí CTĐT', icon: FileCheck2 },
      ],
    },
    ...(canManageUsers
      ? [{
          section: 'QUẢN TRỊ',
          items: [
            { id: 'users-admin', label: 'Người dùng & phân quyền', icon: UserCog },
          ],
        } satisfies SidebarGroup]
      : []),
  ];

  const handleSelect = (tab: string) => {
    onSelectTab(tab);
    setIsMobileOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="sidebar-mobile-toggle"
        aria-controls="main-sidebar"
        aria-expanded={isMobileOpen}
        aria-label="Mở điều hướng"
        title="Mở điều hướng"
        onClick={() => setIsMobileOpen(true)}
      >
        <PanelLeftOpen aria-hidden="true" />
      </button>

      <button
        type="button"
        className={`sidebar-overlay ${isMobileOpen ? 'is-visible' : ''}`}
        aria-label="Đóng điều hướng"
        tabIndex={isMobileOpen ? 0 : -1}
        onClick={() => setIsMobileOpen(false)}
      />

      <aside
        id="main-sidebar"
        className={`sidebar ${isMobileOpen ? 'is-mobile-open' : ''}`}
      >
        <div className="sidebar-header">
          <img className="vmu-logo-icon" src="/vmu-logo.png" alt="" aria-hidden="true" />
          <div className="sidebar-header-text">
            <h2>KHẢO SÁT VMU</h2>
            <p>Quản lý chất lượng đào tạo</p>
          </div>
          <button
            type="button"
            className="sidebar-close-button"
            aria-label="Đóng điều hướng"
            title="Đóng điều hướng"
            onClick={() => setIsMobileOpen(false)}
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <nav className="sidebar-menu" aria-label="Điều hướng chính">
          {menuGroups.map((group) => (
            <section className="menu-section" key={group.section}>
              <h3 className="menu-section-title">{group.section}</h3>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;

                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`menu-item ${isActive ? 'active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => handleSelect(item.id)}
                  >
                    <Icon className="menu-icon" aria-hidden="true" />
                    <span className="menu-label">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="menu-count" aria-label={`${item.badge} đợt đang mở`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </section>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-icon" aria-hidden="true">
            <ShieldCheck />
          </div>
          <div className="sidebar-footer-copy">
            <strong>Hệ thống nội bộ</strong>
            <span>Phiên bản 2.5 · 2026</span>
          </div>
          <span className="sidebar-status" title="Hệ thống đang kết nối">
            <span aria-hidden="true" />
            Kết nối
          </span>
        </div>
      </aside>
    </>
  );
}
