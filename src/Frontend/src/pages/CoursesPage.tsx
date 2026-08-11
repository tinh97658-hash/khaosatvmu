import React, { useState } from 'react';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import type { Course, Faculty } from '../types';

interface CoursesPageProps {
  courses: Course[];
  faculties: Faculty[];
  onAddCourse: (course: Course) => void;
  onDeleteCourse: (id: string) => void;
}

export const CoursesPage: React.FC<CoursesPageProps> = ({
  courses,
  faculties,
  onAddCourse,
  onDeleteCourse,
}) => {
  const [search, setSearch] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [credits, setCredits] = useState('3');
  const [theoryHours, setTheoryHours] = useState('30');
  const [practicalHours, setPracticalHours] = useState('15');
  const [facultyId, setFacultyId] = useState(faculties[0]?.id || '');
  const [type, setType] = useState<'Bắt buộc' | 'Tự chọn'>('Bắt buộc');
  const [description, setDescription] = useState('');

  const filtered = courses.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase());
    const matchFaculty = !facultyFilter || c.facultyId === facultyFilter;
    return matchSearch && matchFaculty;
  });

  const handleSubmit = () => {
    if (!code || !name) {
      alert('Vui lòng điền mã học phần và tên học phần!');
      return;
    }
    const selectedFac = faculties.find((f) => f.id === facultyId);
    const newCourse: Course = {
      id: `crs-${Date.now()}`,
      code,
      name,
      credits: parseInt(credits) || 3,
      theoryHours: parseInt(theoryHours) || 30,
      practicalHours: parseInt(practicalHours) || 0,
      facultyId,
      facultyName: selectedFac?.name || 'Khoa Công nghệ Thông tin',
      type,
      description,
    };
    onAddCourse(newCourse);
    setIsModalOpen(false);
    setCode('');
    setName('');
    setDescription('');
  };

  const columns: Column<Course>[] = [
    {
      key: 'code',
      header: 'Mã Học Phần',
      width: '120px',
      render: (item) => (
        <span className="badge badge-info" style={{ fontFamily: 'monospace', fontSize: '13px' }}>
          {item.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Tên Học Phần / Môn Học',
      render: (item) => (
        <div>
          <strong style={{ color: 'var(--vmu-navy)' }}>{item.name}</strong>
          {item.description && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {item.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'credits',
      header: 'Số Tín Chỉ',
      width: '100px',
      render: (item) => (
        <span style={{ fontWeight: 700, color: 'var(--vmu-navy)' }}>
          {item.credits} Tín chỉ
        </span>
      ),
    },
    {
      key: 'hours',
      header: 'Số Giờ (LT / TH)',
      width: '130px',
      render: (item) => (
        <span style={{ fontSize: '13px' }}>
          📖 {item.theoryHours}h LT &bull; 💻 {item.practicalHours}h TH
        </span>
      ),
    },
    {
      key: 'facultyName',
      header: 'Khoa Phụ Trách',
    },
    {
      key: 'type',
      header: 'Loại HP',
      width: '110px',
      render: (item) => (
        <span className={`badge ${item.type === 'Bắt buộc' ? 'badge-success' : 'badge-warning'}`}>
          {item.type}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Thao Tác',
      width: '100px',
      render: (item) => (
        <button
          className="btn btn-danger btn-sm"
          onClick={() => {
            if (confirm(`Bạn có chắc muốn xóa Học phần "${item.name}"?`)) {
              onDeleteCourse(item.id);
            }
          }}
        >
          Xóa
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h2>QUẢN LÝ DANH MỤC HỌC PHẦN & MÔN HỌC</h2>
          <p>Danh mục môn học toàn trường, phân bổ số giờ lý thuyết/thực hành và chuẩn đầu ra CLO</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          + Thêm Học Phần Mới
        </button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm tên môn học, mã môn học..."
        filterOptions={[
          { label: '-- Tất cả Khoa phụ trách --', value: '' },
          ...faculties.map((f) => ({ label: f.name, value: f.id })),
        ]}
        currentFilter={facultyFilter}
        onFilterChange={setFacultyFilter}
        onAddNew={() => setIsModalOpen(true)}
        addNewLabel="+ Thêm Học Phần"
        keyExtractor={(item) => item.id}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="THÊM MỚI HỌC PHẦN / MÔN HỌC - VMU"
        onSubmit={handleSubmit}
        submitText="Lưu Học Phần"
      >
        <div className="form-group">
          <label>Mã Học Phần:</label>
          <input
            type="text"
            placeholder="Ví dụ: IT201, NAV101..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Tên Học Phần / Môn Học:</label>
          <input
            type="text"
            placeholder="Ví dụ: Lập trình Web nâng cao & Đánh giá chất lượng"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Khoa Quản Lý Học Phần:</label>
          <select value={facultyId} onChange={(e) => setFacultyId(e.target.value)}>
            {faculties.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.code})
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
          <div className="form-group">
            <label>Số Tín Chỉ:</label>
            <input
              type="number"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Giờ Lý Thuyết:</label>
            <input
              type="number"
              value={theoryHours}
              onChange={(e) => setTheoryHours(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Giờ Thực Hành:</label>
            <input
              type="number"
              value={practicalHours}
              onChange={(e) => setPracticalHours(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Loại HP:</label>
            <select value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="Bắt buộc">Bắt buộc</option>
              <option value="Tự chọn">Tự chọn</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Mô Tả / Mục Tiêu Học Phần (CLO):</label>
          <textarea
            rows={3}
            placeholder="Mô tả nội dung môn học và chuẩn đầu ra kiến thức..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
};
