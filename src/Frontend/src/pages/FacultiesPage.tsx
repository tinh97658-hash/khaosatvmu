import React, { useState } from 'react';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import type { Faculty } from '../types';

interface FacultiesPageProps {
  faculties: Faculty[];
  onAddFaculty: (faculty: Faculty) => void;
  onDeleteFaculty: (id: string) => void;
}

export const FacultiesPage: React.FC<FacultiesPageProps> = ({
  faculties,
  onAddFaculty,
  onDeleteFaculty,
}) => {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [dean, setDean] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [year, setYear] = useState('1990');

  const filtered = faculties.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.code.toLowerCase().includes(search.toLowerCase()) ||
      f.dean.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = () => {
    if (!code || !name) {
      alert('Vui lòng điền mã Khoa và tên Khoa!');
      return;
    }
    const newFaculty: Faculty = {
      id: `fac-${Date.now()}`,
      code,
      name,
      dean: dean || 'Đang cập nhật',
      email: email || `${code.toLowerCase()}@vimaru.edu.vn`,
      phone: phone || '0225 3829xxx',
      establishedYear: parseInt(year) || 1990,
      totalCourses: 0,
      totalStudents: 0,
    };
    onAddFaculty(newFaculty);
    setIsModalOpen(false);
    // Reset form
    setCode('');
    setName('');
    setDean('');
    setEmail('');
    setPhone('');
  };

  const columns: Column<Faculty>[] = [
    {
      key: 'code',
      header: 'Mã Khoa/Viện',
      width: '120px',
      render: (item) => (
        <span className="badge badge-info" style={{ fontFamily: 'monospace', fontSize: '13px' }}>
          {item.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Tên Khoa / Viện Đào Tạo',
      render: (item) => <strong style={{ color: 'var(--vmu-navy)' }}>{item.name}</strong>,
    },
    {
      key: 'dean',
      header: 'Trưởng Khoa / Viện Trưởng',
    },
    {
      key: 'contact',
      header: 'Thông Tin Liên Hệ',
      render: (item) => (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          <div>📧 {item.email}</div>
          <div>📞 {item.phone}</div>
        </div>
      ),
    },
    {
      key: 'stats',
      header: 'Bộ Môn & Quy Mô',
      render: (item) => (
        <span style={{ fontSize: '13px' }}>
          🏫 <strong>{item.departmentsCount || 2}</strong> Bộ môn &bull; 📚 <strong>{item.totalCourses}</strong> HP &bull; 🎓 <strong>{item.totalStudents}</strong> SV
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Thao Tác',
      width: '100px',
      render: (item) => (
        <button
          className="btn btn-danger btn-sm"
          onClick={() => {
            if (confirm(`Bạn có chắc muốn xóa Khoa "${item.name}"?`)) {
              onDeleteFaculty(item.id);
            }
          }}
        >
          Xóa
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h2>QUẢN LÝ DANH MỤC KHOA & VIỆN ĐÀO TẠO</h2>
          <p>Thiết lập danh mục đơn vị giảng dạy thuộc Trường Đại học Hàng hải Việt Nam</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          + Thêm Khoa / Viện Mới
        </button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm tên khoa, mã khoa, trưởng khoa..."
        onAddNew={() => setIsModalOpen(true)}
        addNewLabel="+ Thêm Khoa / Viện"
        keyExtractor={(item) => item.id}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="THÊM MỚI KHOA / VIỆN ĐÀO TẠO - VMU"
        onSubmit={handleSubmit}
        submitText="Lưu Danh Mục Khoa"
      >
        <div className="form-group">
          <label>Mã Khoa / Viện (Viết tắt):</label>
          <input
            type="text"
            placeholder="Ví dụ: CNTT, VD, KT..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Tên Đầy Đủ Khoa / Viện:</label>
          <input
            type="text"
            placeholder="Ví dụ: Khoa Công nghệ Thông tin"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Họ Tên Trưởng Khoa / Viện Trưởng:</label>
          <input
            type="text"
            placeholder="Ví dụ: TS. Nguyễn Văn Hải"
            value={dean}
            onChange={(e) => setDean(e.target.value)}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group">
            <label>Email Liên Hệ:</label>
            <input
              type="email"
              placeholder="cntt@vimaru.edu.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Số Điện Thoại:</label>
            <input
              type="text"
              placeholder="0225 3829xxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>
        <div className="form-group">
          <label>Năm Thành Lập:</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
};
