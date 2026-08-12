import React from 'react';
import { AgentMemoryWidget } from './AgentMemoryWidget';

interface HeaderProps {
  currentTab: string;
  onOpenStudentView: () => void;
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

export const Header: React.FC<HeaderProps> = ({ currentTab, onOpenStudentView }) => {
  const info = tabTitles[currentTab] || {
    title: 'Hệ Thống Đánh Giá VMU',
    subtitle: 'Trường Đại học Hàng hải Việt Nam',
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
        <AgentMemoryWidget />

        <button
          className="btn btn-qr btn-sm"
          onClick={onOpenStudentView}
          title="Thử nghiệm giao diện sinh viên khi quét mã QR"
        >
          <span>📱</span> Xem Giao Diện Quét QR Sinh Viên
        </button>

        <div className="user-badge">
          <div className="avatar">ADMIN</div>
          <div className="user-info">
            <span className="user-name">Phòng Khảo thí & ĐBCL</span>
            <span className="user-role">Quản trị viên Hệ thống</span>
          </div>
        </div>
      </div>
    </header>
  );
};
