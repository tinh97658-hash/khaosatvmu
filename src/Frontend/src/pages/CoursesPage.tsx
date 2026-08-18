import React, { useState } from 'react';
import { FileSpreadsheet, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { ConfirmDialog, Modal } from '../components/Modal';
import { CourseImportDialog } from '../components/CourseImportDialog';
import {
  catalogErrorMessage,
  type CatalogImportResponse,
  type SaveCoursePayload,
} from '../services/catalogApi';
import type { ImportCourseRow } from '../utils/courseImportExcel';
import type { Course, CourseType, Department, Faculty } from '../types';

interface CoursesPageProps {
  courses: Course[];
  faculties: Faculty[];
  departments: Department[];
  /** Trả về mã lỗi của API, null nếu lưu thành công. */
  onSaveCourse: (courseId: number | null, course: SaveCoursePayload) => Promise<string | null>;
  onDeleteCourse: (courseId: number) => Promise<string | null>;
  onImportCourses: (rows: ImportCourseRow[]) => Promise<CatalogImportResponse>;
}

interface CourseForm {
  courseCode: string;
  courseName: string;
  credits: string;
  /** Chuỗi rỗng nghĩa là chưa xác định, gửi lên API thành null. */
  courseType: CourseType | '';
  departmentId: string;
  facultyId: string;
  prerequisiteCourseId: string;
}

const emptyForm: CourseForm = {
  courseCode: '',
  courseName: '',
  credits: '3',
  courseType: '',
  departmentId: '',
  facultyId: '',
  prerequisiteCourseId: '',
};

const courseTypeLabels: Record<CourseType, string> = {
  Required: 'Bắt buộc',
  Elective: 'Tự chọn',
};

const courseTypeLabelOf = (value: CourseType | null) =>
  value === null ? '—' : courseTypeLabels[value];

export const CoursesPage: React.FC<CoursesPageProps> = ({
  courses,
  faculties,
  departments,
  onSaveCourse,
  onDeleteCourse,
  onImportCourses,
}) => {
  const [search, setSearch] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [toDelete, setToDelete] = useState<Course | null>(null);
  const [validationError, setValidationError] = useState('');
  const [form, setForm] = useState<CourseForm>(emptyForm);

  const updateForm = (patch: Partial<CourseForm>) => setForm((prev) => ({ ...prev, ...patch }));
  const facultyNameOf = (facultyId: number | null) =>
    faculties.find((faculty) => faculty.facultyId === facultyId)?.facultyName ?? '—';
  const departmentNameOf = (departmentId: number | null) =>
    departments.find((department) => department.departmentId === departmentId)?.departmentName ?? '—';
  const courseCodeOf = (courseId: number | null) =>
    courses.find((course) => course.courseId === courseId)?.courseCode ?? '—';

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setValidationError('');
    setIsModalOpen(true);
  };

  const openEdit = (course: Course) => {
    setEditing(course);
    setForm({
      courseCode: course.courseCode,
      courseName: course.courseName,
      credits: String(course.credits),
      courseType: course.courseType ?? '',
      departmentId: course.departmentId === null ? '' : String(course.departmentId),
      facultyId: course.facultyId === null ? '' : String(course.facultyId),
      prerequisiteCourseId:
        course.prerequisiteCourseId === null ? '' : String(course.prerequisiteCourseId),
    });
    setValidationError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const courseCode = form.courseCode.trim();
    const courseName = form.courseName.trim();
    const credits = Number(form.credits);

    if (!courseCode || !courseName) {
      setValidationError('Vui lòng nhập mã học phần và tên học phần.');
      return;
    }
    if (!Number.isFinite(credits)) {
      setValidationError('Số tín chỉ không hợp lệ.');
      return;
    }

    setSaving(true);
    const errorCode = await onSaveCourse(editing?.courseId ?? null, {
      courseCode,
      courseName,
      credits,
      courseType: form.courseType === '' ? null : form.courseType,
      departmentId: form.departmentId ? Number(form.departmentId) : null,
      facultyId: form.facultyId ? Number(form.facultyId) : null,
      prerequisiteCourseId: form.prerequisiteCourseId ? Number(form.prerequisiteCourseId) : null,
    });
    setSaving(false);
    if (errorCode) {
      setValidationError(catalogErrorMessage(errorCode));
      return;
    }

    toast.success(editing ? 'Đã cập nhật học phần' : 'Đã thêm học phần', { description: courseName });
    setIsModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setValidationError('');
  };

  const handleImport = async (rows: ImportCourseRow[]): Promise<CatalogImportResponse> => {
    const result = await onImportCourses(rows);
    if (result.createdCount > 0) {
      toast.success(`Đã import ${result.createdCount} học phần`, {
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
    const errorCode = await onDeleteCourse(toDelete.courseId);
    if (errorCode) {
      toast.error('Không thể xóa học phần', { description: catalogErrorMessage(errorCode) });
    } else {
      toast.success('Đã xóa học phần', { description: toDelete.courseName });
    }
    setToDelete(null);
  };

  const availableDepartments = form.facultyId
    ? departments.filter((department) => String(department.facultyId) === form.facultyId)
    : departments;

  const normalized = search.trim().toLowerCase();
  const filtered = courses.filter((course) => {
    const matchesSearch =
      !normalized ||
      course.courseName.toLowerCase().includes(normalized) ||
      course.courseCode.toLowerCase().includes(normalized);
    const matchesFaculty = !facultyFilter || String(course.facultyId) === facultyFilter;
    return matchesSearch && matchesFaculty;
  });

  const columns: Column<Course>[] = [
    {
      key: 'courseCode',
      header: 'Mã học phần',
      width: '130px',
      filterValue: (item) => item.courseCode,
      render: (item) => <span className="catalog-code">{item.courseCode}</span>,
    },
    {
      key: 'courseName',
      header: 'Tên học phần',
      filterValue: (item) => item.courseName,
      render: (item) => <span className="catalog-cell-primary">{item.courseName}</span>,
    },
    {
      key: 'credits',
      header: 'Số tín chỉ',
      width: '100px',
      filterValue: (item) => String(item.credits),
      numeric: true,
      render: (item) => <span className="catalog-cell-primary">{item.credits}</span>,
    },
    {
      key: 'courseType',
      header: 'Loại học phần',
      width: '130px',
      filterValue: (item) => courseTypeLabelOf(item.courseType),
      render: (item) => courseTypeLabelOf(item.courseType),
    },
    {
      key: 'departmentId',
      header: 'Bộ môn',
      width: '230px',
      filterValue: (item) => (item.departmentId === null ? '—' : departmentNameOf(item.departmentId)),
      render: (item) => (item.departmentId === null ? '—' : departmentNameOf(item.departmentId)),
    },
    {
      key: 'facultyId',
      header: 'Khoa viện',
      width: '230px',
      filterValue: (item) => (item.facultyId === null ? '—' : facultyNameOf(item.facultyId)),
      render: (item) => (item.facultyId === null ? '—' : facultyNameOf(item.facultyId)),
    },
    {
      key: 'prerequisiteCourseId',
      header: 'Học phần tiên quyết',
      width: '200px',
      render: (item) =>
        item.prerequisiteCourseId === null ? '—' : courseCodeOf(item.prerequisiteCourseId),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      width: '92px',
      render: (item) => (
        <div className="catalog-actions">
          <button
            type="button"
            className="catalog-icon-button"
            onClick={() => openEdit(item)}
            aria-label={`Sửa ${item.courseName}`}
            title="Sửa"
          >
            <Pencil aria-hidden="true" size={15} />
          </button>
          <button
            type="button"
            className="catalog-icon-button catalog-icon-button--danger"
            onClick={() => setToDelete(item)}
            aria-label={`Xóa ${item.courseName}`}
            title="Xóa"
          >
            <Trash2 aria-hidden="true" size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="catalog-page catalog-page--wide">
      <header className="catalog-page-header">
        <div>
          <h2>Danh mục học phần</h2>
          <p>Bảng "Courses".</p>
        </div>
      </header>

      <DataTable
        columns={columns}
        data={filtered}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm mã hoặc tên học phần..."
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
        addNewLabel="Thêm học phần"
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
        emptyMessage="Chưa có học phần nào trong danh mục."
        keyExtractor={(item) => String(item.courseId)}
        pageSize={20}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? 'Sửa học phần' : 'Thêm học phần'}
      >
        <form className="catalog-form" onSubmit={(event) => void handleSubmit(event)}>
          {validationError && (
            <div className="catalog-validation-error" role="alert">{validationError}</div>
          )}
          <div className="catalog-form-grid catalog-form-grid--code-name">
            <div className="form-group">
              <label htmlFor="course-code">Mã học phần</label>
              <input
                id="course-code"
                type="text"
                placeholder="19783"
                value={form.courseCode}
                onChange={(event) => updateForm({ courseCode: event.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="course-name">Tên học phần</label>
              <input
                id="course-name"
                type="text"
                placeholder="Lập trình Web nâng cao"
                value={form.courseName}
                onChange={(event) => updateForm({ courseName: event.target.value })}
                required
              />
            </div>
          </div>

          <div className="catalog-form-grid catalog-form-grid--2">
            <div className="form-group">
              <label htmlFor="course-credits">Số tín chỉ</label>
              <input
                id="course-credits"
                type="number"
                value={form.credits}
                onChange={(event) => updateForm({ credits: event.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="course-type">Loại học phần</label>
              <select
                id="course-type"
                value={form.courseType}
                onChange={(event) =>
                  updateForm({ courseType: event.target.value as CourseType | '' })
                }
              >
                <option value="">Chưa xác định</option>
                <option value="Required">Required — Bắt buộc</option>
                <option value="Elective">Elective — Tự chọn</option>
              </select>
            </div>
          </div>

          <div className="catalog-form-grid catalog-form-grid--2">
            <div className="form-group">
              <label htmlFor="course-faculty">Khoa viện</label>
              <select
                id="course-faculty"
                value={form.facultyId}
                onChange={(event) => updateForm({ facultyId: event.target.value, departmentId: '' })}
              >
                <option value="">Chưa gán khoa viện</option>
                {faculties.map((faculty) => (
                  <option key={faculty.facultyId} value={String(faculty.facultyId)}>
                    {faculty.facultyName}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="course-department">Bộ môn</label>
              <select
                id="course-department"
                value={form.departmentId}
                onChange={(event) => updateForm({ departmentId: event.target.value })}
              >
                <option value="">Chưa gán bộ môn</option>
                {availableDepartments.map((department) => (
                  <option key={department.departmentId} value={String(department.departmentId)}>
                    {department.departmentName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="course-prerequisite">Học phần tiên quyết</label>
            <select
              id="course-prerequisite"
              value={form.prerequisiteCourseId}
              onChange={(event) => updateForm({ prerequisiteCourseId: event.target.value })}
            >
              <option value="">Không có</option>
              {courses
                .filter((course) => course.courseId !== editing?.courseId)
                .map((course) => (
                  <option key={course.courseId} value={String(course.courseId)}>
                    [{course.courseCode}] {course.courseName}
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

      <CourseImportDialog
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImport}
      />

      <ConfirmDialog
        isOpen={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => void handleDelete()}
        title="Xóa học phần?"
        recordName={toDelete?.courseName ?? ''}
        confirmText="Xóa"
      />
    </div>
  );
};
