import React, { useState } from 'react';
import { FileSpreadsheet, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { ConfirmDialog, Modal } from '../components/Modal';
import { LecturerImportDialog } from '../components/LecturerImportDialog';
import {
  catalogErrorMessage,
  type CatalogImportResponse,
  type SaveLecturerPayload,
} from '../services/catalogApi';
import type { ImportLecturerRow } from '../utils/lecturerImportExcel';
import type { Department, Faculty, Lecturer } from '../types';

interface LecturersPageProps {
  lecturers: Lecturer[];
  faculties: Faculty[];
  departments: Department[];
  /** Trả về mã lỗi của API, null nếu lưu thành công. */
  onSaveLecturer: (
    lecturerId: number | null,
    lecturer: SaveLecturerPayload,
  ) => Promise<string | null>;
  onDeleteLecturer: (lecturerId: number) => Promise<string | null>;
  onImportLecturers: (rows: ImportLecturerRow[]) => Promise<CatalogImportResponse>;
}

interface LecturerForm {
  fullName: string;
  departmentId: string;
  facultyId: string;
  email: string;
  phoneNumber: string;
}

const emptyForm: LecturerForm = {
  fullName: '',
  departmentId: '',
  facultyId: '',
  email: '',
  phoneNumber: '',
};

export const LecturersPage: React.FC<LecturersPageProps> = ({
  lecturers,
  faculties,
  departments,
  onSaveLecturer,
  onDeleteLecturer,
  onImportLecturers,
}) => {
  const [search, setSearch] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Lecturer | null>(null);
  const [toDelete, setToDelete] = useState<Lecturer | null>(null);
  const [validationError, setValidationError] = useState('');
  const [form, setForm] = useState<LecturerForm>(emptyForm);

  const updateForm = (patch: Partial<LecturerForm>) => setForm((prev) => ({ ...prev, ...patch }));
  const facultyNameOf = (facultyId: number | null) =>
    faculties.find((faculty) => faculty.facultyId === facultyId)?.facultyName ?? '—';
  const departmentNameOf = (departmentId: number | null) =>
    departments.find((department) => department.departmentId === departmentId)?.departmentName ?? '—';

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setValidationError('');
    setIsModalOpen(true);
  };

  const openEdit = (lecturer: Lecturer) => {
    setEditing(lecturer);
    setForm({
      fullName: lecturer.fullName,
      departmentId: lecturer.departmentId === null ? '' : String(lecturer.departmentId),
      facultyId: lecturer.facultyId === null ? '' : String(lecturer.facultyId),
      email: lecturer.email ?? '',
      phoneNumber: lecturer.phoneNumber ?? '',
    });
    setValidationError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const fullName = form.fullName.trim();
    const email = form.email.trim();

    if (!fullName) {
      setValidationError('Vui lòng nhập họ và tên.');
      return;
    }

    setSaving(true);
    const errorCode = await onSaveLecturer(editing?.lecturerId ?? null, {
      fullName,
      departmentId: form.departmentId ? Number(form.departmentId) : null,
      facultyId: form.facultyId ? Number(form.facultyId) : null,
      email: email || null,
      phoneNumber: form.phoneNumber.trim() || null,
    });
    setSaving(false);
    if (errorCode) {
      setValidationError(catalogErrorMessage(errorCode));
      return;
    }

    toast.success(editing ? 'Đã cập nhật giảng viên' : 'Đã thêm giảng viên', { description: fullName });
    setIsModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setValidationError('');
  };

  const handleImport = async (rows: ImportLecturerRow[]): Promise<CatalogImportResponse> => {
    const result = await onImportLecturers(rows);
    if (result.createdCount > 0) {
      toast.success(`Đã import ${result.createdCount} giảng viên`, {
        description: result.skippedCount > 0 ? `${result.skippedCount} dòng bị bỏ qua` : undefined,
      });
    } else {
      toast.error('Không có dòng nào được thêm', {
        description: `${result.skippedCount} dòng bị bỏ qua`,
      });
    }
    return result;
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    const errorCode = await onDeleteLecturer(toDelete.lecturerId);
    if (errorCode) {
      toast.error('Không thể xóa giảng viên', { description: catalogErrorMessage(errorCode) });
    } else {
      toast.success('Đã xóa giảng viên', { description: toDelete.fullName });
    }
    setToDelete(null);
  };

  const availableDepartments = form.facultyId
    ? departments.filter((department) => String(department.facultyId) === form.facultyId)
    : departments;

  const normalized = search.trim().toLowerCase();
  const filtered = lecturers.filter((lecturer) => {
    const matchesSearch =
      !normalized ||
      lecturer.fullName.toLowerCase().includes(normalized) ||
      (lecturer.email ?? '').toLowerCase().includes(normalized);
    const matchesFaculty = !facultyFilter || String(lecturer.facultyId) === facultyFilter;
    return matchesSearch && matchesFaculty;
  });

  const columns: Column<Lecturer>[] = [
    {
      key: 'fullName',
      header: 'Họ và tên',
      render: (row) => <span className="catalog-cell-primary">{row.fullName}</span>,
    },
    {
      key: 'departmentId',
      header: 'Bộ môn',
      width: '250px',
      render: (row) => (row.departmentId === null ? '—' : departmentNameOf(row.departmentId)),
    },
    {
      key: 'facultyId',
      header: 'Khoa viện',
      width: '250px',
      render: (row) => (row.facultyId === null ? '—' : facultyNameOf(row.facultyId)),
    },
    {
      key: 'email',
      header: 'Email',
      width: '230px',
      render: (row) => row.email ?? '—',
    },
    {
      key: 'phoneNumber',
      header: 'Số điện thoại',
      width: '150px',
      render: (row) => row.phoneNumber ?? '—',
    },
    {
      key: 'actions',
      header: 'Thao tác',
      width: '92px',
      render: (row) => (
        <div className="catalog-actions">
          <button
            type="button"
            className="catalog-icon-button"
            onClick={() => openEdit(row)}
            aria-label={`Sửa ${row.fullName}`}
            title="Sửa"
          >
            <Pencil aria-hidden="true" size={15} />
          </button>
          <button
            type="button"
            className="catalog-icon-button catalog-icon-button--danger"
            onClick={() => setToDelete(row)}
            aria-label={`Xóa ${row.fullName}`}
            title="Xóa"
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
          <p>Bảng "Lecturers".</p>
        </div>
      </header>

      <DataTable
        columns={columns}
        data={filtered}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm họ tên hoặc email..."
        filterOptions={[
          { label: 'Tất cả khoa / viện', value: '' },
          ...faculties.map((faculty) => ({
            label: faculty.facultyName,
            value: String(faculty.facultyId),
          })),
        ]}
        currentFilter={facultyFilter}
        onFilterChange={setFacultyFilter}
        onAddNew={openCreate}
        addNewLabel="Thêm giảng viên"
        toolbarActions={(
          <button
            type="button"
            className="btn btn-secondary btn-sm catalog-add-button"
            onClick={() => setIsImportOpen(true)}
          >
            <FileSpreadsheet aria-hidden="true" size={16} />
            <span>Import Excel</span>
          </button>
        )}
        emptyMessage="Chưa có giảng viên nào trong danh mục."
        keyExtractor={(item) => String(item.lecturerId)}
        pageSize={20}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? 'Sửa giảng viên' : 'Thêm giảng viên'}
      >
        <form className="catalog-form" onSubmit={(event) => void handleSubmit(event)}>
          {validationError && (
            <div className="catalog-validation-error" role="alert">{validationError}</div>
          )}
          <div className="form-group">
            <label htmlFor="lecturer-name">Họ và tên</label>
            <input
              id="lecturer-name"
              type="text"
              placeholder="Nguyễn Văn Hải"
              value={form.fullName}
              onChange={(event) => updateForm({ fullName: event.target.value })}
              required
            />
          </div>
          <div className="catalog-form-grid catalog-form-grid--2">
            <div className="form-group">
              <label htmlFor="lecturer-faculty">Khoa viện</label>
              <select
                id="lecturer-faculty"
                value={form.facultyId}
                onChange={(event) => updateForm({ facultyId: event.target.value, departmentId: '' })}
              >
                <option value="">Chưa phân công</option>
                {faculties.map((faculty) => (
                  <option key={faculty.facultyId} value={String(faculty.facultyId)}>
                    {faculty.facultyName}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="lecturer-department">Bộ môn</label>
              <select
                id="lecturer-department"
                value={form.departmentId}
                onChange={(event) => updateForm({ departmentId: event.target.value })}
              >
                <option value="">Chưa phân công</option>
                {availableDepartments.map((department) => (
                  <option key={department.departmentId} value={String(department.departmentId)}>
                    {department.departmentName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="catalog-form-grid catalog-form-grid--2">
            <div className="form-group">
              <label htmlFor="lecturer-email">Email</label>
              <input
                id="lecturer-email"
                type="email"
                placeholder="Để trống nếu chưa có"
                value={form.email}
                onChange={(event) => updateForm({ email: event.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="lecturer-phone">Số điện thoại</label>
              <input
                id="lecturer-phone"
                type="tel"
                placeholder="09xx xxx xxx"
                value={form.phoneNumber}
                onChange={(event) => updateForm({ phoneNumber: event.target.value })}
              />
            </div>
          </div>
          <div className="modal-footer catalog-form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Đang lưu...' : editing ? 'Cập nhật' : 'Lưu'}
            </button>
          </div>
        </form>
      </Modal>

      <LecturerImportDialog
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImport}
      />

      <ConfirmDialog
        isOpen={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => void handleDelete()}
        title="Xóa giảng viên?"
        recordName={toDelete?.fullName ?? ''}
        confirmText="Xóa"
      />
    </div>
  );
};
