import React, { useState } from 'react';
import { BookOpen, Building2, GraduationCap, Mail, Phone, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { ConfirmDialog, Modal } from '../components/Modal';
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
  const [facultyToDelete, setFacultyToDelete] = useState<Faculty | null>(null);
  const [validationError, setValidationError] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [dean, setDean] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [year, setYear] = useState('1990');

  const filtered = faculties.filter(
    (faculty) =>
      faculty.name.toLowerCase().includes(search.toLowerCase()) ||
      faculty.code.toLowerCase().includes(search.toLowerCase()) ||
      faculty.dean.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim() || !name.trim()) {
      setValidationError('Vui lòng nhập mã và tên khoa hoặc viện.');
      return;
    }

    const newFaculty: Faculty = {
      id: `fac-${Date.now()}`,
      code: code.trim(),
      name: name.trim(),
      dean: dean.trim() || 'Đang cập nhật',
      email: email.trim() || `${code.toLowerCase()}@vimaru.edu.vn`,
      phone: phone.trim() || '0225 3829xxx',
      establishedYear: parseInt(year) || 1990,
      totalCourses: 0,
      totalStudents: 0,
    };

    onAddFaculty(newFaculty);
    toast.success('Đã thêm khoa / viện', { description: newFaculty.name });
    setIsModalOpen(false);
    setValidationError('');
    setCode('');
    setName('');
    setDean('');
    setEmail('');
    setPhone('');
  };

  const columns: Column<Faculty>[] = [
    {
      key: 'code',
      header: 'Mã khoa/viện',
      width: '110px',
      render: (item) => <span className="catalog-code">{item.code}</span>,
    },
    {
      key: 'name',
      header: 'Tên khoa / viện đào tạo',
      render: (item) => <span className="catalog-cell-primary">{item.name}</span>,
    },
    {
      key: 'dean',
      header: 'Trưởng đơn vị',
    },
    {
      key: 'contact',
      header: 'Thông tin liên hệ',
      render: (item) => (
        <div className="catalog-contact">
          <span><Mail aria-hidden="true" size={13} />{item.email}</span>
          <span><Phone aria-hidden="true" size={13} />{item.phone}</span>
        </div>
      ),
    },
    {
      key: 'stats',
      header: 'Quy mô',
      width: '180px',
      render: (item) => (
        <div className="catalog-stats">
          <span className="catalog-inline-meta"><Building2 aria-hidden="true" size={13} /><strong>{item.departmentsCount || 2}</strong> bộ môn</span>
          <span className="catalog-inline-meta"><BookOpen aria-hidden="true" size={13} /><strong>{item.totalCourses}</strong> HP <GraduationCap aria-hidden="true" size={13} /><strong>{item.totalStudents}</strong> SV</span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      width: '64px',
      render: (item) => (
        <div className="catalog-actions">
          <button
            type="button"
            className="catalog-icon-button catalog-icon-button--danger"
            onClick={() => setFacultyToDelete(item)}
            aria-label={`Xóa ${item.name}`}
            title="Xóa khoa / viện"
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
          <h2>Danh mục khoa và viện đào tạo</h2>
          <p>Quản lý các đơn vị giảng dạy thuộc Trường Đại học Hàng hải Việt Nam.</p>
        </div>
      </header>

      <DataTable
        columns={columns}
        data={filtered}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm tên, mã hoặc trưởng đơn vị..."
        onAddNew={() => {
          setValidationError('');
          setIsModalOpen(true);
        }}
        addNewLabel="Thêm khoa / viện"
        keyExtractor={(item) => item.id}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Thêm khoa / viện đào tạo"
      >
        <form className="catalog-form" onSubmit={handleSubmit}>
          {validationError && <div className="catalog-validation-error" role="alert">{validationError}</div>}
          <div className="catalog-form-grid catalog-form-grid--2">
            <div className="form-group">
              <label htmlFor="faculty-code">Mã khoa / viện</label>
              <input id="faculty-code" type="text" placeholder="Ví dụ: CNTT" value={code} onChange={(event) => setCode(event.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="faculty-year">Năm thành lập</label>
              <input id="faculty-year" type="number" value={year} onChange={(event) => setYear(event.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="faculty-name">Tên đầy đủ</label>
            <input id="faculty-name" type="text" placeholder="Ví dụ: Khoa Công nghệ Thông tin" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="faculty-dean">Trưởng khoa / viện</label>
            <input id="faculty-dean" type="text" placeholder="Ví dụ: TS. Nguyễn Văn Hải" value={dean} onChange={(event) => setDean(event.target.value)} />
          </div>
          <div className="catalog-form-grid catalog-form-grid--2">
            <div className="form-group">
              <label htmlFor="faculty-email">Email liên hệ</label>
              <input id="faculty-email" type="email" placeholder="cntt@vimaru.edu.vn" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="faculty-phone">Số điện thoại</label>
              <input id="faculty-phone" type="tel" placeholder="0225 3829xxx" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
          </div>
          <div className="modal-footer catalog-form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Hủy</button>
            <button type="submit" className="btn btn-primary">Lưu khoa / viện</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={facultyToDelete !== null}
        onClose={() => setFacultyToDelete(null)}
        onConfirm={() => {
          if (facultyToDelete) {
            onDeleteFaculty(facultyToDelete.id);
            toast.success('Đã xóa khoa / viện', { description: facultyToDelete.name });
          }
          setFacultyToDelete(null);
        }}
        title="Xóa khoa / viện?"
        recordName={facultyToDelete?.name ?? ''}
        confirmText="Xóa khoa / viện"
      />
    </div>
  );
};
