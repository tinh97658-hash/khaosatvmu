import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, BriefcaseBusiness, FileSpreadsheet, LoaderCircle, Pencil, Save, Trash2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { ConfirmDialog, Modal } from '../components/Modal';
import { LecturerImportDialog } from '../components/LecturerImportDialog';
import { ApiError } from '../services/apiClient';
import {
  catalogApi,
  catalogErrorMessage,
  type CatalogImportResponse,
  type SaveLecturerPayload,
} from '../services/catalogApi';
import type { ImportLecturerRow } from '../utils/lecturerImportExcel';
import type { Department, Faculty, Lecturer, LecturerRecentCourseSection, Position } from '../types';
import { useSemester } from '../context/semesterContext';

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
  positionId: string;
}

const emptyForm: LecturerForm = {
  fullName: '',
  departmentId: '',
  facultyId: '',
  email: '',
  phoneNumber: '',
  positionId: '',
};

/** Form quản lý chức vụ; positionId null nghĩa là đang thêm mới. */
interface PositionForm {
  positionId: number | null;
  positionName: string;
}

const emptyPositionForm: PositionForm = { positionId: null, positionName: '' };

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
  const { activeSemesterId, activeSemesterLabel } = useSemester();
  const [recentClassesLecturer, setRecentClassesLecturer] = useState<Lecturer | null>(null);
  const [recentClasses, setRecentClasses] = useState<LecturerRecentCourseSection[]>([]);
  const [recentClassesLoading, setRecentClassesLoading] = useState(false);
  const [recentClassesError, setRecentClassesError] = useState<string | null>(null);
  const recentClassesRequestId = useRef(0);

  // ----------------------------------------------------------- Chức vụ
  const [positions, setPositions] = useState<Position[]>([]);
  const [isPositionsOpen, setIsPositionsOpen] = useState(false);
  const [positionForm, setPositionForm] = useState<PositionForm>(emptyPositionForm);
  const [positionError, setPositionError] = useState<string | null>(null);
  const [positionSaving, setPositionSaving] = useState(false);
  const [deletingPositionId, setDeletingPositionId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void catalogApi
      .positions()
      .then((next) => {
        if (active) setPositions(next);
      })
      .catch(() => {
        if (active) setPositionError('Không tải được danh sách chức vụ.');
      });
    return () => {
      active = false;
    };
  }, []);

  const messageFrom = (error: unknown) =>
    error instanceof ApiError ? catalogErrorMessage(error.errorCode) : catalogErrorMessage(null);

  const openPositionCreate = () => {
    setPositionError(null);
    setDeletingPositionId(null);
    setPositionForm(emptyPositionForm);
  };

  const openPositionEdit = (position: Position) => {
    setPositionError(null);
    setDeletingPositionId(null);
    setPositionForm({ positionId: position.positionId, positionName: position.positionName });
  };

  const handleSavePosition = async (event: React.FormEvent) => {
    event.preventDefault();

    const positionName = positionForm.positionName.trim();
    if (!positionName) {
      setPositionError('Vui lòng nhập tên chức vụ.');
      return;
    }

    setPositionSaving(true);
    try {
      if (positionForm.positionId === null) {
        await catalogApi.createPosition(positionName);
      } else {
        await catalogApi.updatePosition(positionForm.positionId, positionName);
      }
      setPositions(await catalogApi.positions());
      toast.success(positionForm.positionId === null ? 'Đã thêm chức vụ' : 'Đã cập nhật chức vụ', {
        description: positionName,
      });
      setPositionForm(emptyPositionForm);
      setPositionError(null);
    } catch (error) {
      setPositionError(messageFrom(error));
    } finally {
      setPositionSaving(false);
    }
  };

  const handleDeletePosition = async (positionId: number) => {
    try {
      await catalogApi.deletePosition(positionId);
      setPositions(await catalogApi.positions());
      toast.success('Đã xóa chức vụ');
      if (positionForm.positionId === positionId) setPositionForm(emptyPositionForm);
    } catch (error) {
      setPositionError(messageFrom(error));
    } finally {
      setDeletingPositionId(null);
    }
  };

  const positionNameOf = (positionId: number | null) =>
    positions.find((position) => position.positionId === positionId)?.positionName ?? '—';

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
      positionId: lecturer.positionId === null ? '' : String(lecturer.positionId),
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
      positionId: form.positionId ? Number(form.positionId) : null,
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

  const openRecentClasses = async (lecturer: Lecturer) => {
    const requestId = ++recentClassesRequestId.current;
    setRecentClassesLecturer(lecturer);
    setRecentClasses([]);
    setRecentClassesError(null);

    if (activeSemesterId === null) {
      setRecentClassesError('Chưa chọn học kỳ hiện tại trên thanh điều hướng.');
      return;
    }

    setRecentClassesLoading(true);
    try {
      const next = await catalogApi.lecturerRecentCourseSections(lecturer.lecturerId, activeSemesterId);
      if (recentClassesRequestId.current === requestId) setRecentClasses(next);
    } catch (error) {
      if (recentClassesRequestId.current === requestId) setRecentClassesError(messageFrom(error));
    } finally {
      if (recentClassesRequestId.current === requestId) setRecentClassesLoading(false);
    }
  };

  const closeRecentClasses = () => {
    recentClassesRequestId.current += 1;
    setRecentClassesLecturer(null);
    setRecentClasses([]);
    setRecentClassesError(null);
    setRecentClassesLoading(false);
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
  }).sort((left, right) => {
    const missingEmailResult = Number(Boolean(left.email?.trim())) - Number(Boolean(right.email?.trim()));
    if (missingEmailResult !== 0) return missingEmailResult;
    const nameResult = left.fullName.localeCompare(right.fullName, 'vi', { sensitivity: 'base' });
    return nameResult !== 0 ? nameResult : left.lecturerId - right.lecturerId;
  });
  const missingEmailCount = lecturers.filter((lecturer) => !lecturer.email?.trim()).length;

  const columns: Column<Lecturer>[] = [
    {
      key: 'fullName',
      header: 'Họ và tên',
      filterValue: (row) => row.fullName,
      render: (row) => {
        const missingEmail = !row.email?.trim();
        return (
          <div className={missingEmail ? 'catalog-cell-unidentified' : undefined}>
            <div className="catalog-cell-primary">
              {missingEmail && <TriangleAlert aria-hidden="true" size={14} />}
              {row.fullName}
            </div>
            <div className="catalog-cell-meta">
              Mã nội bộ GV-{String(row.lecturerId).padStart(6, '0')}
              {missingEmail ? ' · cần bổ sung email' : ''}
            </div>
          </div>
        );
      },
    },
    {
      key: 'departmentId',
      header: 'Bộ môn',
      width: '250px',
      filterValue: (row) => (row.departmentId === null ? '—' : departmentNameOf(row.departmentId)),
      render: (row) => (row.departmentId === null ? '—' : departmentNameOf(row.departmentId)),
    },
    {
      key: 'facultyId',
      header: 'Khoa viện',
      width: '250px',
      filterValue: (row) => (row.facultyId === null ? '—' : facultyNameOf(row.facultyId)),
      render: (row) => (row.facultyId === null ? '—' : facultyNameOf(row.facultyId)),
    },
    {
      key: 'positionId',
      header: 'Chức vụ',
      width: '170px',
      filterValue: (row) => (row.positionId === null ? '—' : positionNameOf(row.positionId)),
      render: (row) => (row.positionId === null ? '—' : positionNameOf(row.positionId)),
    },
    {
      key: 'email',
      header: 'Email',
      width: '230px',
      render: (row) => row.email?.trim() || (
        <span className="lecturer-email-warning">
          <TriangleAlert aria-hidden="true" size={14} />
          Chưa có email
        </span>
      ),
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
      width: '205px',
      render: (row) => (
        <div className="catalog-actions">
          <button
            type="button"
            className="lecturer-recent-classes-button"
            onClick={() => void openRecentClasses(row)}
            aria-label={`Xem lớp đã dạy của ${row.fullName} trong học kỳ hiện tại`}
            title="Xem tối đa 3 lớp trong học kỳ hiện tại"
          >
            <BookOpen aria-hidden="true" size={14} />
            <span>Lớp đã dạy</span>
          </button>
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

      {missingEmailCount > 0 && (
        <div className="lecturer-missing-email-summary" role="status">
          <TriangleAlert aria-hidden="true" size={18} />
          <div>
            <strong>{missingEmailCount} giảng viên chưa có email</strong>
            <span>Các giảng viên này được ưu tiên hiển thị ở đầu danh sách để bổ sung thông tin.</span>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={filtered}
        rowPriority={(lecturer) => lecturer.email?.trim() ? 1 : 0}
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
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm catalog-add-button"
              onClick={() => {
                openPositionCreate();
                setIsPositionsOpen(true);
              }}
            >
              <BriefcaseBusiness aria-hidden="true" size={16} />
              <span>Chức vụ</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm catalog-add-button"
              onClick={() => setIsImportOpen(true)}
            >
              <FileSpreadsheet aria-hidden="true" size={16} />
              <span>Import Excel</span>
            </button>
          </>
        )}
        emptyMessage="Chưa có giảng viên nào trong danh mục."
        keyExtractor={(item) => String(item.lecturerId)}
        pageSize={20}
      />

      <Modal
        isOpen={recentClassesLecturer !== null}
        onClose={closeRecentClasses}
        title={`Lớp đã dạy — ${recentClassesLecturer?.fullName ?? ''}`}
      >
        <div className="lecturer-recent-classes">
          <div className="catalog-context-band">
            Học kỳ đang xem: <strong>{activeSemesterLabel}</strong>
          </div>
          <p className="lecturer-recent-classes__hint">
            Hiển thị tối đa 3 lớp được thêm gần nhất trong học kỳ này.
          </p>

          {recentClassesLoading && (
            <div className="admin-import-state" role="status">
              <LoaderCircle className="auth-spin" aria-hidden="true" />
              Đang tải danh sách lớp...
            </div>
          )}

          {recentClassesError && (
            <div className="catalog-validation-error" role="alert">{recentClassesError}</div>
          )}

          {!recentClassesLoading && !recentClassesError && recentClasses.length === 0 && (
            <div className="lecturer-recent-classes__empty">
              Giảng viên này chưa được phân công lớp nào trong học kỳ đang chọn.
            </div>
          )}

          {recentClasses.length > 0 && (
            <div className="admin-import-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Mã học phần</th>
                    <th>Học phần</th>
                    <th>Nhóm lớp</th>
                    <th>Sĩ số</th>
                  </tr>
                </thead>
                <tbody>
                  {recentClasses.map((section) => (
                    <tr key={section.courseSectionId}>
                      <td><strong>{section.courseCode}</strong></td>
                      <td>{section.courseName}</td>
                      <td>{section.sectionName}</td>
                      <td>{section.classSize}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="modal-footer catalog-form-actions">
            <button type="button" className="btn btn-primary" onClick={closeRecentClasses}>Đóng</button>
          </div>
        </div>
      </Modal>

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
          <div className="form-group">
            <label htmlFor="lecturer-position">Chức vụ</label>
            <select
              id="lecturer-position"
              value={form.positionId}
              onChange={(event) => updateForm({ positionId: event.target.value })}
            >
              <option value="">Chưa phân công</option>
              {positions.map((position) => (
                <option key={position.positionId} value={String(position.positionId)}>
                  {position.positionName}
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

      <Modal
        isOpen={isPositionsOpen}
        onClose={() => {
          if (positionSaving) return;
          setIsPositionsOpen(false);
          setPositionError(null);
        }}
        title="Chức vụ"
      >
        <div className="answer-scale-manager">
          {positionError && (
            <div className="catalog-validation-error" role="alert">{positionError}</div>
          )}

          <section className="answer-scale-list" aria-label="Danh sách chức vụ">
            {positions.length === 0 && (
              <p className="answer-scale-empty">Chưa có chức vụ nào.</p>
            )}
            {positions.map((position) => (
              <div className="answer-scale-row" key={position.positionId}>
                <div className="answer-scale-row-body">
                  <strong>{position.positionName}</strong>
                </div>
                {deletingPositionId === position.positionId ? (
                  <div className="answer-scale-confirm">
                    <span>Xóa chức vụ này?</span>
                    <button
                      type="button"
                      className="btn catalog-danger-button btn-sm"
                      onClick={() => void handleDeletePosition(position.positionId)}
                    >
                      Xóa
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setDeletingPositionId(null)}
                    >
                      Hủy
                    </button>
                  </div>
                ) : (
                  <div className="catalog-actions">
                    <button
                      type="button"
                      className="catalog-icon-button"
                      onClick={() => openPositionEdit(position)}
                      aria-label={`Sửa chức vụ ${position.positionName}`}
                      title="Sửa"
                    >
                      <Pencil aria-hidden="true" size={15} />
                    </button>
                    <button
                      type="button"
                      className="catalog-icon-button catalog-icon-button--danger"
                      onClick={() => setDeletingPositionId(position.positionId)}
                      aria-label={`Xóa chức vụ ${position.positionName}`}
                      title="Xóa"
                    >
                      <Trash2 aria-hidden="true" size={15} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </section>

          <form className="catalog-form" onSubmit={(event) => void handleSavePosition(event)}>
            <div className="form-group">
              <label htmlFor="position-name">
                {positionForm.positionId === null ? 'Tên chức vụ mới' : 'Tên chức vụ'}
              </label>
              <input
                id="position-name"
                type="text"
                placeholder="VD: Giảng viên chính"
                value={positionForm.positionName}
                onChange={(event) =>
                  setPositionForm((prev) => ({ ...prev, positionName: event.target.value }))
                }
                required
              />
            </div>

            <div className="modal-footer catalog-form-actions">
              {positionForm.positionId !== null && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={openPositionCreate}
                  disabled={positionSaving}
                >
                  Thêm chức vụ mới
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={positionSaving}>
                {positionSaving ? (
                  <LoaderCircle className="auth-spin" aria-hidden="true" size={16} />
                ) : (
                  <Save aria-hidden="true" size={16} />
                )}
                {positionForm.positionId === null ? 'Thêm chức vụ' : 'Lưu chức vụ'}
              </button>
            </div>
          </form>
        </div>
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
