import React, { useEffect, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Layers,
  MailPlus,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { ConfirmDialog, Modal } from '../components/Modal';
import { CourseSectionImportDialog } from '../components/CourseSectionImportDialog';
import type { ImportCourseSectionRow } from '../utils/courseSectionImportExcel';
import { downloadUnidentifiedLecturerFile } from '../utils/courseSectionImportExcel';
import { ApiError } from '../services/apiClient';
import {
  catalogApi,
  catalogErrorMessage,
  type SaveAcademicYearPayload,
  type UnidentifiedLecturerReport,
} from '../services/catalogApi';
import type {
  AcademicYear,
  Course,
  CourseSection,
  Department,
  Faculty,
  Lecturer,
  Semester,
} from '../types';
import { useSemester } from '../context/semesterContext';
import { useAuth } from '../auth/authContext';
import { isReadOnlyRole, isUnrestrictedRole } from '../auth/roles';

interface ClassesPageProps {
  courses: Course[];
  lecturers: Lecturer[];
  /** Cho hộp thoại bổ sung thông tin giảng viên chưa xác định. */
  departments: Department[];
  faculties: Faculty[];
  /**
   * Gọi sau khi import lớp học phần, vì bước đó có thể tạo thêm học phần và
   * giảng viên mà hai danh mục ở App chưa biết.
   */
  onCatalogChanged: () => Promise<void>;
}

interface YearForm {
  academicYearName: string;
  startDate: string;
  endDate: string;
}

interface SectionForm {
  courseId: string;
  lecturerId: string;
  sectionName: string;
  classSize: string;
}

const emptyYearForm: YearForm = {
  academicYearName: '',
  startDate: '',
  endDate: '',
};

const emptySectionForm: SectionForm = {
  courseId: '',
  lecturerId: '',
  sectionName: '',
  classSize: '40',
};

/** Hộp thoại "Cập nhật giảng viên" của lớp chưa xác định. */
interface ResolveLecturerForm {
  fullName: string;
  email: string;
  departmentId: string;
  facultyId: string;
}

const errorCodeOf = (error: unknown): string =>
  error instanceof ApiError ? error.errorCode : 'API_REQUEST_FAILED';

export const ClassesPage: React.FC<ClassesPageProps> = ({
  courses,
  lecturers,
  departments,
  faculties,
  onCatalogChanged,
}) => {
  const {
    academicYears,
    activeSemesterId,
    reloadAcademicYears,
  } = useSemester();
  const [loadError] = useState<string | null>(null);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(() => activeSemesterId);
  const [expandedYearIds, setExpandedYearIds] = useState<number[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);

  const [sections, setSections] = useState<CourseSection[]>([]);
  const [search, setSearch] = useState('');
  const [isImportOpen, setIsImportOpen] = useState(false);

  const [isYearModalOpen, setIsYearModalOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [yearToDelete, setYearToDelete] = useState<AcademicYear | null>(null);
  const [yearForm, setYearForm] = useState<YearForm>(emptyYearForm);
  const [yearError, setYearError] = useState('');
  const [savingYear, setSavingYear] = useState(false);

  const [isSemesterModalOpen, setIsSemesterModalOpen] = useState(false);
  const [editingSemester, setEditingSemester] = useState<Semester | null>(null);
  const [semesterToDelete, setSemesterToDelete] = useState<Semester | null>(null);
  const [semesterName, setSemesterName] = useState('');
  const [semesterError, setSemesterError] = useState('');
  const [savingSemester, setSavingSemester] = useState(false);

  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<CourseSection | null>(null);
  const [sectionToDelete, setSectionToDelete] = useState<CourseSection | null>(null);
  const [sectionForm, setSectionForm] = useState<SectionForm>(emptySectionForm);
  const [sectionError, setSectionError] = useState('');
  const [savingSection, setSavingSection] = useState(false);

  // Lớp đang được bổ sung thông tin giảng viên. Chỉ lớp chưa xác định mới vào đây.
  const [resolvingSection, setResolvingSection] = useState<CourseSection | null>(null);
  const [resolveForm, setResolveForm] = useState<ResolveLecturerForm>({
    fullName: '',
    email: '',
    departmentId: '',
    facultyId: '',
  });
  const [resolveError, setResolveError] = useState('');
  const [savingResolve, setSavingResolve] = useState(false);

  // Khi học kỳ làm việc toàn cục (Header) thay đổi, đồng bộ sang trang lớp học phần
  useEffect(() => {
    if (activeSemesterId !== null) {
      setSelectedSemesterId(activeSemesterId);
    }
  }, [activeSemesterId]);

  // Tự động mở nhánh và chọn năm học tương ứng với học kỳ đang xem
  useEffect(() => {
    if (selectedSemesterId !== null && academicYears.length > 0) {
      const year = academicYears.find((y) =>
        y.semesters.some((s) => s.semesterId === selectedSemesterId)
      );
      if (year) {
        setSelectedYearId(year.academicYearId);
        setExpandedYearIds((prev) =>
          prev.includes(year.academicYearId) ? prev : [...prev, year.academicYearId]
        );
      }
    }
  }, [selectedSemesterId, academicYears]);

  const selectedYear = academicYears.find((year) => year.academicYearId === selectedYearId) ?? null;
  const selectedSemester =
    academicYears
      .flatMap((year) => year.semesters)
      .find((semester) => semester.semesterId === selectedSemesterId) ?? null;

  const courseOf = (courseId: number) => courses.find((course) => course.courseId === courseId);
  const lecturerOf = (lecturerId: number) =>
    lecturers.find((lecturer) => lecturer.lecturerId === lecturerId);

  // Import lấy bộ môn từ tệp nên chỉ quản trị mới được dùng; ẩn nút cho gọn.
  const { activeProfile } = useAuth();
  const canManageAll = isUnrestrictedRole(activeProfile?.roleCode);
  // Giảng viên chỉ theo dõi lớp mình dạy, không sửa gì trên trang này.
  const readOnly = isReadOnlyRole(activeProfile?.roleCode);

  // ----- Giảng viên chưa xác định -------------------------------------------
  // Backend đã lọc sẵn theo phạm vi, nên trưởng bộ môn chỉ thấy bộ môn mình mà
  // trang này không phải biết gì về chuyện phân quyền.
  const [unidentified, setUnidentified] = useState<UnidentifiedLecturerReport | null>(null);
  const [showOnlyUnidentified, setShowOnlyUnidentified] = useState(false);
  const [isUnidentifiedOpen, setIsUnidentifiedOpen] = useState(false);
  const [downloadingUnidentified, setDownloadingUnidentified] = useState(false);

  useEffect(() => {
    if (selectedSemesterId === null) {
      setUnidentified(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const report = await catalogApi.unidentifiedLecturers(selectedSemesterId);
        if (!cancelled) setUnidentified(report);
      } catch {
        // Không chặn cả trang chỉ vì băng cảnh báo không nạp được.
        if (!cancelled) setUnidentified(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // sections đổi thì gán giảng viên xong con số phải giảm theo.
  }, [selectedSemesterId, sections]);

  const handleDownloadUnidentified = async () => {
    if (!unidentified || unidentified.sections.length === 0) return;
    setDownloadingUnidentified(true);
    try {
      await downloadUnidentifiedLecturerFile(
        unidentified.sections.map((section) => ({
          fullName: section.lecturerName,
          departmentId: section.departmentId,
          departmentName: section.departmentName,
          facultyName: section.facultyName,
          courseCode: section.courseCode,
          courseName: section.courseName,
          sectionName: section.sectionName,
          credits: section.credits,
          classSize: section.classSize,
        })),
      );
    } catch {
      toast.error('Không tạo được tệp giảng viên thiếu email. Hãy thử lại.');
    } finally {
      setDownloadingUnidentified(false);
    }
  };

  // ----- Nạp dữ liệu --------------------------------------------------------

  const reloadYears = async (): Promise<AcademicYear[]> => {
    const next = await reloadAcademicYears();
    return next;
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (selectedSemesterId === null) {
        setSections([]);
        return;
      }
      try {
        const next = await catalogApi.courseSections(selectedSemesterId);
        if (!cancelled) setSections(next);
      } catch {
        if (!cancelled) {
          setSections([]);
          toast.error('Không thể tải danh sách lớp học phần');
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedSemesterId]);

  const reloadSections = async () => {
    if (selectedSemesterId === null) return;
    setSections(await catalogApi.courseSections(selectedSemesterId));
  };

  // ----- Năm học ------------------------------------------------------------

  const toggleYear = (academicYearId: number) => {
    setExpandedYearIds((current) =>
      current.includes(academicYearId)
        ? current.filter((id) => id !== academicYearId)
        : [...current, academicYearId]
    );
    setSelectedYearId(academicYearId);
  };

  const openCreateYear = () => {
    setEditingYear(null);
    setYearForm(emptyYearForm);
    setYearError('');
    setIsYearModalOpen(true);
  };

  const openEditYear = (year: AcademicYear) => {
    setEditingYear(year);
    setYearForm({
      academicYearName: year.academicYearName,
      startDate: year.startDate,
      endDate: year.endDate,
    });
    setYearError('');
    setIsYearModalOpen(true);
  };

  const handleYearSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = yearForm.academicYearName.trim();

    if (!name || !yearForm.startDate || !yearForm.endDate) {
      setYearError('Vui lòng nhập tên năm học và khoảng thời gian.');
      return;
    }

    const payload: SaveAcademicYearPayload = {
      academicYearName: name,
      startDate: yearForm.startDate,
      endDate: yearForm.endDate,
    };

    setSavingYear(true);
    try {
      if (editingYear) {
        await catalogApi.updateAcademicYear(editingYear.academicYearId, payload);
        await reloadYears();
        toast.success('Đã cập nhật năm học', { description: name });
      } else {
        const created = await catalogApi.createAcademicYear(payload);
        await reloadYears();
        setExpandedYearIds((current) => [...current, created.academicYearId]);
        setSelectedYearId(created.academicYearId);
        toast.success('Đã thêm năm học', {
          description: `${name} · tự tạo ${created.semesters.length} học kỳ`,
        });
      }
      setIsYearModalOpen(false);
      setEditingYear(null);
      setYearForm(emptyYearForm);
      setYearError('');
    } catch (error) {
      setYearError(catalogErrorMessage(errorCodeOf(error)));
    } finally {
      setSavingYear(false);
    }
  };

  const handleYearDelete = async () => {
    if (!yearToDelete) return;
    try {
      await catalogApi.deleteAcademicYear(yearToDelete.academicYearId);
      const next = await reloadYears();
      if (selectedYearId === yearToDelete.academicYearId) {
        setSelectedYearId(null);
        setSelectedSemesterId(null);
      }
      if (next.length === 0) setSelectedSemesterId(null);
      toast.success('Đã xóa năm học', { description: yearToDelete.academicYearName });
    } catch (error) {
      toast.error('Không thể xóa năm học', {
        description: catalogErrorMessage(errorCodeOf(error)),
      });
    }
    setYearToDelete(null);
  };

  // ----- Học kỳ -------------------------------------------------------------

  const openCreateSemester = () => {
    setEditingSemester(null);
    setSemesterName('');
    setSemesterError('');
    setIsSemesterModalOpen(true);
  };

  const openEditSemester = (semester: Semester) => {
    setEditingSemester(semester);
    setSemesterName(semester.semesterName);
    setSemesterError('');
    setIsSemesterModalOpen(true);
  };

  const handleSemesterSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = semesterName.trim();
    const academicYearId = editingSemester?.academicYearId ?? selectedYearId;

    if (!name) {
      setSemesterError('Vui lòng nhập tên học kỳ.');
      return;
    }
    if (academicYearId === null) {
      setSemesterError('Hãy chọn một năm học trước.');
      return;
    }

    setSavingSemester(true);
    try {
      if (editingSemester) {
        await catalogApi.updateSemester(editingSemester.semesterId, name, academicYearId);
      } else {
        await catalogApi.createSemester(name, academicYearId);
      }
      await reloadYears();
      setExpandedYearIds((current) =>
        current.includes(academicYearId) ? current : [...current, academicYearId]
      );
      toast.success(editingSemester ? 'Đã cập nhật học kỳ' : 'Đã thêm học kỳ', {
        description: name,
      });
      setIsSemesterModalOpen(false);
      setEditingSemester(null);
      setSemesterName('');
      setSemesterError('');
    } catch (error) {
      setSemesterError(catalogErrorMessage(errorCodeOf(error)));
    } finally {
      setSavingSemester(false);
    }
  };

  const handleSemesterDelete = async () => {
    if (!semesterToDelete) return;
    try {
      await catalogApi.deleteSemester(semesterToDelete.semesterId);
      await reloadYears();
      if (selectedSemesterId === semesterToDelete.semesterId) setSelectedSemesterId(null);
      toast.success('Đã xóa học kỳ', { description: semesterToDelete.semesterName });
    } catch (error) {
      toast.error('Không thể xóa học kỳ', {
        description: catalogErrorMessage(errorCodeOf(error)),
      });
    }
    setSemesterToDelete(null);
  };

  // ----- Lớp học phần -------------------------------------------------------

  const openCreateSection = () => {
    setEditingSection(null);
    setSectionForm(emptySectionForm);
    setSectionError('');
    setIsSectionModalOpen(true);
  };

  const openEditSection = (section: CourseSection) => {
    setEditingSection(section);
    setSectionForm({
      courseId: String(section.courseId),
      lecturerId: section.lecturerId === null ? '' : String(section.lecturerId),
      sectionName: section.sectionName,
      classSize: String(section.classSize),
    });
    setSectionError('');
    setIsSectionModalOpen(true);
  };

  const handleSectionSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const sectionName = sectionForm.sectionName.trim();
    const classSize = Number(sectionForm.classSize);

    if (selectedSemesterId === null) {
      setSectionError('Hãy chọn một học kỳ trước.');
      return;
    }
    if (!sectionForm.courseId || !sectionName) {
      setSectionError('Vui lòng chọn học phần và nhập tên lớp.');
      return;
    }
    if (!Number.isFinite(classSize) || classSize < 0) {
      setSectionError('Sĩ số không hợp lệ.');
      return;
    }

    // Để trống giảng viên là hợp lệ: lớp import từ tệp thiếu email vẫn phải sửa được.
    // Chọn được giảng viên thì tên chưa xác định bị xoá đi.
    const lecturerId = sectionForm.lecturerId ? Number(sectionForm.lecturerId) : null;
    const payload = {
      courseId: Number(sectionForm.courseId),
      semesterId: selectedSemesterId,
      lecturerId,
      sectionName,
      classSize,
      unidentifiedLecturerName:
        lecturerId === null ? (editingSection?.unidentifiedLecturerName ?? null) : null,
    };

    setSavingSection(true);
    try {
      if (editingSection) {
        await catalogApi.updateCourseSection(editingSection.courseSectionId, payload);
      } else {
        await catalogApi.createCourseSection(payload);
      }
      await reloadSections();
      toast.success(editingSection ? 'Đã cập nhật lớp học phần' : 'Đã thêm lớp học phần', {
        description: sectionName,
      });
      setIsSectionModalOpen(false);
      setEditingSection(null);
      setSectionForm(emptySectionForm);
      setSectionError('');
    } catch (error) {
      setSectionError(catalogErrorMessage(errorCodeOf(error)));
    } finally {
      setSavingSection(false);
    }
  };

  const handleSectionDelete = async () => {
    if (!sectionToDelete) return;
    try {
      await catalogApi.deleteCourseSection(sectionToDelete.courseSectionId);
      await reloadSections();
      toast.success('Đã xóa lớp học phần', { description: sectionToDelete.sectionName });
    } catch (error) {
      toast.error('Không thể xóa lớp học phần', {
        description: catalogErrorMessage(errorCodeOf(error)),
      });
    }
    setSectionToDelete(null);
  };

  // ----- Bổ sung giảng viên cho lớp chưa xác định ----------------------------
  // Điền sẵn theo học phần sở hữu lớp: tệp import cũng lấy bộ môn và khoa viện từ
  // chính dòng đó, nên mặc định này khớp với đường import lại.

  const openResolveSection = (section: CourseSection) => {
    const course = courseOf(section.courseId);
    setResolvingSection(section);
    setResolveForm({
      fullName: section.unidentifiedLecturerName ?? '',
      email: '',
      departmentId: course?.departmentId == null ? '' : String(course.departmentId),
      facultyId: course?.facultyId == null ? '' : String(course.facultyId),
    });
    setResolveError('');
  };

  const handleResolveSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resolvingSection) return;

    const fullName = resolveForm.fullName.trim();
    const email = resolveForm.email.trim();
    if (!fullName) {
      setResolveError('Vui lòng nhập họ và tên giảng viên.');
      return;
    }
    if (!email) {
      setResolveError('Vui lòng nhập email giảng viên.');
      return;
    }

    setSavingResolve(true);
    try {
      const result = await catalogApi.resolveUnidentifiedLecturer(resolvingSection.courseSectionId, {
        fullName,
        email,
        departmentId: resolveForm.departmentId ? Number(resolveForm.departmentId) : null,
        facultyId: resolveForm.facultyId ? Number(resolveForm.facultyId) : null,
      });
      // Danh mục giảng viên có thể vừa có thêm người, nạp trước rồi mới vẽ lại bảng.
      await onCatalogChanged();
      await reloadSections();
      toast.success('Đã cập nhật giảng viên', {
        description: `${fullName} · lớp ${resolvingSection.sectionName}${
          result.lecturerCreated ? ' · đã tạo hồ sơ giảng viên mới' : ''
        }`,
      });
      setResolvingSection(null);
      setResolveError('');
    } catch (error) {
      setResolveError(catalogErrorMessage(errorCodeOf(error)));
    } finally {
      setSavingResolve(false);
    }
  };

  const handleImportSections = async (rows: ImportCourseSectionRow[]) => {
    if (selectedSemesterId === null) {
      throw new ApiError(400, 'CATALOG_SEMESTER_NOT_FOUND');
    }
    const result = await catalogApi.importCourseSections(selectedSemesterId, rows);
    // Nạp học phần và giảng viên TRƯỚC, vì import vừa rồi có thể đã tự tạo thêm.
    // Nạp lớp học phần trước thì bảng vẽ ra khi hai danh mục kia còn thiếu,
    // cột Học phần và Giảng viên sẽ tra không ra tên.
    await onCatalogChanged();
    await reloadSections();
    if (result.createdCount > 0) {
      toast.success(`Đã import ${result.createdCount} lớp học phần`, {
        description: result.skippedCount > 0 ? `${result.skippedCount} dòng bị bỏ qua` : undefined,
      });
    } else {
      toast.error('Không có dòng nào được thêm', {
        description: `${result.skippedCount} dòng bị bỏ qua`,
      });
    }
    return result;
  };

  // ----- Bảng lớp học phần --------------------------------------------------

  const normalized = search.trim().toLowerCase();
  const filteredSections = sections
    .filter((section) => !showOnlyUnidentified || section.lecturerId === null)
    .filter((section) => {
      if (!normalized) return true;
      const course = courseOf(section.courseId);
      return (
        section.sectionName.toLowerCase().includes(normalized) ||
        (course?.courseName ?? '').toLowerCase().includes(normalized) ||
        (course?.courseCode ?? '').toLowerCase().includes(normalized)
      );
    })
    // Lớp chưa xác định giảng viên nằm đầu danh sách để dễ nhặt ra mà bổ sung
    // email. Sort ổn định nên các lớp còn lại giữ nguyên thứ tự cũ.
    .sort((left, right) =>
      Number(left.lecturerId !== null) - Number(right.lecturerId !== null));

  const columns: Column<CourseSection>[] = [
    {
      key: 'courseId',
      header: 'Học phần',
      width: '260px',
      filterValue: (item) => courseOf(item.courseId)?.courseName ?? '—',
      render: (item) => {
        const course = courseOf(item.courseId);
        return (
          <div>
            <div className="catalog-cell-primary">{course?.courseName ?? '—'}</div>
            <div className="catalog-cell-meta">{course?.courseCode ?? '—'}</div>
          </div>
        );
      },
    },
    {
      key: 'sectionName',
      header: 'Tên lớp',
      width: '160px',
      filterValue: (item) => item.sectionName,
      render: (item) => <span className="catalog-cell-primary">{item.sectionName}</span>,
    },
    {
      key: 'classSize',
      header: 'Sĩ số',
      width: '90px',
      filterValue: (item) => String(item.classSize),
      numeric: true,
      render: (item) => item.classSize,
    },
    {
      key: 'lecturerId',
      header: 'Giảng viên',
      width: '260px',
      // Lọc gộp cả giảng viên có mã lẫn tên chưa xác định, để admin lọc riêng
      // ra các lớp còn thiếu email.
      filterValue: (item) =>
        item.lecturerId === null
          ? `⚠ ${item.unidentifiedLecturerName || 'Chưa có giảng viên'}`
          : (lecturerOf(item.lecturerId)?.fullName ?? '—'),
      render: (item) => {
        // Lớp chưa xác định được giảng viên: hiện tên đọc từ tệp import kèm
        // cảnh báo để quản trị hoặc trưởng bộ môn biết cần bổ sung email.
        if (item.lecturerId === null) {
          return (
            <div className="catalog-cell-unidentified">
              <div className="catalog-cell-primary">
                <TriangleAlert aria-hidden="true" size={14} />
                {item.unidentifiedLecturerName || 'Chưa có giảng viên'}
              </div>
              <div className="catalog-cell-meta">Chưa xác định — thiếu email</div>
            </div>
          );
        }

        const lecturer = lecturerOf(item.lecturerId);
        return (
          <div>
            <div className="catalog-cell-primary">{lecturer?.fullName ?? '—'}</div>
            <div className="catalog-cell-meta">{lecturer?.email ?? '—'}</div>
          </div>
        );
      },
    },
  ];

  // Bỏ hẳn cả cột chứ không ẩn từng nút: ẩn hết nút thì còn lại một cột trống 92px.
  if (!readOnly) {
    columns.push({
      key: 'actions',
      header: 'Hành động',
      width: '128px',
      render: (item) => (
        <div className="catalog-actions">
          {/* Chỉ lớp còn treo mới có nút này. Nó chỉ sửa đúng lớp đó, vì hai lớp
              treo cùng một tên vẫn có thể là hai người khác nhau. */}
          {item.lecturerId === null && (
            <button
              type="button"
              className="catalog-icon-button catalog-icon-button--accent"
              onClick={() => openResolveSection(item)}
              aria-label={`Cập nhật giảng viên lớp ${item.sectionName}`}
              title="Cập nhật giảng viên"
            >
              <MailPlus aria-hidden="true" size={15} />
            </button>
          )}
          <button
            type="button"
            className="catalog-icon-button"
            onClick={() => openEditSection(item)}
            aria-label={`Sửa lớp ${item.sectionName}`}
            title="Sửa"
          >
            <Pencil aria-hidden="true" size={15} />
          </button>
          <button
            type="button"
            className="catalog-icon-button catalog-icon-button--danger"
            onClick={() => setSectionToDelete(item)}
            aria-label={`Xóa lớp ${item.sectionName}`}
            title="Xóa"
          >
            <Trash2 aria-hidden="true" size={15} />
          </button>
        </div>
      ),
    });
  }

  const semesterCount = selectedYear?.semesters.length ?? 0;

  return (
    <div className="catalog-page term-page">
      <div className="term-layout">
        {/* Cột trái: cây năm học -> học kỳ */}
        <aside className="term-tree" aria-label="Năm học và học kỳ">
          <header className="term-tree__header">
            <span className="term-tree__title">
              <CalendarDays aria-hidden="true" size={16} />
              Năm học
            </span>
            {/* Năm học và học kỳ là khung dùng chung cho cả trường, chỉ quản trị mới
                được sửa — backend cũng từ chối, xem congviec3.md mục H4. */}
            {canManageAll && (
              <button
                type="button"
                className="term-tree__add"
                onClick={openCreateYear}
                aria-label="Thêm năm học"
                title="Thêm năm học"
              >
                <Plus aria-hidden="true" size={16} />
              </button>
            )}
          </header>

          {loadError && <p className="term-tree__error">{loadError}</p>}

          {academicYears.length === 0 ? (
            <p className="term-tree__empty">Chưa có năm học nào</p>
          ) : (
            <ul className="term-tree__list">
              {academicYears.map((year) => {
                const isExpanded = expandedYearIds.includes(year.academicYearId);
                return (
                  <li key={year.academicYearId}>
                    <div
                      className={`term-tree__year ${
                        selectedYearId === year.academicYearId ? 'is-selected' : ''
                      }`}
                    >
                      <button
                        type="button"
                        className="term-tree__year-button"
                        onClick={() => toggleYear(year.academicYearId)}
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? (
                          <ChevronDown aria-hidden="true" size={14} />
                        ) : (
                          <ChevronRight aria-hidden="true" size={14} />
                        )}
                        <span className="term-tree__year-name">{year.academicYearName}</span>
                        <span className="term-tree__count">{year.semesters.length}</span>
                      </button>
                      {canManageAll && (
                        <span className="term-tree__row-actions">
                          <button
                            type="button"
                            className="catalog-icon-button catalog-icon-button--sm"
                            onClick={() => openEditYear(year)}
                            aria-label={`Sửa ${year.academicYearName}`}
                            title="Sửa năm học"
                          >
                            <Pencil aria-hidden="true" size={13} />
                          </button>
                          <button
                            type="button"
                            className="catalog-icon-button catalog-icon-button--sm catalog-icon-button--danger"
                            onClick={() => setYearToDelete(year)}
                            aria-label={`Xóa ${year.academicYearName}`}
                            title="Xóa năm học"
                          >
                            <Trash2 aria-hidden="true" size={13} />
                          </button>
                        </span>
                      )}
                    </div>

                    {isExpanded && (
                      <ul className="term-tree__semesters">
                        {year.semesters.length === 0 ? (
                          <li className="term-tree__empty term-tree__empty--nested">
                            Chưa có học kỳ
                          </li>
                        ) : (
                          year.semesters.map((semester) => (
                            <li key={semester.semesterId}>
                              <div
                                className={`term-tree__semester ${
                                  selectedSemesterId === semester.semesterId ? 'is-selected' : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  className="term-tree__semester-button"
                                  onClick={() => {
                                    setSelectedYearId(year.academicYearId);
                                    setSelectedSemesterId(semester.semesterId);
                                  }}
                                >
                                  <Layers aria-hidden="true" size={13} />
                                  {semester.semesterName}
                                </button>
                                {canManageAll && (
                                  <span className="term-tree__row-actions">
                                    <button
                                      type="button"
                                      className="catalog-icon-button catalog-icon-button--sm"
                                      onClick={() => openEditSemester(semester)}
                                      aria-label={`Sửa ${semester.semesterName}`}
                                      title="Sửa học kỳ"
                                    >
                                      <Pencil aria-hidden="true" size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      className="catalog-icon-button catalog-icon-button--sm catalog-icon-button--danger"
                                      onClick={() => setSemesterToDelete(semester)}
                                      aria-label={`Xóa ${semester.semesterName}`}
                                      title="Xóa học kỳ"
                                    >
                                      <Trash2 aria-hidden="true" size={12} />
                                    </button>
                                  </span>
                                )}
                              </div>
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Cột phải */}
        <section className="term-detail" aria-label="Nội dung học kỳ">
          <header className="term-detail__header">
            <span className="term-detail__title">
              <Layers aria-hidden="true" size={16} />
              {selectedSemester ? (
                <>
                  Lớp học phần
                  <span className="term-detail__badge">{sections.length} lớp</span>
                  <span className="term-detail__context">
                    {selectedSemester.semesterName} · {selectedYear?.academicYearName}
                  </span>
                </>
              ) : (
                <>
                  Học kỳ
                  <span className="term-detail__badge">{semesterCount} học kỳ</span>
                </>
              )}
            </span>

            {/* Khi đã chọn học kỳ, nút thêm nằm trên thanh công cụ của bảng. */}
            {!selectedSemester && canManageAll && (
              <button
                type="button"
                className="btn btn-primary btn-sm catalog-add-button"
                onClick={openCreateSemester}
                disabled={selectedYearId === null}
              >
                <Plus aria-hidden="true" size={16} />
                <span>Thêm học kỳ</span>
              </button>
            )}
          </header>

          {selectedSemester && unidentified !== null && unidentified.sectionCount > 0 && (
            <div className="unidentified-banner" role="status">
              <TriangleAlert aria-hidden="true" size={18} />
              <div className="unidentified-banner__text">
                <strong>
                  {unidentified.sectionCount} lớp chưa xác định giảng viên
                  {unidentified.lecturerCount > 0 && `, thuộc ${unidentified.lecturerCount} người`}
                </strong>
                <span>
                  Bấm nút <strong>Cập nhật giảng viên</strong> ở cột Hành động để điền email, bộ
                  môn và khoa viện cho từng lớp. Muốn xử lý cả loạt thì tải tệp Excel dưới đây,
                  điền cột Email rồi import lại.
                </span>
              </div>
              <div className="unidentified-banner__actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  aria-pressed={showOnlyUnidentified}
                  onClick={() => setShowOnlyUnidentified((current) => !current)}
                >
                  {showOnlyUnidentified ? 'Hiện tất cả lớp' : 'Chỉ hiện lớp chưa xác định'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsUnidentifiedOpen(true)}
                >
                  Xem theo giảng viên
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => void handleDownloadUnidentified()}
                  disabled={downloadingUnidentified}
                >
                  <FileSpreadsheet aria-hidden="true" size={16} />
                  <span>{downloadingUnidentified ? 'Đang tạo tệp...' : 'Tải Excel'}</span>
                </button>
              </div>
            </div>
          )}

          {selectedSemester ? (
            <DataTable
              columns={columns}
              data={filteredSections}
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Tìm tên lớp hoặc học phần..."
              onAddNew={readOnly ? undefined : openCreateSection}
              addNewLabel="Thêm lớp học phần"
              toolbarActions={canManageAll ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm catalog-add-button"
                  onClick={() => setIsImportOpen(true)}
                >
                  <FileSpreadsheet aria-hidden="true" size={16} />
                  <span>Import Excel</span>
                </button>
              ) : undefined}
              emptyMessage="Học kỳ này chưa có lớp học phần nào."
              keyExtractor={(item) => String(item.courseSectionId)}
              pageSize={20}
            />
          ) : selectedYear ? (
            <div className="term-detail__semesters">
              {selectedYear.semesters.length === 0 ? (
                <p className="term-detail__hint">Năm học này chưa có học kỳ nào.</p>
              ) : (
                selectedYear.semesters.map((semester) => (
                  <button
                    type="button"
                    key={semester.semesterId}
                    className="term-detail__semester-card"
                    onClick={() => setSelectedSemesterId(semester.semesterId)}
                  >
                    <Layers aria-hidden="true" size={15} />
                    <span>{semester.semesterName}</span>
                  </button>
                ))
              )}
            </div>
          ) : (
            <p className="term-detail__hint">Chọn một năm học để xem học kỳ</p>
          )}
        </section>
      </div>

      {/* Modal năm học */}
      <Modal
        isOpen={isYearModalOpen}
        onClose={() => setIsYearModalOpen(false)}
        title={editingYear ? 'Sửa năm học' : 'Thêm năm học'}
      >
        <form className="catalog-form" onSubmit={(event) => void handleYearSubmit(event)}>
          {yearError && <div className="catalog-validation-error" role="alert">{yearError}</div>}
          <div className="form-group">
            <label htmlFor="year-name">Tên năm học</label>
            <input
              id="year-name"
              type="text"
              placeholder="VD: 2025-2026"
              value={yearForm.academicYearName}
              onChange={(event) =>
                setYearForm((prev) => ({ ...prev, academicYearName: event.target.value }))
              }
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="year-start">Ngày bắt đầu</label>
            <input
              id="year-start"
              type="date"
              value={yearForm.startDate}
              onChange={(event) =>
                setYearForm((prev) => ({ ...prev, startDate: event.target.value }))
              }
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="year-end">Ngày kết thúc</label>
            <input
              id="year-end"
              type="date"
              value={yearForm.endDate}
              onChange={(event) => setYearForm((prev) => ({ ...prev, endDate: event.target.value }))}
              required
            />
          </div>
          {!editingYear && (
            <div className="catalog-context-band">
              Sau khi lưu, hệ thống tự tạo ba học kỳ: Học kỳ phụ, Học kỳ 1, Học kỳ 2.
            </div>
          )}
          <div className="modal-footer catalog-form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setIsYearModalOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={savingYear}>
              {savingYear ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal học kỳ */}
      <Modal
        isOpen={isSemesterModalOpen}
        onClose={() => setIsSemesterModalOpen(false)}
        title={editingSemester ? 'Sửa học kỳ' : 'Thêm học kỳ'}
      >
        <form className="catalog-form" onSubmit={(event) => void handleSemesterSubmit(event)}>
          {semesterError && (
            <div className="catalog-validation-error" role="alert">{semesterError}</div>
          )}
          <div className="catalog-context-band">
            Năm học:{' '}
            <strong>
              {editingSemester
                ? academicYears.find((y) => y.academicYearId === editingSemester.academicYearId)
                    ?.academicYearName ?? '—'
                : selectedYear?.academicYearName ?? 'Chưa chọn'}
            </strong>
          </div>
          <div className="form-group">
            <label htmlFor="semester-name">Tên học kỳ</label>
            <input
              id="semester-name"
              type="text"
              placeholder="VD: Học kỳ 1"
              value={semesterName}
              onChange={(event) => setSemesterName(event.target.value)}
              required
            />
          </div>
          <div className="modal-footer catalog-form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsSemesterModalOpen(false)}
            >
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={savingSemester}>
              {savingSemester ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal lớp học phần */}
      <Modal
        isOpen={isSectionModalOpen}
        onClose={() => setIsSectionModalOpen(false)}
        title={editingSection ? 'Sửa lớp học phần' : 'Thêm lớp học phần'}
      >
        <form className="catalog-form" onSubmit={(event) => void handleSectionSubmit(event)}>
          {sectionError && (
            <div className="catalog-validation-error" role="alert">{sectionError}</div>
          )}
          <div className="catalog-context-band">
            Học kỳ: <strong>{selectedSemester?.semesterName ?? '—'}</strong> ·{' '}
            {selectedYear?.academicYearName ?? '—'}
          </div>
          {courses.length === 0 && (
            <div className="catalog-validation-error" role="alert">
              Chưa có học phần nào trong danh mục.
            </div>
          )}
          {lecturers.length === 0 && (
            <div className="catalog-validation-error" role="alert">
              Chưa có giảng viên nào trong danh mục.
            </div>
          )}

          <div className="form-group">
            <label htmlFor="section-course">Học phần</label>
            <select
              id="section-course"
              value={sectionForm.courseId}
              onChange={(event) =>
                setSectionForm((prev) => ({ ...prev, courseId: event.target.value }))
              }
              required
            >
              <option value="">Chọn học phần</option>
              {courses.map((course) => (
                <option key={course.courseId} value={String(course.courseId)}>
                  [{course.courseCode}] {course.courseName}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="section-lecturer">Giảng viên</label>
            <select
              id="section-lecturer"
              value={sectionForm.lecturerId}
              onChange={(event) =>
                setSectionForm((prev) => ({ ...prev, lecturerId: event.target.value }))
              }
            >
              <option value="">Chưa xác định</option>
              {lecturers.map((lecturer) => (
                <option key={lecturer.lecturerId} value={String(lecturer.lecturerId)}>
                  {lecturer.fullName}
                  {lecturer.email ? ` · ${lecturer.email}` : ''}
                </option>
              ))}
            </select>
            {!sectionForm.lecturerId && editingSection?.unidentifiedLecturerName && (
              <small className="catalog-field-warning">
                <TriangleAlert aria-hidden="true" size={13} />
                Tên đọc từ tệp import: <strong>
                  {editingSection.unidentifiedLecturerName}
                </strong>. Chọn đúng giảng viên để gắn mã và xoá cảnh báo này.
              </small>
            )}
          </div>

          <div className="catalog-form-grid catalog-form-grid--2">
            <div className="form-group">
              <label htmlFor="section-name">Tên lớp</label>
              <input
                id="section-name"
                type="text"
                placeholder="IT201.01"
                value={sectionForm.sectionName}
                onChange={(event) =>
                  setSectionForm((prev) => ({ ...prev, sectionName: event.target.value }))
                }
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="section-size">Sĩ số</label>
              <input
                id="section-size"
                type="number"
                min="0"
                value={sectionForm.classSize}
                onChange={(event) =>
                  setSectionForm((prev) => ({ ...prev, classSize: event.target.value }))
                }
                required
              />
            </div>
          </div>

          <div className="modal-footer catalog-form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsSectionModalOpen(false)}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingSection || courses.length === 0 || lecturers.length === 0}
            >
              {savingSection ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bổ sung thông tin cho giảng viên chưa xác định. Lưu xong server chạy đúng
          nhánh của lần import lại: tra theo email, chưa có thì tạo giảng viên kèm
          tài khoản, rồi gắn mã cho mọi lớp cùng người đó trong học kỳ. */}
      <Modal
        isOpen={resolvingSection !== null}
        onClose={() => setResolvingSection(null)}
        title="Cập nhật giảng viên"
      >
        <form className="catalog-form" onSubmit={(event) => void handleResolveSubmit(event)}>
          {resolveError && (
            <div className="catalog-validation-error" role="alert">{resolveError}</div>
          )}
          <div className="catalog-context-band">
            Lớp: <strong>{resolvingSection?.sectionName ?? '—'}</strong> ·{' '}
            {resolvingSection ? courseOf(resolvingSection.courseId)?.courseName ?? '—' : '—'} ·{' '}
            {selectedSemester?.semesterName ?? '—'}
          </div>

          <div className="form-group">
            <label htmlFor="resolve-name">Họ và tên</label>
            <input
              id="resolve-name"
              type="text"
              value={resolveForm.fullName}
              onChange={(event) =>
                setResolveForm((prev) => ({ ...prev, fullName: event.target.value }))
              }
              required
            />
            <small className="catalog-field-hint">
              Tên đọc từ tệp import. Sửa lại nếu tệp ghi sai chính tả.
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="resolve-email">Email</label>
            <input
              id="resolve-email"
              type="email"
              placeholder="ten.giangvien@vimaru.edu.vn"
              value={resolveForm.email}
              onChange={(event) =>
                setResolveForm((prev) => ({ ...prev, email: event.target.value }))
              }
              required
            />
            <small className="catalog-field-hint">
              Email là khoá định danh giảng viên. Đã có người mang email này thì lớp được gắn
              vào chính người đó, không tạo hồ sơ trùng.
            </small>
          </div>

          <div className="catalog-form-grid catalog-form-grid--2">
            <div className="form-group">
              <label htmlFor="resolve-department">Bộ môn</label>
              <select
                id="resolve-department"
                value={resolveForm.departmentId}
                onChange={(event) =>
                  setResolveForm((prev) => ({ ...prev, departmentId: event.target.value }))
                }
              >
                <option value="">Chưa xác định</option>
                {departments.map((department) => (
                  <option key={department.departmentId} value={String(department.departmentId)}>
                    [{department.departmentId}] {department.departmentName}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="resolve-faculty">Khoa viện</label>
              <select
                id="resolve-faculty"
                value={resolveForm.facultyId}
                onChange={(event) =>
                  setResolveForm((prev) => ({ ...prev, facultyId: event.target.value }))
                }
              >
                <option value="">Chưa xác định</option>
                {faculties.map((faculty) => (
                  <option key={faculty.facultyId} value={String(faculty.facultyId)}>
                    {faculty.facultyName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="catalog-context-band">
            Lưu xong chỉ <strong>lớp {resolvingSection?.sectionName ?? '—'}</strong> được gắn mã
            giảng viên. Các lớp khác còn treo tên{' '}
            <strong>{resolvingSection?.unidentifiedLecturerName || '—'}</strong> giữ nguyên, vì có
            thể là người khác trùng tên — sửa từng lớp, hoặc import lại tệp Excel đã điền Email.
          </div>

          <div className="modal-footer catalog-form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setResolvingSection(null)}
            >
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={savingResolve}>
              {savingResolve ? 'Đang cập nhật...' : 'Cập nhật thông tin giảng viên'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Gom theo người thay vì theo lớp. Đây mới là danh sách cầm đi xin email:
          36 lớp thiếu của một bộ môn có khi chỉ do 6 người dạy. */}
      <Modal
        isOpen={isUnidentifiedOpen}
        onClose={() => setIsUnidentifiedOpen(false)}
        title="Giảng viên chưa xác định"
      >
        <div className="unidentified-dialog">
          <p className="unidentified-dialog__hint">
            {unidentified?.lecturerCount ?? 0} người, tổng {unidentified?.sectionCount ?? 0} lớp
            trong học kỳ <strong>{selectedSemester?.semesterName ?? '—'}</strong>. Xin email của
            từng người, rồi điền ngay bằng nút Cập nhật giảng viên ở cột Hành động của từng lớp —
            không phải sang trang Giảng viên nữa.
          </p>

          <div className="admin-import-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Họ và tên</th>
                  <th>Bộ môn</th>
                  <th>Số lớp</th>
                  <th>Các lớp</th>
                </tr>
              </thead>
              <tbody>
                {(unidentified?.lecturers ?? []).map((lecturer) => (
                  <tr key={`${lecturer.lecturerName}-${lecturer.departmentName ?? ''}`}>
                    <td><strong>{lecturer.lecturerName}</strong></td>
                    <td>{lecturer.departmentName ?? '—'}</td>
                    <td>{lecturer.sectionCount}</td>
                    <td>{lecturer.sectionLabels.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="modal-footer catalog-form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void handleDownloadUnidentified()}
              disabled={downloadingUnidentified}
            >
              <FileSpreadsheet aria-hidden="true" size={16} />
              <span>Tải Excel</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsUnidentifiedOpen(false)}
            >
              Đóng
            </button>
          </div>
        </div>
      </Modal>

      <CourseSectionImportDialog
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        semesterLabel={`${selectedSemester?.semesterName ?? ''} · ${
          selectedYear?.academicYearName ?? ''
        }`}
        onImport={handleImportSections}
      />

      <ConfirmDialog
        isOpen={yearToDelete !== null}
        onClose={() => setYearToDelete(null)}
        onConfirm={() => void handleYearDelete()}
        title="Xóa năm học?"
        recordName={yearToDelete?.academicYearName ?? ''}
        confirmText="Xóa"
        warning={
          yearToDelete && yearToDelete.semesters.length > 0
            ? `Xóa cùng: ${yearToDelete.semesters.length} học kỳ và toàn bộ lớp học phần thuộc các học kỳ đó.`
            : undefined
        }
      />

      <ConfirmDialog
        isOpen={semesterToDelete !== null}
        onClose={() => setSemesterToDelete(null)}
        onConfirm={() => void handleSemesterDelete()}
        title="Xóa học kỳ?"
        recordName={semesterToDelete?.semesterName ?? ''}
        confirmText="Xóa"
        warning="Xóa cùng: toàn bộ lớp học phần thuộc học kỳ này."
      />

      <ConfirmDialog
        isOpen={sectionToDelete !== null}
        onClose={() => setSectionToDelete(null)}
        onConfirm={() => void handleSectionDelete()}
        title="Xóa lớp học phần?"
        recordName={sectionToDelete?.sectionName ?? ''}
        confirmText="Xóa"
      />

    </div>
  );
};
