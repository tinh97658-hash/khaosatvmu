import React, { useState } from 'react';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import type { Major, Faculty } from '../types';

interface MajorsPageProps {
  majors: Major[];
  faculties: Faculty[];
  onAddMajor: (major: Major) => void;
  onDeleteMajor: (id: string) => void;
}

export const MajorsPage: React.FC<MajorsPageProps> = ({
  majors,
  faculties,
  onAddMajor,
  onDeleteMajor,
}) => {
  const [search, setSearch] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [facultyId, setFacultyId] = useState(faculties[0]?.id || '');
  const [level, setLevel] = useState<'Đại học' | 'Thạc sĩ' | 'Tiến sĩ'>('Đại học');
  const [duration, setDuration] = useState('4');
  const [credits, setCredits] = useState('132');

  const filtered = majors.filter((m) => {
    const matchSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.code.toLowerCase().includes(search.toLowerCase());
    const matchFaculty = !facultyFilter || m.facultyId === facultyFilter;
    return matchSearch && matchFaculty;
  });

  const handleSubmit = () => {
    if (!code || !name) {
      alert('Vui lòng điền mã ngành và tên ngành đào tạo!');
      return;
    }
    const selectedFac = faculties.find((f) => f.id === facultyId);
    const newMajor: Major = {
      id: `maj-${Date.now()}`,
      code,
      name,
      facultyId,
      facultyName: selectedFac?.name || 'Khoa Công nghệ Thông tin',
      degreeLevel: level,
      durationYears: parseFloat(duration) || 4,
      totalCredits: parseInt(credits) || 132,
      status: 'Đang đào tạo',
    };
    onAddMajor(newMajor);
    setIsModalOpen(false);
    setCode('');
    setName('');
  };

  const columns: Column<Major>[] = [
    {
      key: 'code',
      header: 'Mã Ngành',
      width: '120px',
      render: (item) => (
        <span className="badge badge-info" style={{ fontFamily: 'monospace' }}>
          {item.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Chương Trình Đào Tạo / Ngành',
      render: (item) => <strong style={{ color: 'var(--vmu-navy)' }}>{item.name}</strong>,
    },
    {
      key: 'facultyName',
      header: 'Khoa / Viện Phụ Trách',
    },
    {
      key: 'degreeLevel',
      header: 'Trình Độ',
      width: '100px',
      render: (item) => <span className="badge badge-success">{item.degreeLevel}</span>,
    },
    {
      key: 'structure',
      header: 'Thời Gian & Tín Chỉ',
      render: (item) => (
        <span style={{ fontSize: '13px' }}>
          ⏱️ {item.durationYears} năm &bull; 📜 <strong>{item.totalCredits}</strong> Tín chỉ
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng Thái',
      width: '120px',
      render: (item) => (
        <span
          className={`badge ${item.status === 'Đang đào tạo' ? 'badge-success' : 'badge-danger'}`}
        >
          {item.status}
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
            if (confirm(`Bạn có chắc muốn xóa Ngành "${item.name}"?`)) {
              onDeleteMajor(item.id);
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
          <h2>QUẢN LÝ DANH MỤC NGÀNH & CHƯƠNG TRÌNH ĐÀO TẠO</h2>
          <p>Danh mục ngành học chính quy, chuẩn đầu ra (PLO) và khung trình độ đào tạo</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          + Thêm Ngành / CTĐT Mới
        </button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm tên ngành, mã ngành..."
        filterOptions={[
          { label: '-- Tất cả Khoa / Viện --', value: '' },
          ...faculties.map((f) => ({ label: f.name, value: f.id })),
        ]}
        currentFilter={facultyFilter}
        onFilterChange={setFacultyFilter}
        onAddNew={() => setIsModalOpen(true)}
        addNewLabel="+ Thêm Ngành Mới"
        keyExtractor={(item) => item.id}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="THÊM MỚI CHƯƠNG TRÌNH ĐÀO TẠO / NGÀNH HỌC - VMU"
        onSubmit={handleSubmit}
        submitText="Lưu Ngành Mới"
      >
        <div className="form-group">
          <label>Mã Ngành Đào Tạo (Mã Tuyển sinh):</label>
          <input
            type="text"
            placeholder="Ví dụ: 7480101"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Tên Ngành / Chương Trình Đào Tạo:</label>
          <input
            type="text"
            placeholder="Ví dụ: Công nghệ Thông tin (Chuẩn)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Khoa / Viện Quản Lý:</label>
          <select value={facultyId} onChange={(e) => setFacultyId(e.target.value)}>
            {faculties.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.code})
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <div className="form-group">
            <label>Trình Độ:</label>
            <select value={level} onChange={(e) => setLevel(e.target.value as any)}>
              <option value="Đại học">Đại học</option>
              <option value="Thạc sĩ">Thạc sĩ</option>
              <option value="Tiến sĩ">Tiến sĩ</option>
            </select>
          </div>
          <div className="form-group">
            <label>Thời Gian (Năm):</label>
            <input
              type="number"
              step="0.5"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Tổng Tín Chỉ:</label>
            <input
              type="number"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
