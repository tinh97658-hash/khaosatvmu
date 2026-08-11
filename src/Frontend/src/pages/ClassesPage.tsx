import React, { useState } from 'react';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import type { CourseClass, Course, Lecturer, ClassGroup } from '../types';

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

  // Add Class Group Modal State
  const [addingGroupForClass, setAddingGroupForClass] = useState<CourseClass | null>(null);
  const [groupCode, setGroupCode] = useState('N01');
  const [selectedLecturerId, setSelectedLecturerId] = useState('');
  const [groupStudents, setGroupStudents] = useState(30);
  const [groupRoom, setGroupRoom] = useState('A6-302');
  const [groupSchedule, setGroupSchedule] = useState('Thứ 2 (Tiết 1-3)');

  // Form states for creating a new Class
  const [code, setCode] = useState('');
  const [courseId, setCourseId] = useState(courses[0]?.id || '');
  const [lecturerName, setLecturerName] = useState('');
  const [lecturerEmail, setLecturerEmail] = useState('');
  const [semester, setSemester] = useState('Học kỳ II');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [totalStudents, setTotalStudents] = useState('60');
  const [room, setRoom] = useState('A6-302');

  const filtered = classes.filter((c) => {
    const matchSearch =
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.courseName.toLowerCase().includes(search.toLowerCase()) ||
      c.lecturerName.toLowerCase().includes(search.toLowerCase()) ||
      (c.groups && c.groups.some((g) => g.lecturerName.toLowerCase().includes(search.toLowerCase())));
    const matchStatus = !statusFilter || c.surveyStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      alert('Vui lòng điền mã lớp học phần!');
      return;
    }
    const selectedCourse = courses.find((crs) => crs.id === courseId);
    const classId = `cls-${Date.now()}`;

    // Auto-generate default N01 & N02 groups
    const defaultN01: ClassGroup = {
      id: `grp-${Date.now()}-1`,
      classId,
      groupCode: 'N01',
      fullGroupCode: `${code}.N01`,
      lecturerId: 'lec-1',
      lecturerName: lecturerName || 'TS. Nguyễn Văn A',
      lecturerEmail: lecturerEmail || 'anguyen@vimaru.edu.vn',
      studentCount: Math.ceil((parseInt(totalStudents) || 60) / 2),
      room: room || 'A6-302 (PM1)',
      schedule: 'Thứ 2 (Tiết 1-3)',
      surveyStatus: 'Đang khảo sát',
      completedResponses: 0,
    };

    const defaultN02: ClassGroup = {
      id: `grp-${Date.now()}-2`,
      classId,
      groupCode: 'N02',
      fullGroupCode: `${code}.N02`,
      lecturerId: 'lec-2',
      lecturerName: lecturerName || 'ThS. Trần Thị B',
      lecturerEmail: lecturerEmail || 'btran@vimaru.edu.vn',
      studentCount: Math.floor((parseInt(totalStudents) || 60) / 2),
      room: room || 'A6-304 (PM2)',
      schedule: 'Thứ 4 (Tiết 4-6)',
      surveyStatus: 'Đang khảo sát',
      completedResponses: 0,
    };

    const newClass: CourseClass = {
      id: classId,
      code,
      courseId,
      courseCode: selectedCourse?.code || 'IT201',
      courseName: selectedCourse?.name || 'Lập trình Web nâng cao',
      lecturerName: lecturerName || 'Phân công theo Nhóm N01, N02',
      lecturerEmail: lecturerEmail || 'giangvien@vimaru.edu.vn',
      semester,
      academicYear,
      totalStudents: parseInt(totalStudents) || 60,
      room: room || 'Giảng đường',
      surveyStatus: 'Đang khảo sát',
      completedResponses: 0,
      groups: [defaultN01, defaultN02],
    };

    onAddClass(newClass);
    setIsModalOpen(false);
    setCode('');
    setLecturerName('');
    setLecturerEmail('');
  };

  const handleAddGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingGroupForClass || !selectedLecturerId) return;

    const lecturer = lecturers.find((l) => l.id === selectedLecturerId);
    if (!lecturer) return;

    const newGroup: ClassGroup = {
      id: `grp-${Date.now()}`,
      classId: addingGroupForClass.id,
      groupCode,
      fullGroupCode: `${addingGroupForClass.code}.${groupCode}`,
      lecturerId: lecturer.id,
      lecturerName: lecturer.fullName,
      lecturerEmail: lecturer.email,
      studentCount: Number(groupStudents) || 30,
      room: groupRoom || 'A6-302',
      schedule: groupSchedule || 'Thứ 2 (Tiết 1-3)',
      surveyStatus: 'Đang khảo sát',
      completedResponses: 0,
    };

    onAddClassGroup(addingGroupForClass.id, newGroup);
    setAddingGroupForClass(null);
  };

  const columns: Column<CourseClass>[] = [
    {
      key: 'code',
      header: 'Mã Lớp HP',
      width: '110px',
      render: (item) => (
        <span className="badge badge-info" style={{ fontFamily: 'monospace', fontSize: '13px' }}>
          {item.code}
        </span>
      ),
    },
    {
      key: 'courseName',
      header: 'Tên Học Phần',
      render: (item) => (
        <div>
          <strong style={{ color: 'var(--vmu-navy)', fontSize: '14px' }}>{item.courseName}</strong>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Mã môn: {item.courseCode} &bull; Sĩ số: {item.totalStudents} SV &bull; {item.semester} ({item.academicYear})
          </div>
        </div>
      ),
    },
    {
      key: 'groups',
      header: 'Phân Công Giảng Viên Theo Nhóm (N01, N02...)',
      render: (item) => {
        const groups = item.groups || [];
        return (
          <div>
            {groups.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Chưa chia nhóm N01, N02</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {groups.map((g) => (
                  <div
                    key={g.id}
                    style={{
                      backgroundColor: '#F8FAFC',
                      padding: '6px 10px',
                      borderLeft: '3px solid var(--vmu-blue)',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <strong style={{ color: 'var(--vmu-navy)' }}>[{g.groupCode}]</strong> {g.lecturerName}
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {g.schedule} &bull; Phòng: {g.room} ({g.studentCount} SV)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              className="btn btn-secondary btn-sm"
              style={{ marginTop: '6px', fontSize: '11px', padding: '2px 8px' }}
              onClick={() => {
                setAddingGroupForClass(item);
                setGroupCode(`N0${(item.groups?.length || 0) + 1}`);
                if (lecturers.length > 0) setSelectedLecturerId(lecturers[0].id);
              }}
            >
              + Phân công Nhóm Mới (N03, N04...)
            </button>
          </div>
        );
      },
    },
    {
      key: 'responses',
      header: 'Tiến Độ Thu Phiếu',
      width: '130px',
      render: (item) => (
        <div>
          <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--vmu-navy)' }}>
            📝 {item.completedResponses} / {item.totalStudents} SV
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            ({Math.round((item.completedResponses / (item.totalStudents || 1)) * 100)}% sĩ số)
          </div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Thao Tác',
      width: '90px',
      render: (item) => (
        <button
          className="btn btn-danger btn-sm"
          onClick={() => {
            if (confirm(`Xóa lớp học phần "${item.code}"?`)) {
              onDeleteClass(item.id);
            }
          }}
        >
          🗑️ Xóa
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h2>QUẢN LÝ LỚP HỌC PHẦN & PHÂN CÔNG NHÓM (N01, N02...)</h2>
          <p>Chia lớp học phần thành các nhóm N01, N02... và phân công Giảng viên giảng dạy tương ứng</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          + Thêm Lớp Học Phần Mới
        </button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm mã lớp HP, tên giảng viên nhóm N01/N02, tên môn..."
        filterOptions={[
          { label: '-- Tất cả trạng thái --', value: '' },
          { label: 'Đang khảo sát', value: 'Đang khảo sát' },
          { label: 'Đã hoàn thành', value: 'Đã hoàn thành' },
          { label: 'Chưa khảo sát', value: 'Chưa khảo sát' },
        ]}
        currentFilter={statusFilter}
        onFilterChange={setStatusFilter}
        onAddNew={() => setIsModalOpen(true)}
        addNewLabel="+ Thêm Lớp HP"
        keyExtractor={(item) => item.id}
      />

      {/* MODAL 1: Create New Master Class */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="THÊM MỚI LỚP HỌC PHẦN (TỰ ĐỘNG KHỞI TẠO NHÓM N01, N02)"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Mã Lớp Học Phần Tổng:</label>
            <input
              type="text"
              placeholder="Ví dụ: IT201.01, NAV101.02..."
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Chọn Học Phần / Môn Học:</label>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} required>
              {courses.map((crs) => (
                <option key={crs.id} value={crs.id}>
                  [{crs.code}] {crs.name} ({crs.credits} tín chỉ)
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} className="form-group">
            <div>
              <label>Học Kỳ:</label>
              <select value={semester} onChange={(e) => setSemester(e.target.value)}>
                <option value="Học kỳ I">Học kỳ I</option>
                <option value="Học kỳ II">Học kỳ II</option>
                <option value="Học kỳ Hè">Học kỳ Hè</option>
              </select>
            </div>
            <div>
              <label>Năm Học:</label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                required
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} className="form-group">
            <div>
              <label>Tổng Sĩ Số Sinh Viên:</label>
              <input
                type="number"
                value={totalStudents}
                onChange={(e) => setTotalStudents(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Phòng Học Chính:</label>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="modal-footer" style={{ padding: '16px 0 0 0', backgroundColor: 'transparent', borderTop: 'none' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary">
              Khởi Tạo Lớp & Tạo Nhóm N01, N02
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Assign Lecturer to Sub-group N01, N02, N03... */}
      {addingGroupForClass && (
        <Modal
          isOpen={!!addingGroupForClass}
          onClose={() => setAddingGroupForClass(null)}
          title={`PHÂN CÔNG GIẢNG VIÊN CHO NHÓM LỚP (LỚP ${addingGroupForClass.code})`}
        >
          <form onSubmit={handleAddGroupSubmit}>
            <div style={{ marginBottom: '14px', fontSize: '13px', color: 'var(--vmu-navy)', backgroundColor: 'var(--vmu-blue-light)', padding: '10px' }}>
              📚 Học phần: <strong>{addingGroupForClass.courseName} ({addingGroupForClass.courseCode})</strong>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }} className="form-group">
              <div>
                <label>Ký Hiệu Nhóm Lớp:</label>
                <input
                  type="text"
                  placeholder="N01, N02, N03..."
                  value={groupCode}
                  onChange={(e) => setGroupCode(e.target.value)}
                  required
                />
              </div>
              <div>
                <label>Chọn Giảng Viên Đảm Nhận:</label>
                <select
                  value={selectedLecturerId}
                  onChange={(e) => setSelectedLecturerId(e.target.value)}
                  required
                >
                  <option value="">-- Chọn Giảng viên từ Danh mục --</option>
                  {lecturers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.fullName} [{l.code}] ({l.facultyName})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }} className="form-group">
              <div>
                <label>Sĩ Số Nhóm (SV):</label>
                <input
                  type="number"
                  value={groupStudents}
                  onChange={(e) => setGroupStudents(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label>Phòng Học Thực Hành:</label>
                <input
                  type="text"
                  value={groupRoom}
                  onChange={(e) => setGroupRoom(e.target.value)}
                  placeholder="A6-302 (PM1)"
                />
              </div>
              <div>
                <label>Lịch Học:</label>
                <input
                  type="text"
                  value={groupSchedule}
                  onChange={(e) => setGroupSchedule(e.target.value)}
                  placeholder="Thứ 2 (Tiết 1-3)"
                />
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '16px 0 0 0', backgroundColor: 'transparent', borderTop: 'none' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setAddingGroupForClass(null)}>
                Hủy
              </button>
              <button type="submit" className="btn btn-primary">
                Lưu Phân Công Giảng Viên
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
