import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { ConfirmDialog, Modal } from '../components/Modal';
import type { ClassGroup, Course, CourseClass, Lecturer } from '../types';

interface ClassesPageProps {
  classes: CourseClass[];
  courses: Course[];
  lecturers: Lecturer[];
  onAddClass: (cls: CourseClass) => void;
  onDeleteClass: (id: string) => void;
  onAddClassGroup: (classId: string, group: ClassGroup) => void;
}

export const ClassesPage: React.FC<ClassesPageProps> = ({
  classes,
  courses,
  lecturers,
  onAddClass,
  onDeleteClass,
  onAddClassGroup,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<CourseClass | null>(null);
  const [validationError, setValidationError] = useState('');
  const [addingGroupForClass, setAddingGroupForClass] = useState<CourseClass | null>(null);
  const [groupCode, setGroupCode] = useState('N01');
  const [selectedLecturerId, setSelectedLecturerId] = useState('');
  const [groupStudents, setGroupStudents] = useState(30);
  const [groupRoom, setGroupRoom] = useState('A6-302');
  const [groupSchedule, setGroupSchedule] = useState('Thứ 2 (Tiết 1-3)');
  const [code, setCode] = useState('');
  const [courseId, setCourseId] = useState(courses[0]?.id || '');
  const [semester, setSemester] = useState('Học kỳ II');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [totalStudents, setTotalStudents] = useState('60');
  const [room, setRoom] = useState('A6-302');

  const filtered = classes.filter((courseClass) => {
    const normalizedSearch = search.toLowerCase();
    const matchesSearch =
      courseClass.code.toLowerCase().includes(normalizedSearch) ||
      courseClass.courseName.toLowerCase().includes(normalizedSearch) ||
      courseClass.lecturerName.toLowerCase().includes(normalizedSearch) ||
      Boolean(courseClass.groups?.some((group) => group.lecturerName.toLowerCase().includes(normalizedSearch)));
    return matchesSearch && (!statusFilter || courseClass.surveyStatus === statusFilter);
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim() || !courseId) {
      setValidationError('Vui lòng nhập mã lớp và chọn học phần.');
      return;
    }

    const selectedCourse = courses.find((course) => course.id === courseId);
    const classId = `cls-${Date.now()}`;
    const studentCount = parseInt(totalStudents) || 60;
    const defaultGroups: ClassGroup[] = [
      {
        id: `grp-${Date.now()}-1`,
        classId,
        groupCode: 'N01',
        fullGroupCode: `${code.trim()}.N01`,
        lecturerId: 'lec-1',
        lecturerName: 'TS. Nguyễn Văn A',
        lecturerEmail: 'anguyen@vimaru.edu.vn',
        studentCount: Math.ceil(studentCount / 2),
        room: room.trim() || 'A6-302 (PM1)',
        schedule: 'Thứ 2 (Tiết 1-3)',
        surveyStatus: 'Đang khảo sát',
        completedResponses: 0,
      },
      {
        id: `grp-${Date.now()}-2`,
        classId,
        groupCode: 'N02',
        fullGroupCode: `${code.trim()}.N02`,
        lecturerId: 'lec-2',
        lecturerName: 'ThS. Trần Thị B',
        lecturerEmail: 'btran@vimaru.edu.vn',
        studentCount: Math.floor(studentCount / 2),
        room: room.trim() || 'A6-304 (PM2)',
        schedule: 'Thứ 4 (Tiết 4-6)',
        surveyStatus: 'Đang khảo sát',
        completedResponses: 0,
      },
    ];

    const newClass: CourseClass = {
      id: classId,
      code: code.trim(),
      courseId,
      courseCode: selectedCourse?.code || 'IT201',
      courseName: selectedCourse?.name || 'Lập trình Web nâng cao',
      lecturerName: 'Phân công theo nhóm N01, N02',
      lecturerEmail: 'giangvien@vimaru.edu.vn',
      semester,
      academicYear,
      totalStudents: studentCount,
      room: room.trim() || 'Giảng đường',
      surveyStatus: 'Đang khảo sát',
      completedResponses: 0,
      groups: defaultGroups,
    };

    onAddClass(newClass);
    toast.success('Đã thêm lớp học phần', { description: newClass.code });
    setIsModalOpen(false);
    setValidationError('');
    setCode('');
  };

  const handleAddGroupSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!addingGroupForClass || !selectedLecturerId) return;

    const lecturer = lecturers.find((item) => item.id === selectedLecturerId);
    if (!lecturer) return;

    const newGroup: ClassGroup = {
      id: `grp-${Date.now()}`,
      classId: addingGroupForClass.id,
      groupCode: groupCode.trim(),
      fullGroupCode: `${addingGroupForClass.code}.${groupCode.trim()}`,
      lecturerId: lecturer.id,
      lecturerName: lecturer.fullName,
      lecturerEmail: lecturer.email,
      studentCount: Number(groupStudents) || 30,
      room: groupRoom.trim() || 'A6-302',
      schedule: groupSchedule.trim() || 'Thứ 2 (Tiết 1-3)',
      surveyStatus: 'Đang khảo sát',
      completedResponses: 0,
    };

    onAddClassGroup(addingGroupForClass.id, newGroup);
    toast.success('Đã phân công nhóm lớp', { description: newGroup.fullGroupCode });
    setAddingGroupForClass(null);
  };

  const openGroupModal = (courseClass: CourseClass) => {
    const nextGroupNumber = (courseClass.groups?.length || 0) + 1;
    setAddingGroupForClass(courseClass);
    setGroupCode(`N${String(nextGroupNumber).padStart(2, '0')}`);
    setSelectedLecturerId(lecturers[0]?.id || '');
  };

  const columns: Column<CourseClass>[] = [
    {
      key: 'code',
      header: 'Mã lớp HP',
      width: '105px',
      render: (item) => <span className="catalog-code">{item.code}</span>,
    },
    {
      key: 'courseName',
      header: 'Học phần',
      width: '270px',
      render: (item) => (
        <div>
          <div className="catalog-cell-primary">{item.courseName}</div>
          <div className="catalog-cell-meta">
            {item.courseCode} · {item.totalStudents} SV · {item.semester} ({item.academicYear})
          </div>
        </div>
      ),
    },
    {
      key: 'groups',
      header: 'Phân công giảng viên theo nhóm',
      width: '420px',
      render: (item) => {
        const groups = item.groups || [];
        return (
          <div>
            {groups.length === 0 ? (
              <div className="catalog-cell-meta">Chưa có nhóm lớp</div>
            ) : (
              <div className="catalog-group-list">
                {groups.map((group) => (
                  <div className="catalog-group-row" key={group.id}>
                    <div className="catalog-group-row__title">{group.groupCode} · {group.lecturerName}</div>
                    <div className="catalog-cell-meta">{group.schedule} · Phòng {group.room} · {group.studentCount} SV</div>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="catalog-group-add" onClick={() => openGroupModal(item)}>
              <Plus aria-hidden="true" size={14} />Phân công nhóm
            </button>
          </div>
        );
      },
    },
    {
      key: 'responses',
      header: 'Thu phiếu',
      width: '125px',
      render: (item) => (
        <div className="catalog-stats">
          <span className="catalog-stat-line"><strong>{item.completedResponses}/{item.totalStudents}</strong> SV</span>
          <span className="catalog-cell-meta">{Math.round((item.completedResponses / (item.totalStudents || 1)) * 100)}% sĩ số</span>
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
            onClick={() => setClassToDelete(item)}
            aria-label={`Xóa lớp ${item.code}`}
            title="Xóa lớp học phần"
          >
            <Trash2 aria-hidden="true" size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="catalog-page catalog-page--classes">
      <header className="catalog-page-header">
        <div>
          <h2>Lớp học phần và phân công nhóm</h2>
          <p>Quản lý lớp học phần, nhóm lớp và giảng viên phụ trách theo từng học kỳ.</p>
        </div>
      </header>

      <DataTable
        columns={columns}
        data={filtered}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm mã lớp, học phần hoặc giảng viên..."
        filterOptions={[
          { label: 'Tất cả trạng thái', value: '' },
          { label: 'Đang khảo sát', value: 'Đang khảo sát' },
          { label: 'Đã hoàn thành', value: 'Đã hoàn thành' },
          { label: 'Chưa khảo sát', value: 'Chưa khảo sát' },
        ]}
        currentFilter={statusFilter}
        onFilterChange={setStatusFilter}
        onAddNew={() => {
          setValidationError('');
          setIsModalOpen(true);
        }}
        addNewLabel="Thêm lớp học phần"
        emptyMessage="Chưa có lớp học phần nào trong danh mục."
        keyExtractor={(item) => item.id}
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Thêm lớp học phần">
        <form className="catalog-form" onSubmit={handleSubmit}>
          {validationError && <div className="catalog-validation-error" role="alert">{validationError}</div>}
          <div className="catalog-form-grid catalog-form-grid--code-name">
            <div className="form-group">
              <label htmlFor="class-code">Mã lớp học phần</label>
              <input id="class-code" type="text" placeholder="IT201.01" value={code} onChange={(event) => setCode(event.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="class-course">Học phần / môn học</label>
              <select id="class-course" value={courseId} onChange={(event) => setCourseId(event.target.value)} required>
                {courses.map((course) => <option key={course.id} value={course.id}>[{course.code}] {course.name} ({course.credits} tín chỉ)</option>)}
              </select>
            </div>
          </div>
          <div className="catalog-form-grid catalog-form-grid--2">
            <div className="form-group">
              <label htmlFor="class-semester">Học kỳ</label>
              <select id="class-semester" value={semester} onChange={(event) => setSemester(event.target.value)}>
                <option value="Học kỳ I">Học kỳ I</option><option value="Học kỳ II">Học kỳ II</option><option value="Học kỳ Hè">Học kỳ Hè</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="class-year">Năm học</label>
              <input id="class-year" type="text" value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} required />
            </div>
          </div>
          <div className="catalog-form-grid catalog-form-grid--2">
            <div className="form-group">
              <label htmlFor="class-students">Tổng sĩ số sinh viên</label>
              <input id="class-students" type="number" value={totalStudents} onChange={(event) => setTotalStudents(event.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="class-room">Phòng học chính</label>
              <input id="class-room" type="text" value={room} onChange={(event) => setRoom(event.target.value)} required />
            </div>
          </div>
          <div className="catalog-context-band">Hệ thống sẽ tự tạo hai nhóm N01 và N02 cho lớp học phần mới.</div>
          <div className="modal-footer catalog-form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Hủy</button>
            <button type="submit" className="btn btn-primary">Khởi tạo lớp</button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={addingGroupForClass !== null}
        onClose={() => setAddingGroupForClass(null)}
        title={`Phân công nhóm lớp ${addingGroupForClass?.code ?? ''}`}
      >
        <form className="catalog-form" onSubmit={handleAddGroupSubmit}>
          <div className="catalog-context-band">
            Học phần: <strong>{addingGroupForClass?.courseName}</strong> ({addingGroupForClass?.courseCode})
          </div>
          <div className="catalog-form-grid catalog-form-grid--code-name">
            <div className="form-group">
              <label htmlFor="group-code">Ký hiệu nhóm</label>
              <input id="group-code" type="text" placeholder="N03" value={groupCode} onChange={(event) => setGroupCode(event.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="group-lecturer">Giảng viên đảm nhận</label>
              <select id="group-lecturer" value={selectedLecturerId} onChange={(event) => setSelectedLecturerId(event.target.value)} required>
                <option value="">Chọn giảng viên</option>
                {lecturers.map((lecturer) => <option key={lecturer.id} value={lecturer.id}>{lecturer.fullName} [{lecturer.code}] ({lecturer.facultyName})</option>)}
              </select>
            </div>
          </div>
          <div className="catalog-form-grid catalog-form-grid--3">
            <div className="form-group">
              <label htmlFor="group-students">Sĩ số nhóm</label>
              <input id="group-students" type="number" value={groupStudents} onChange={(event) => setGroupStudents(Number(event.target.value))} required />
            </div>
            <div className="form-group">
              <label htmlFor="group-room">Phòng học</label>
              <input id="group-room" type="text" value={groupRoom} onChange={(event) => setGroupRoom(event.target.value)} placeholder="A6-302" />
            </div>
            <div className="form-group">
              <label htmlFor="group-schedule">Lịch học</label>
              <input id="group-schedule" type="text" value={groupSchedule} onChange={(event) => setGroupSchedule(event.target.value)} placeholder="Thứ 2 (Tiết 1-3)" />
            </div>
          </div>
          <div className="modal-footer catalog-form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setAddingGroupForClass(null)}>Hủy</button>
            <button type="submit" className="btn btn-primary">Lưu phân công</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={classToDelete !== null}
        onClose={() => setClassToDelete(null)}
        onConfirm={() => {
          if (classToDelete) {
            onDeleteClass(classToDelete.id);
            toast.success('Đã xóa lớp học phần', { description: classToDelete.code });
          }
          setClassToDelete(null);
        }}
        title="Xóa lớp học phần?"
        recordName={classToDelete?.code ?? ''}
        confirmText="Xóa lớp"
      />
    </div>
  );
};
