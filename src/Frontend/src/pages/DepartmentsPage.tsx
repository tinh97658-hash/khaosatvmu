import React, { useState } from 'react';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import type { Department, Faculty } from '../types';

interface DepartmentsPageProps {
  departments: Department[];
  faculties: Faculty[];
  onAddDepartment: (dept: Department) => void;
  onDeleteDepartment: (id: string) => void;
}

export const DepartmentsPage: React.FC<DepartmentsPageProps> = ({
  departments,
  faculties,
  onAddDepartment,
  onDeleteDepartment,
}) => {
  const [search, setSearch] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [headOfDepartment, setHeadOfDepartment] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [totalLecturers, setTotalLecturers] = useState(10);
  const [totalCourses, setTotalCourses] = useState(12);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || !facultyId) return;

    const faculty = faculties.find((f) => f.id === facultyId);
    const newDepartment: Department = {
      id: `dept-${Date.now()}`,
      code,
      name,
      facultyId,
      facultyName: faculty ? faculty.name : '',
      headOfDepartment: headOfDepartment || 'Chưa cập nhật',
      email: email || 'bomon@vimaru.edu.vn',
      phone: phone || '0225 3829 000',
      totalLecturers: Number(totalLecturers) || 5,
      totalCourses: Number(totalCourses) || 8,
    };

    onAddDepartment(newDepartment);
    setIsModalOpen(false);
    // Reset
    setCode('');
    setName('');
    setFacultyId('');
    setHeadOfDepartment('');
    setEmail('');
    setPhone('');
  };

  const filteredDepartments = departments.filter((d) => {
    const matchesSearch =
      d.code.toLowerCase().includes(search.toLowerCase()) ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.headOfDepartment.toLowerCase().includes(search.toLowerCase());
    const matchesFaculty = facultyFilter ? d.facultyId === facultyFilter : true;
    return matchesSearch && matchesFaculty;
  });

  const columns: Column<Department>[] = [
    {
      key: 'code',
      header: 'Mã Bộ Môn',
      render: (row) => (
        <span style={{ fontWeight: 700, color: 'var(--vmu-navy)' }}>
          {row.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Tên Bộ Môn Chuyên Môn',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--vmu-navy)' }}>
            {row.name}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            👨‍🏫 Trưởng bộ môn: {row.headOfDepartment}
          </div>
        </div>
      ),
    },
    {
      key: 'facultyName',
      header: 'Trực Thuộc Khoa / Viện',
      render: (row) => (
        <span className="badge badge-info">
          🏛️ {row.facultyName}
        </span>
      ),
    },
    {
      key: 'contact',
      header: 'Thông Tin Liên Hệ',
      render: (row) => (
        <div style={{ fontSize: '13px' }}>
          <div>✉️ {row.email}</div>
          <div style={{ color: 'var(--text-muted)' }}>📞 {row.phone}</div>
        </div>
      ),
    },
    {
      key: 'stats',
      header: 'Quy Mô Đào Tạo',
      render: (row) => (
        <div style={{ fontSize: '13px' }}>
          <div><strong>{row.totalLecturers}</strong> Giảng viên</div>
          <div style={{ color: 'var(--vmu-blue)' }}><strong>{row.totalCourses}</strong> Học phần quản lý</div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Thao Tác',
      render: (row) => (
        <button
          className="btn btn-danger btn-sm"
          onClick={() => onDeleteDepartment(row.id)}
        >
          🗑️ Xóa
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h2>Quản Lý Bộ Môn Đào Tạo</h2>
          <p>Danh mục các Bộ môn chuyên môn trực thuộc các Khoa/Viện đào tạo Trường Đại học Hàng hải Việt Nam</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          + Thêm Bộ Môn Mới
        </button>
      </div>

      <DataTable
        columns={columns}
        data={filteredDepartments}
        searchPlaceholder="Tìm theo mã bộ môn, tên bộ môn, trưởng bộ môn..."
        searchValue={search}
        onSearchChange={setSearch}
        filterOptions={[
          { label: 'Tất cả Khoa / Viện', value: '' },
          ...faculties.map((f) => ({ label: f.name, value: f.id })),
        ]}
        currentFilter={facultyFilter}
        onFilterChange={setFacultyFilter}
        onAddNew={() => setIsModalOpen(true)}
        addNewLabel="+ Thêm Bộ Môn"
        emptyMessage="Chưa có bộ môn nào được khởi tạo trong danh mục."
        keyExtractor={(item) => item.id}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="THÊM MỚI BỘ MÔN CHUYÊN MÔN (TRỰC THUỘC KHOA)"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Khoa / Viện Trực Thuộc:</label>
            <select
              value={facultyId}
              onChange={(e) => setFacultyId(e.target.value)}
              required
            >
              <option value="">-- Chọn Khoa / Viện quản lý --</option>
              {faculties.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.code})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }} className="form-group">
            <div>
              <label>Mã Bộ Môn:</label>
              <input
                type="text"
                placeholder="VD: BM-CNPM"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Tên Bộ Môn Chuyên Môn:</label>
              <input
                type="text"
                placeholder="VD: Bộ môn Công nghệ Phần mềm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Trưởng Bộ Môn:</label>
            <input
              type="text"
              placeholder="VD: TS. Nguyễn Văn A"
              value={headOfDepartment}
              onChange={(e) => setHeadOfDepartment(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} className="form-group">
            <div>
              <label>Email Liên Hệ:</label>
              <input
                type="email"
                placeholder="bomon@vimaru.edu.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label>Số Điện Thoại:</label>
              <input
                type="text"
                placeholder="0225 3829 xxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} className="form-group">
            <div>
              <label>Số Lượng Giảng Viên:</label>
              <input
                type="number"
                value={totalLecturers}
                onChange={(e) => setTotalLecturers(Number(e.target.value))}
              />
            </div>
            <div>
              <label>Số Học Phần Quản Lý:</label>
              <input
                type="number"
                value={totalCourses}
                onChange={(e) => setTotalCourses(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ padding: '16px 0 0 0', backgroundColor: 'transparent', borderTop: 'none' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary">
              Lưu Bộ Môn
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
