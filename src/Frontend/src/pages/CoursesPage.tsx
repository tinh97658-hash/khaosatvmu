import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { ConfirmDialog, Modal } from '../components/Modal';
import type { Course, Faculty } from '../types';

interface CoursesPageProps {
  courses: Course[];
  faculties: Faculty[];
  onAddCourse: (course: Course) => void;
  onDeleteCourse: (id: string) => void;
}

type CourseType = 'Bắt buộc' | 'Tự chọn';

export const CoursesPage: React.FC<CoursesPageProps> = ({
  courses,
  faculties,
  onAddCourse,
  onDeleteCourse,
}) => {
  const [search, setSearch] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [validationError, setValidationError] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [credits, setCredits] = useState('3');
  const [theoryHours, setTheoryHours] = useState('30');
  const [practicalHours, setPracticalHours] = useState('15');
  const [facultyId, setFacultyId] = useState(faculties[0]?.id || '');
  const [type, setType] = useState<CourseType>('Bắt buộc');
  const [description, setDescription] = useState('');

  const filtered = courses.filter((course) => {
    const matchesSearch =
      course.name.toLowerCase().includes(search.toLowerCase()) ||
      course.code.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (!facultyFilter || course.facultyId === facultyFilter);
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim() || !name.trim()) {
      setValidationError('Vui lòng nhập mã và tên học phần.');
      return;
    }

    const selectedFaculty = faculties.find((faculty) => faculty.id === facultyId);
    const newCourse: Course = {
      id: `crs-${Date.now()}`,
      code: code.trim(),
      name: name.trim(),
      credits: parseInt(credits) || 3,
      theoryHours: parseInt(theoryHours) || 30,
      practicalHours: parseInt(practicalHours) || 0,
      facultyId,
      facultyName: selectedFaculty?.name || 'Khoa Công nghệ Thông tin',
      type,
      description: description.trim(),
    };

    onAddCourse(newCourse);
    toast.success('Đã thêm học phần', { description: newCourse.name });
    setIsModalOpen(false);
    setValidationError('');
    setCode('');
    setName('');
    setDescription('');
  };

  const columns: Column<Course>[] = [
    {
      key: 'code',
      header: 'Mã học phần',
      width: '110px',
      render: (item) => <span className="catalog-code">{item.code}</span>,
    },
    {
      key: 'name',
      header: 'Tên học phần / môn học',
      render: (item) => (
        <div>
          <div className="catalog-cell-primary">{item.name}</div>
          {item.description && <div className="catalog-cell-meta catalog-cell-meta--clamp" title={item.description}>{item.description}</div>}
        </div>
      ),
    },
    {
      key: 'credits',
      header: 'Tín chỉ',
      width: '80px',
      render: (item) => <span className="catalog-cell-primary">{item.credits}</span>,
    },
    {
      key: 'hours',
      header: 'Giờ LT / TH',
      width: '115px',
      render: (item) => <span className="catalog-cell-primary">{item.theoryHours} / {item.practicalHours}</span>,
    },
    {
      key: 'facultyName',
      header: 'Khoa phụ trách',
    },
    {
      key: 'type',
      header: 'Loại học phần',
      width: '110px',
      render: (item) => (
        <span className={`catalog-status ${item.type === 'Bắt buộc' ? 'catalog-status--success' : 'catalog-status--warning'}`}>
          {item.type}
        </span>
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
            onClick={() => setCourseToDelete(item)}
            aria-label={`Xóa ${item.name}`}
            title="Xóa học phần"
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
          <h2>Danh mục học phần và môn học</h2>
          <p>Quản lý môn học toàn trường, tín chỉ, giờ lý thuyết và thực hành.</p>
        </div>
      </header>

      <DataTable
        columns={columns}
        data={filtered}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm tên hoặc mã học phần..."
        filterOptions={[
          { label: 'Tất cả khoa phụ trách', value: '' },
          ...faculties.map((faculty) => ({ label: faculty.name, value: faculty.id })),
        ]}
        currentFilter={facultyFilter}
        onFilterChange={setFacultyFilter}
        onAddNew={() => {
          setValidationError('');
          setIsModalOpen(true);
        }}
        addNewLabel="Thêm học phần"
        emptyMessage="Chưa có học phần nào trong danh mục."
        keyExtractor={(item) => item.id}
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Thêm học phần / môn học">
        <form className="catalog-form" onSubmit={handleSubmit}>
          {validationError && <div className="catalog-validation-error" role="alert">{validationError}</div>}
          <div className="catalog-form-grid catalog-form-grid--code-name">
            <div className="form-group">
              <label htmlFor="course-code">Mã học phần</label>
              <input id="course-code" type="text" placeholder="IT201" value={code} onChange={(event) => setCode(event.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="course-name">Tên học phần / môn học</label>
              <input id="course-name" type="text" placeholder="Lập trình Web nâng cao" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="course-faculty">Khoa quản lý học phần</label>
            <select id="course-faculty" value={facultyId} onChange={(event) => setFacultyId(event.target.value)} required>
              {faculties.map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.name} ({faculty.code})</option>)}
            </select>
          </div>
          <div className="catalog-form-grid catalog-form-grid--2">
            <div className="catalog-form-grid catalog-form-grid--3">
              <div className="form-group">
                <label htmlFor="course-credits">Tín chỉ</label>
                <input id="course-credits" type="number" value={credits} onChange={(event) => setCredits(event.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="course-theory">Giờ lý thuyết</label>
                <input id="course-theory" type="number" value={theoryHours} onChange={(event) => setTheoryHours(event.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="course-practice">Giờ thực hành</label>
                <input id="course-practice" type="number" value={practicalHours} onChange={(event) => setPracticalHours(event.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="course-type">Loại học phần</label>
              <select id="course-type" value={type} onChange={(event) => setType(event.target.value as CourseType)}>
                <option value="Bắt buộc">Bắt buộc</option><option value="Tự chọn">Tự chọn</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="course-description">Mô tả / mục tiêu học phần (CLO)</label>
            <textarea id="course-description" rows={3} placeholder="Mô tả nội dung và chuẩn đầu ra kiến thức..." value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <div className="modal-footer catalog-form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Hủy</button>
            <button type="submit" className="btn btn-primary">Lưu học phần</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={courseToDelete !== null}
        onClose={() => setCourseToDelete(null)}
        onConfirm={() => {
          if (courseToDelete) {
            onDeleteCourse(courseToDelete.id);
            toast.success('Đã xóa học phần', { description: courseToDelete.name });
          }
          setCourseToDelete(null);
        }}
        title="Xóa học phần?"
        recordName={courseToDelete?.name ?? ''}
        confirmText="Xóa học phần"
      />
    </div>
  );
};
