import React, { useState } from 'react';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import type { Lecturer, Faculty, Department } from '../types';

interface LecturersPageProps {
  lecturers: Lecturer[];
  faculties: Faculty[];
  departments: Department[];
  onAddLecturer: (lecturer: Lecturer) => void;
  onDeleteLecturer: (id: string) => void;
}

export const LecturersPage: React.FC<LecturersPageProps> = ({
  lecturers,
  faculties,
  departments,
  onAddLecturer,
  onDeleteLecturer,
}) => {
  const [search, setSearch] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [code, setCode] = useState('');
  const [academicTitle, setAcademicTitle] = useState('TS.');
  const [fullName, setFullName] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [specialization, setSpecialization] = useState('');

  // Filtered departments based on selected faculty in Modal
  const availableDepartments = facultyId
    ? departments.filter((d) => d.facultyId === facultyId)
    : departments;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !fullName.trim() || !facultyId) return;

    const faculty = faculties.find((f) => f.id === facultyId);
    const department = departments.find((d) => d.id === departmentId);

    const newLecturer: Lecturer = {
      id: `lec-${Date.now()}`,
      code,
      fullName: `${academicTitle} ${fullName}`,
      academicTitle,
      facultyId,
      facultyName: faculty ? faculty.name : '',
      departmentId: department?.id,
      departmentName: department?.name,
      email: email || `${code.toLowerCase()}@vimaru.edu.vn`,
      phone: phone || '0900 000 000',
      specialization: specialization || 'Giảng dạy & Nghiên cứu khoa học',
      status: 'Đang công tác',
    };

    onAddLecturer(newLecturer);
    setIsModalOpen(false);

    // Reset Form
    setCode('');
    setFullName('');
    setFacultyId('');
    setDepartmentId('');
    setEmail('');
    setPhone('');
    setSpecialization('');
  };

  const filteredLecturers = lecturers.filter((l) => {
    const matchesSearch =
      l.code.toLowerCase().includes(search.toLowerCase()) ||
      l.fullName.toLowerCase().includes(search.toLowerCase()) ||
      l.specialization.toLowerCase().includes(search.toLowerCase());
    const matchesFaculty = facultyFilter ? l.facultyId === facultyFilter : true;
    return matchesSearch && matchesFaculty;
  });

  const columns: Column<Lecturer>[] = [
    {
      key: 'code',
      header: 'Mã Cán Bộ (GV)',
      render: (row) => (
        <span className="badge badge-info" style={{ fontFamily: 'monospace', fontSize: '13px' }}>
          {row.code}
        </span>
      ),
    },
    {
      key: 'fullName',
      header: 'Họ Và Tên Giảng Viên',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 700, color: 'var(--vmu-navy)', fontSize: '14px' }}>
            {row.fullName}
          </div>
          {row.departmentName && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              🏫 {row.departmentName}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'facultyName',
      header: 'Khoa / Viện Trực Thuộc',
      render: (row) => (
        <span style={{ fontSize: '13px', fontWeight: 500 }}>
          🏛️ {row.facultyName}
        </span>
      ),
    },
    {
      key: 'contact',
      header: 'Liên Hệ',
      render: (row) => (
        <div style={{ fontSize: '12px' }}>
          <div>📧 {row.email}</div>
          <div style={{ color: 'var(--text-muted)' }}>📞 {row.phone}</div>
        </div>
      ),
    },
    {
      key: 'specialization',
      header: 'Chuyên Môn Giảng Dạy',
      render: (row) => (
        <span style={{ fontSize: '12px', color: 'var(--vmu-blue)', fontWeight: 500 }}>
          💡 {row.specialization}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Thao Tác',
      render: (row) => (
        <button
          className="btn btn-danger btn-sm"
          onClick={() => {
            if (confirm(`Bạn có chắc chắn muốn xóa Giảng viên "${row.fullName}"?`)) {
              onDeleteLecturer(row.id);
            }
          }}
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
          <h2>Quản Lý Danh Mục Giảng Viên</h2>
          <p>Hồ sơ đội ngũ giảng viên phụ trách giảng dạy và đánh giá các lớp học phần VMU</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          + Thêm Giảng Viên Mới
        </button>
      </div>

      <DataTable
        columns={columns}
        data={filteredLecturers}
        searchPlaceholder="Tìm theo mã cán bộ, họ tên giảng viên, chuyên môn..."
        searchValue={search}
        onSearchChange={setSearch}
        filterOptions={[
          { label: 'Tất cả Khoa / Viện', value: '' },
          ...faculties.map((f) => ({ label: f.name, value: f.id })),
        ]}
        currentFilter={facultyFilter}
        onFilterChange={setFacultyFilter}
        onAddNew={() => setIsModalOpen(true)}
        addNewLabel="+ Thêm Giảng Viên"
        emptyMessage="Chưa có giảng viên nào trong danh mục."
        keyExtractor={(item) => item.id}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="THÊM MỚI GIẢNG VIÊN VÀO DANH MỤC"
      >
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} className="form-group">
            <div>
              <label>Khoa / Viện Trực Thuộc:</label>
              <select
                value={facultyId}
                onChange={(e) => {
                  setFacultyId(e.target.value);
                  setDepartmentId('');
                }}
                required
              >
                <option value="">-- Chọn Khoa / Viện --</option>
                {faculties.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Bộ Môn Trực Thuộc:</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">-- Chọn Bộ môn (nếu có) --</option>
                {availableDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '12px' }} className="form-group">
            <div>
              <label>Mã Cán Bộ (GV):</label>
              <input
                type="text"
                placeholder="VD: CB01088"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Học Hàm / Học Vị:</label>
              <select value={academicTitle} onChange={(e) => setAcademicTitle(e.target.value)}>
                <option value="ThS.">ThS.</option>
                <option value="TS.">TS.</option>
                <option value="PGS. TS.">PGS. TS.</option>
                <option value="GS. TS.">GS. TS.</option>
                <option value="CN.">CN.</option>
              </select>
            </div>
            <div>
              <label>Họ Và Tên Giảng Viên:</label>
              <input
                type="text"
                placeholder="VD: Nguyễn Văn Hải"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} className="form-group">
            <div>
              <label>Email Công Vụ:</label>
              <input
                type="email"
                placeholder="hainv@vimaru.edu.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label>Số Điện Thoại:</label>
              <input
                type="text"
                placeholder="09xx xxx xxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Chuyên Môn Giảng Dạy & Nghiên Cứu:</label>
            <input
              type="text"
              placeholder="VD: Lập trình Web, Cơ sở dữ liệu, An toàn mạng..."
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
            />
          </div>

          <div className="modal-footer" style={{ padding: '16px 0 0 0', backgroundColor: 'transparent', borderTop: 'none' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary">
              Lưu Giảng Viên
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
