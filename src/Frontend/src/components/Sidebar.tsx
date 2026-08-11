import React from 'react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  activeCampaignsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  activeCampaignsCount,
}) => {
  const menuItems = [
    {
      section: 'BÁO CÁO & THỐNG KÊ',
      items: [
        { id: 'overview', label: 'Dashboard Thống Kê', icon: '📊' },
        { id: 'progress', label: 'Tiến độ Thu phiếu Khảo sát', icon: '📈' },
      ],
    },
    {
      section: 'DANH MỤC ĐÀO TẠO',
      items: [
        { id: 'faculties', label: 'Danh mục Khoa / Viện', icon: '🏛️' },
        { id: 'departments', label: 'Bộ môn Đào tạo', icon: '🏫' },
        { id: 'lecturers', label: 'Danh mục Giảng viên', icon: '👨‍🏫' },
        { id: 'majors', label: 'Ngành & CT Đào tạo', icon: '🎓' },
        { id: 'courses', label: 'Học phần / Môn học', icon: '📚' },
        { id: 'classes', label: 'Lớp HP & Nhóm N01/N02', icon: '👥' },
      ],
    },
    {
      section: '📚 KHẢO SÁT HỌC PHẦN (MÔN HỌC)',
      items: [
        {
          id: 'course-campaigns',
          label: 'Đợt Khảo sát Môn học & QR',
          icon: '📱',
          badge: activeCampaignsCount > 0 ? activeCampaignsCount : undefined,
        },
        { id: 'course-criteria', label: 'Bộ Tiêu chí Môn học', icon: '📋' },
      ],
    },
    {
      section: '🎓 KHẢO SÁT CHƯƠNG TRÌNH ĐÀO TẠO',
      items: [
        { id: 'program-campaigns', label: 'Đợt Khảo sát CT Đào tạo', icon: '🏛️' },
        { id: 'program-criteria', label: 'Bộ Tiêu chí CT Đào tạo', icon: '📜' },
      ],
    },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="vmu-logo-icon">VMU</div>
        <div className="sidebar-header-text">
          <h2>ĐẠI HỌC HÀNG HẢI</h2>
          <p>Hệ thống Đánh giá Kvalitet</p>
        </div>
      </div>

      <nav className="sidebar-menu">
        {menuItems.map((group, idx) => (
          <div key={idx}>
            <div className="menu-section-title">{group.section}</div>
            {group.items.map((item) => (
              <button
                key={item.id}
                className={`menu-item ${currentTab === item.id ? 'active' : ''}`}
                onClick={() => onSelectTab(item.id)}
              >
                <span className="menu-icon">{item.icon}</span>
                <span style={{ flexGrow: 1 }}>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="badge badge-warning" style={{ fontSize: '11px' }}>
                    {item.badge} Đang mở
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div>Trường Đại học Hàng hải VN</div>
        <div style={{ marginTop: '2px', opacity: 0.8 }}>Phiên bản 2.5 &bull; 2026</div>
      </div>
    </aside>
  );
};
