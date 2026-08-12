import React, { useState } from 'react';
import { Mail, Phone, Trash2 } from 'lucide-react';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { ConfirmDialog, Modal } from '../components/Modal';
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
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [headOfDepartment, setHeadOfDepartment] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [totalLecturers, setTotalLecturers] = useState(10);
  const [totalCourses, setTotalCourses] = useState(12);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim() || !name.trim() || !facultyId) return;

    const faculty = faculties.find((item) => item.id === facultyId);
    const newDepartment: Department = {
      id: `dept-${Date.now()}`,
      code: code.trim(),
      name: name.trim(),
      facultyId,
      facultyName: faculty?.name ?? '',
      headOfDepartment: headOfDepartment.trim() || 'Chưa cập nhật',
      email: email.trim() || 'bomon@vimaru.edu.vn',
      phone: phone.trim() || '0225 3829 000',
      totalLecturers: Number(totalLecturers) || 5,
      totalCourses: Number(totalCourses) || 8,
    };

    onAddDepartment(newDepartment);
    setIsModalOpen(false);
    setCode('');
    setName('');
    setFacultyId('');
    setHeadOfDepartment('');
    setEmail('');
    setPhone('');
  };

  const filteredDepartments = departments.filter((department) => {
    const matchesSearch =
      department.code.toLowerCase().includes(search.toLowerCase()) ||
      department.name.toLowerCase().includes(search.toLowerCase()) ||
      department.headOfDepartment.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (!facultyFilter || department.facultyId === facultyFilter);
  });

  const columns: Column<Department>[] = [
    {
      key: 'code',
      header: 'Mã bộ môn',
      width: '110px',
      render: (row) => <span className="catalog-code">{row.code}</span>,
    },
    {
      key: 'name',
      header: 'Tên bộ môn chuyên môn',
      render: (row) => (
        <div>
          <div className="catalog-cell-primary">{row.name}</div>
          <div className="catalog-cell-meta">Trưởng bộ môn: {row.headOfDepartment}</div>
        </div>
      ),
    },
    {
      key: 'facultyName',
      header: 'Khoa / viện trực thuộc',
      render: (row) => <span className="catalog-cell-primary">{row.facultyName}</span>,
    },
    {
      key: 'contact',
      header: 'Thông tin liên hệ',
      render: (row) => (
        <div className="catalog-contact">
          <span><Mail aria-hidden="true" size={13} />{row.email}</span>
          <span><Phone aria-hidden="true" size={13} />{row.phone}</span>
        </div>
      ),
    },
    {
      key: 'stats',
      header: 'Quy mô đào tạo',
      width: '140px',
      render: (row) => (
        <div className="catalog-stats">
          <span className="catalog-stat-line"><strong>{row.totalLecturers}</strong> giảng viên</span>
          <span className="catalog-stat-line"><strong>{row.totalCourses}</strong> học phần</span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      width: '64px',
      render: (row) => (
        <div className="catalog-actions">
          <button
            type="button"
            className="catalog-icon-button catalog-icon-button--danger"
            onClick={() => setDepartmentToDelete(row)}
            aria-label={`Xóa ${row.name}`}
            title="Xóa bộ môn"
          >
            <Trash2 aria-hidden="true" size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="catalog-page">
      <header className="catalog-page-header">
        <div>
          <h2>Danh mục bộ môn đào tạo</h2>
          <p>Quản lý các bộ môn chuyên môn trực thuộc khoa và viện đào tạo.</p>
        </div>
      </header>

      <DataTable
        columns={columns}
        data={filteredDepartments}
        searchPlaceholder="Tìm mã, tên hoặc trưởng bộ môn..."
        searchValue={search}
        onSearchChange={setSearch}
        filterOptions={[
          { label: 'Tất cả khoa / viện', value: '' },
          ...faculties.map((faculty) => ({ label: faculty.name, value: faculty.id })),
        ]}
        currentFilter={facultyFilter}
        onFilterChange={setFacultyFilter}
        onAddNew={() => setIsModalOpen(true)}
        addNewLabel="Thêm bộ môn"
        emptyMessage="Chưa có bộ môn nào trong danh mục."
        keyExtractor={(item) => item.id}
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Thêm bộ môn chuyên môn">
        <form className="catalog-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="department-faculty">Khoa / viện trực thuộc</label>
            <select id="department-faculty" value={facultyId} onChange={(event) => setFacultyId(event.target.value)} required>
              <option value="">Chọn khoa / viện quản lý</option>
              {faculties.map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.name} ({faculty.code})</option>)}
            </select>
          </div>
          <div className="catalog-form-grid catalog-form-grid--code-name">
            <div className="form-group">
              <label htmlFor="department-code">Mã bộ môn</label>
              <input id="department-code" type="text" placeholder="BM-CNPM" value={code} onChange={(event) => setCode(event.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="department-name">Tên bộ môn chuyên môn</label>
              <input id="department-name" type="text" placeholder="Bộ môn Công nghệ Phần mềm" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="department-head">Trưởng bộ môn</label>
            <input id="department-head" type="text" placeholder="TS. Nguyễn Văn A" value={headOfDepartment} onChange={(event) => setHeadOfDepartment(event.target.value)} required />
          </div>
          <div className="catalog-form-grid catalog-form-grid--2">
            <div className="form-group">
              <label htmlFor="department-email">Email liên hệ</label>
              <input id="department-email" type="email" placeholder="bomon@vimaru.edu.vn" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="department-phone">Số điện thoại</label>
              <input id="department-phone" type="tel" placeholder="0225 3829 xxx" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
          </div>
          <div className="catalog-form-grid catalog-form-grid--2">
            <div className="form-group">
              <label htmlFor="department-lecturers">Số lượng giảng viên</label>
              <input id="department-lecturers" type="number" value={totalLecturers} onChange={(event) => setTotalLecturers(Number(event.target.value))} />
            </div>
            <div className="form-group">
              <label htmlFor="department-courses">Số học phần quản lý</label>
              <input id="department-courses" type="number" value={totalCourses} onChange={(event) => setTotalCourses(Number(event.target.value))} />
            </div>
          </div>
          <div className="modal-footer catalog-form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Hủy</button>
            <button type="submit" className="btn btn-primary">Lưu bộ môn</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={departmentToDelete !== null}
        onClose={() => setDepartmentToDelete(null)}
        onConfirm={() => {
          if (departmentToDelete) onDeleteDepartment(departmentToDelete.id);
          setDepartmentToDelete(null);
        }}
        title="Xóa bộ môn?"
        recordName={departmentToDelete?.name ?? ''}
        confirmText="Xóa bộ môn"
      />
    </div>
  );
};
