import React, { useState } from 'react';
import { Mail, Phone, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { ConfirmDialog, Modal } from '../components/Modal';
import type { Department, Faculty, Lecturer } from '../types';

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
  const [lecturerToDelete, setLecturerToDelete] = useState<Lecturer | null>(null);
  const [code, setCode] = useState('');
  const [academicTitle, setAcademicTitle] = useState('TS.');
  const [fullName, setFullName] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [specialization, setSpecialization] = useState('');

  const availableDepartments = facultyId
    ? departments.filter((department) => department.facultyId === facultyId)
    : departments;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim() || !fullName.trim() || !facultyId) return;

    const faculty = faculties.find((item) => item.id === facultyId);
    const department = departments.find((item) => item.id === departmentId);
    const newLecturer: Lecturer = {
      id: `lec-${Date.now()}`,
      code: code.trim(),
      fullName: `${academicTitle} ${fullName.trim()}`,
      academicTitle,
      facultyId,
      facultyName: faculty?.name ?? '',
      departmentId: department?.id,
      departmentName: department?.name,
      email: email.trim() || `${code.toLowerCase()}@vimaru.edu.vn`,
      phone: phone.trim() || '0900 000 000',
      specialization: specialization.trim() || 'Giảng dạy và nghiên cứu khoa học',
      status: 'Đang công tác',
    };

    onAddLecturer(newLecturer);
    toast.success('Đã thêm giảng viên', { description: newLecturer.fullName });
    setIsModalOpen(false);
    setCode('');
    setFullName('');
    setFacultyId('');
    setDepartmentId('');
    setEmail('');
    setPhone('');
    setSpecialization('');
  };

  const filteredLecturers = lecturers.filter((lecturer) => {
    const matchesSearch =
      lecturer.code.toLowerCase().includes(search.toLowerCase()) ||
      lecturer.fullName.toLowerCase().includes(search.toLowerCase()) ||
      lecturer.specialization.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (!facultyFilter || lecturer.facultyId === facultyFilter);
  });

  const columns: Column<Lecturer>[] = [
    {
      key: 'code',
      header: 'Mã cán bộ',
      width: '105px',
      render: (row) => <span className="catalog-code">{row.code}</span>,
    },
    {
      key: 'fullName',
      header: 'Họ và tên giảng viên',
      render: (row) => (
        <div>
          <div className="catalog-cell-primary">{row.fullName}</div>
          {row.departmentName && <div className="catalog-cell-meta">{row.departmentName}</div>}
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
      header: 'Liên hệ',
      render: (row) => (
        <div className="catalog-contact">
          <span><Mail aria-hidden="true" size={13} />{row.email}</span>
          <span><Phone aria-hidden="true" size={13} />{row.phone}</span>
        </div>
      ),
    },
    {
      key: 'specialization',
      header: 'Chuyên môn giảng dạy',
      render: (row) => <span className="catalog-cell-meta">{row.specialization}</span>,
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
            onClick={() => setLecturerToDelete(row)}
            aria-label={`Xóa ${row.fullName}`}
            title="Xóa giảng viên"
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
          <h2>Danh mục giảng viên</h2>
          <p>Quản lý đội ngũ giảng viên phụ trách giảng dạy và đánh giá lớp học phần.</p>
        </div>
      </header>

      <DataTable
        columns={columns}
        data={filteredLecturers}
        searchPlaceholder="Tìm mã cán bộ, họ tên hoặc chuyên môn..."
        searchValue={search}
        onSearchChange={setSearch}
        filterOptions={[
          { label: 'Tất cả khoa / viện', value: '' },
          ...faculties.map((faculty) => ({ label: faculty.name, value: faculty.id })),
        ]}
        currentFilter={facultyFilter}
        onFilterChange={setFacultyFilter}
        onAddNew={() => setIsModalOpen(true)}
        addNewLabel="Thêm giảng viên"
        emptyMessage="Chưa có giảng viên nào trong danh mục."
        keyExtractor={(item) => item.id}
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Thêm giảng viên">
        <form className="catalog-form" onSubmit={handleSubmit}>
          <div className="catalog-form-grid catalog-form-grid--2">
            <div className="form-group">
              <label htmlFor="lecturer-faculty">Khoa / viện trực thuộc</label>
              <select id="lecturer-faculty" value={facultyId} onChange={(event) => { setFacultyId(event.target.value); setDepartmentId(''); }} required>
                <option value="">Chọn khoa / viện</option>
                {faculties.map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.name} ({faculty.code})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="lecturer-department">Bộ môn trực thuộc</label>
              <select id="lecturer-department" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
                <option value="">Chọn bộ môn (nếu có)</option>
                {availableDepartments.map((department) => <option key={department.id} value={department.id}>{department.name} ({department.code})</option>)}
              </select>
            </div>
          </div>
          <div className="catalog-form-grid catalog-form-grid--lecturer">
            <div className="form-group">
              <label htmlFor="lecturer-code">Mã cán bộ</label>
              <input id="lecturer-code" type="text" placeholder="CB01088" value={code} onChange={(event) => setCode(event.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="lecturer-title">Học hàm / học vị</label>
              <select id="lecturer-title" value={academicTitle} onChange={(event) => setAcademicTitle(event.target.value)}>
                <option value="ThS.">ThS.</option><option value="TS.">TS.</option><option value="PGS. TS.">PGS. TS.</option><option value="GS. TS.">GS. TS.</option><option value="CN.">CN.</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="lecturer-name">Họ và tên</label>
              <input id="lecturer-name" type="text" placeholder="Nguyễn Văn Hải" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
            </div>
          </div>
          <div className="catalog-form-grid catalog-form-grid--2">
            <div className="form-group">
              <label htmlFor="lecturer-email">Email công vụ</label>
              <input id="lecturer-email" type="email" placeholder="hainv@vimaru.edu.vn" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="lecturer-phone">Số điện thoại</label>
              <input id="lecturer-phone" type="tel" placeholder="09xx xxx xxx" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="lecturer-specialization">Chuyên môn giảng dạy và nghiên cứu</label>
            <input id="lecturer-specialization" type="text" placeholder="Lập trình Web, Cơ sở dữ liệu..." value={specialization} onChange={(event) => setSpecialization(event.target.value)} />
          </div>
          <div className="modal-footer catalog-form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Hủy</button>
            <button type="submit" className="btn btn-primary">Lưu giảng viên</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={lecturerToDelete !== null}
        onClose={() => setLecturerToDelete(null)}
        onConfirm={() => {
          if (lecturerToDelete) {
            onDeleteLecturer(lecturerToDelete.id);
            toast.success('Đã xóa giảng viên', { description: lecturerToDelete.fullName });
          }
          setLecturerToDelete(null);
        }}
        title="Xóa giảng viên?"
        recordName={lecturerToDelete?.fullName ?? ''}
        confirmText="Xóa giảng viên"
      />
    </div>
  );
};
