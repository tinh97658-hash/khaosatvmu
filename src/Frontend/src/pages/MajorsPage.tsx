import React, { useState } from 'react';
import { FileSpreadsheet, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { ConfirmDialog, Modal } from '../components/Modal';
import { MajorImportDialog } from '../components/MajorImportDialog';
import { catalogErrorMessage, type CatalogImportResponse } from '../services/catalogApi';
import type { ImportMajorRow } from '../utils/majorImportExcel';
import type {
  CourseSection,
  Curriculum,
  CurriculumCourse,
  Faculty,
  Major,
} from '../types';

interface MajorsPageProps {
  majors: Major[];
  faculties: Faculty[];
  curricula: Curriculum[];
  curriculumCourses: CurriculumCourse[];
  sections: CourseSection[];
  /** Trả về mã lỗi của API, null nếu lưu thành công. */
  onSaveMajor: (
    majorId: number | null,
    majorName: string,
    facultyId: number,
  ) => Promise<string | null>;
  onDeleteMajor: (majorId: number) => Promise<string | null>;
  onImportMajors: (rows: ImportMajorRow[]) => Promise<CatalogImportResponse>;
}

interface MajorForm {
  majorName: string;
  facultyId: string;
}

const emptyForm: MajorForm = { majorName: '', facultyId: '' };

export const MajorsPage: React.FC<MajorsPageProps> = ({
  majors,
  faculties,
  curricula,
  curriculumCourses,
  sections,
  onSaveMajor,
  onDeleteMajor,
  onImportMajors,
}) => {
  const [search, setSearch] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Major | null>(null);
  const [toDelete, setToDelete] = useState<Major | null>(null);
  const [validationError, setValidationError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<MajorForm>(emptyForm);

  const updateForm = (patch: Partial<MajorForm>) => setForm((prev) => ({ ...prev, ...patch }));
  const facultyNameOf = (facultyId: number) =>
    faculties.find((faculty) => faculty.facultyId === facultyId)?.facultyName ?? '—';

  // Số nhóm lớp của một ngành đi theo chuỗi khóa ngoại trong dtb.md:
  // Majors -> Curricula -> CurriculumCourses -> Courses -> CourseSections.
  const sectionCountOf = (majorId: number) => {
    const curriculumIds = curricula
      .filter((curriculum) => curriculum.majorId === majorId)
      .map((curriculum) => curriculum.curriculumId);
    if (curriculumIds.length === 0) return 0;

    const courseIds = new Set(
      curriculumCourses
        .filter((row) => curriculumIds.includes(row.curriculumId))
        .map((row) => row.courseId)
    );
    return sections.filter((section) => courseIds.has(section.courseId)).length;
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, facultyId: faculties[0] ? String(faculties[0].facultyId) : '' });
    setValidationError('');
    setIsModalOpen(true);
  };

  const openEdit = (major: Major) => {
    setEditing(major);
    setForm({ majorName: major.majorName, facultyId: String(major.facultyId) });
    setValidationError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = form.majorName.trim();

    if (!name) {
      setValidationError('Vui lòng nhập tên ngành.');
      return;
    }
    // "Majors"."FacultyId" NOT NULL
    if (!form.facultyId) {
      setValidationError('Vui lòng chọn khoa / viện.');
      return;
    }

    setSaving(true);
    const errorCode = await onSaveMajor(editing?.majorId ?? null, name, Number(form.facultyId));
    setSaving(false);
    if (errorCode) {
      setValidationError(catalogErrorMessage(errorCode));
      return;
    }

    toast.success(editing ? 'Đã cập nhật ngành' : 'Đã thêm ngành', { description: name });
    setIsModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setValidationError('');
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    const errorCode = await onDeleteMajor(toDelete.majorId);
    if (errorCode) {
      toast.error('Không thể xóa ngành', { description: catalogErrorMessage(errorCode) });
    } else {
      toast.success('Đã xóa ngành', { description: toDelete.majorName });
    }
    setToDelete(null);
  };

  const handleImport = async (rows: ImportMajorRow[]): Promise<CatalogImportResponse> => {
    const result = await onImportMajors(rows);
    if (result.createdCount > 0) {
      toast.success(`Đã import ${result.createdCount} ngành học`, {
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
  const filtered = majors.filter((major) => {
    const matchesSearch = !normalized || major.majorName.toLowerCase().includes(normalized);
    const matchesFaculty = !facultyFilter || String(major.facultyId) === facultyFilter;
    return matchesSearch && matchesFaculty;
  });

  const columns: Column<Major>[] = [
    {
      key: 'majorName',
      header: 'Tên ngành học',
      filterValue: (item) => item.majorName,
      render: (item) => <span className="catalog-cell-primary">{item.majorName}</span>,
    },
    {
      key: 'facultyId',
      header: 'Khoa viện',
      width: '300px',
      filterValue: (item) => facultyNameOf(item.facultyId),
      render: (item) => facultyNameOf(item.facultyId),
    },
    {
      key: 'sectionCount',
      header: 'Số nhóm lớp',
      width: '130px',
      filterValue: (item) => String(sectionCountOf(item.majorId)),
      numeric: true,
      render: (item) => (
        <span className="catalog-cell-primary">{sectionCountOf(item.majorId)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Hành động',
      width: '92px',
      render: (item) => (
        <div className="catalog-actions">
          <button
            type="button"
            className="catalog-icon-button"
            onClick={() => openEdit(item)}
            aria-label={`Sửa ${item.majorName}`}
            title="Sửa"
          >
            <Pencil aria-hidden="true" size={15} />
          </button>
          <button
            type="button"
            className="catalog-icon-button catalog-icon-button--danger"
            onClick={() => setToDelete(item)}
            aria-label={`Xóa ${item.majorName}`}
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
          <h2>Danh mục ngành đào tạo</h2>
          <p>Bảng "Majors".</p>
        </div>
      </header>

      <DataTable
        columns={columns}
        data={filtered}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm nhanh theo tên ngành học..."
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
        addNewLabel="Thêm ngành học"
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
        emptyMessage="Chưa có ngành học nào trong danh mục."
        keyExtractor={(item) => String(item.majorId)}
        pageSize={20}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? 'Sửa ngành học' : 'Thêm ngành học'}
      >
        <form className="catalog-form" onSubmit={(event) => void handleSubmit(event)}>
          {validationError && (
            <div className="catalog-validation-error" role="alert">{validationError}</div>
          )}
          <div className="form-group">
            <label htmlFor="major-name">Tên ngành</label>
            <input
              id="major-name"
              type="text"
              placeholder="Công nghệ Thông tin"
              value={form.majorName}
              onChange={(event) => updateForm({ majorName: event.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="major-faculty">Khoa viện</label>
            <select
              id="major-faculty"
              value={form.facultyId}
              onChange={(event) => updateForm({ facultyId: event.target.value })}
              required
            >
              <option value="">Chọn khoa viện</option>
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
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || faculties.length === 0}
            >
              {saving ? 'Đang lưu...' : editing ? 'Cập nhật' : 'Lưu'}
            </button>
          </div>
        </form>
      </Modal>

      <MajorImportDialog
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImport}
      />

      <ConfirmDialog
        isOpen={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => void handleDelete()}
        title="Xóa ngành?"
        recordName={toDelete?.majorName ?? ''}
        confirmText="Xóa"
      />
    </div>
  );
};
