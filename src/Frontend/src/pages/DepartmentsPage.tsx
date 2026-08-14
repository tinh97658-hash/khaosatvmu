import React, { useState } from 'react';
import { FileSpreadsheet, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { ConfirmDialog, Modal } from '../components/Modal';
import { DepartmentImportDialog } from '../components/DepartmentImportDialog';
import { catalogErrorMessage, type CatalogImportResponse } from '../services/catalogApi';
import type { ImportDepartmentRow } from '../utils/departmentImportExcel';
import type { Course, Department, Faculty, Lecturer } from '../types';

interface DepartmentsPageProps {
  departments: Department[];
  faculties: Faculty[];
  courses: Course[];
  lecturers: Lecturer[];
  /** Trả về mã lỗi của API, null nếu lưu thành công. */
  onSaveDepartment: (
    departmentId: number | null,
    departmentName: string,
    facultyId: number | null,
  ) => Promise<string | null>;
  onDeleteDepartment: (departmentId: number) => Promise<string | null>;
  onImportDepartments: (rows: ImportDepartmentRow[]) => Promise<CatalogImportResponse>;
}

interface DepartmentForm {
  departmentName: string;
  facultyId: string;
}

const emptyForm: DepartmentForm = { departmentName: '', facultyId: '' };

export const DepartmentsPage: React.FC<DepartmentsPageProps> = ({
  departments,
  faculties,
  courses,
  lecturers,
  onSaveDepartment,
  onDeleteDepartment,
  onImportDepartments,
}) => {
  const [search, setSearch] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [toDelete, setToDelete] = useState<Department | null>(null);
  const [validationError, setValidationError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<DepartmentForm>(emptyForm);

  const updateForm = (patch: Partial<DepartmentForm>) => setForm((prev) => ({ ...prev, ...patch }));
  const facultyNameOf = (facultyId: number | null) =>
    faculties.find((faculty) => faculty.facultyId === facultyId)?.facultyName ?? '—';
  const courseCountOf = (departmentId: number) =>
    courses.filter((course) => course.departmentId === departmentId).length;
  const lecturerCountOf = (departmentId: number) =>
    lecturers.filter((lecturer) => lecturer.departmentId === departmentId).length;

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setValidationError('');
    setIsModalOpen(true);
  };

  const openEdit = (department: Department) => {
    setEditing(department);
    setForm({
      departmentName: department.departmentName,
      facultyId: department.facultyId === null ? '' : String(department.facultyId),
    });
    setValidationError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = form.departmentName.trim();

    if (!name) {
      setValidationError('Vui lòng nhập tên bộ môn.');
      return;
    }

    setSaving(true);
    const errorCode = await onSaveDepartment(
      editing?.departmentId ?? null,
      name,
      form.facultyId ? Number(form.facultyId) : null
    );
    setSaving(false);
    if (errorCode) {
      setValidationError(catalogErrorMessage(errorCode));
      return;
    }

    toast.success(editing ? 'Đã cập nhật bộ môn' : 'Đã thêm bộ môn', { description: name });
    setIsModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setValidationError('');
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    const errorCode = await onDeleteDepartment(toDelete.departmentId);
    if (errorCode) {
      toast.error('Không thể xóa bộ môn', { description: catalogErrorMessage(errorCode) });
    } else {
      toast.success('Đã xóa bộ môn', { description: toDelete.departmentName });
    }
    setToDelete(null);
  };

  const handleImport = async (rows: ImportDepartmentRow[]): Promise<CatalogImportResponse> => {
    const result = await onImportDepartments(rows);
    if (result.createdCount > 0) {
      toast.success(`Đã import ${result.createdCount} bộ môn`, {
        description: result.skippedCount > 0 ? `${result.skippedCount} dòng bị bỏ qua` : undefined,
      });
    } else {
      toast.error('Không có dòng nào được thêm', {
        description: `${result.skippedCount} dòng bị bỏ qua`,
      });
    }
    return result;
  };

  const normalized = search.trim().toLowerCase();
  const filtered = departments.filter((department) => {
    const matchesSearch = !normalized || department.departmentName.toLowerCase().includes(normalized);
    const matchesFaculty = !facultyFilter || String(department.facultyId) === facultyFilter;
    return matchesSearch && matchesFaculty;
  });

  const columns: Column<Department>[] = [
    {
      key: 'departmentName',
      header: 'Tên bộ môn',
      render: (row) => <span className="catalog-cell-primary">{row.departmentName}</span>,
    },
    {
      key: 'facultyId',
      header: 'Khoa viện',
      width: '280px',
      render: (row) => (row.facultyId === null ? '—' : facultyNameOf(row.facultyId)),
    },
    {
      key: 'courseCount',
      header: 'Số môn học',
      width: '120px',
      render: (row) => (
        <span className="catalog-cell-primary">{courseCountOf(row.departmentId)}</span>
      ),
    },
    {
      key: 'lecturerCount',
      header: 'Số giảng viên',
      width: '130px',
      render: (row) => (
        <span className="catalog-cell-primary">{lecturerCountOf(row.departmentId)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Hành động',
      width: '92px',
      render: (row) => (
        <div className="catalog-actions">
          <button
            type="button"
            className="catalog-icon-button"
            onClick={() => openEdit(row)}
            aria-label={`Sửa ${row.departmentName}`}
            title="Sửa"
          >
            <Pencil aria-hidden="true" size={15} />
          </button>
          <button
            type="button"
            className="catalog-icon-button catalog-icon-button--danger"
            onClick={() => setToDelete(row)}
            aria-label={`Xóa ${row.departmentName}`}
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
          <h2>Danh mục bộ môn</h2>
          <p>Bảng "Departments".</p>
        </div>
      </header>

      <DataTable
        columns={columns}
        data={filtered}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm nhanh theo tên bộ môn..."
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
        addNewLabel="Thêm bộ môn"
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
        emptyMessage="Chưa có bộ môn nào trong danh mục."
        keyExtractor={(item) => String(item.departmentId)}
        pageSize={20}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? 'Sửa bộ môn' : 'Thêm bộ môn'}
      >
        <form className="catalog-form" onSubmit={(event) => void handleSubmit(event)}>
          {validationError && (
            <div className="catalog-validation-error" role="alert">{validationError}</div>
          )}
          <div className="form-group">
            <label htmlFor="department-name">Tên bộ môn</label>
            <input
              id="department-name"
              type="text"
              placeholder="Bộ môn Công nghệ Phần mềm"
              value={form.departmentName}
              onChange={(event) => updateForm({ departmentName: event.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="department-faculty">Khoa viện</label>
            <select
              id="department-faculty"
              value={form.facultyId}
              onChange={(event) => updateForm({ facultyId: event.target.value })}
            >
              <option value="">Chưa thuộc khoa viện</option>
              {faculties.map((faculty) => (
                <option key={faculty.facultyId} value={String(faculty.facultyId)}>
                  {faculty.facultyName}
                </option>
              ))}
            </select>
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

      <DepartmentImportDialog
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImport}
      />

      <ConfirmDialog
        isOpen={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => void handleDelete()}
        title="Xóa bộ môn?"
        recordName={toDelete?.departmentName ?? ''}
        confirmText="Xóa"
      />
    </div>
  );
};
