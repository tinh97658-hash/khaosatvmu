import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { ConfirmDialog, Modal } from '../components/Modal';
import type { Faculty, Major } from '../types';

interface MajorsPageProps {
  majors: Major[];
  faculties: Faculty[];
  onAddMajor: (major: Major) => void;
  onDeleteMajor: (id: string) => void;
}

type DegreeLevel = 'Đại học' | 'Thạc sĩ' | 'Tiến sĩ';

export const MajorsPage: React.FC<MajorsPageProps> = ({
  majors,
  faculties,
  onAddMajor,
  onDeleteMajor,
}) => {
  const [search, setSearch] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [majorToDelete, setMajorToDelete] = useState<Major | null>(null);
  const [validationError, setValidationError] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [facultyId, setFacultyId] = useState(faculties[0]?.id || '');
  const [level, setLevel] = useState<DegreeLevel>('Đại học');
  const [duration, setDuration] = useState('4');
  const [credits, setCredits] = useState('132');

  const filtered = majors.filter((major) => {
    const matchesSearch =
      major.name.toLowerCase().includes(search.toLowerCase()) ||
      major.code.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (!facultyFilter || major.facultyId === facultyFilter);
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim() || !name.trim()) {
      setValidationError('Vui lòng nhập mã và tên ngành đào tạo.');
      return;
    }

    const selectedFaculty = faculties.find((faculty) => faculty.id === facultyId);
    const newMajor: Major = {
      id: `maj-${Date.now()}`,
      code: code.trim(),
      name: name.trim(),
      facultyId,
      facultyName: selectedFaculty?.name || 'Khoa Công nghệ Thông tin',
      degreeLevel: level,
      durationYears: parseFloat(duration) || 4,
      totalCredits: parseInt(credits) || 132,
      status: 'Đang đào tạo',
    };

    onAddMajor(newMajor);
    setIsModalOpen(false);
    setValidationError('');
    setCode('');
    setName('');
  };

  const columns: Column<Major>[] = [
    {
      key: 'code',
      header: 'Mã ngành',
      width: '110px',
      render: (item) => <span className="catalog-code">{item.code}</span>,
    },
    {
      key: 'name',
      header: 'Chương trình đào tạo / ngành',
      render: (item) => <span className="catalog-cell-primary">{item.name}</span>,
    },
    {
      key: 'facultyName',
      header: 'Khoa / viện phụ trách',
    },
    {
      key: 'degreeLevel',
      header: 'Trình độ',
      width: '100px',
      render: (item) => <span className="catalog-cell-primary">{item.degreeLevel}</span>,
    },
    {
      key: 'structure',
      header: 'Thời gian và tín chỉ',
      width: '160px',
      render: (item) => (
        <div className="catalog-stats">
          <span className="catalog-stat-line"><strong>{item.durationYears}</strong> năm</span>
          <span className="catalog-stat-line"><strong>{item.totalCredits}</strong> tín chỉ</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '120px',
      render: (item) => (
        <span className={`catalog-status ${item.status === 'Đang đào tạo' ? 'catalog-status--success' : 'catalog-status--danger'}`}>
          {item.status}
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
            onClick={() => setMajorToDelete(item)}
            aria-label={`Xóa ${item.name}`}
            title="Xóa ngành"
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
          <h2>Danh mục ngành và chương trình đào tạo</h2>
          <p>Quản lý ngành học, khung trình độ, thời gian đào tạo và tổng số tín chỉ.</p>
        </div>
      </header>

      <DataTable
        columns={columns}
        data={filtered}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm tên hoặc mã ngành..."
        filterOptions={[
          { label: 'Tất cả khoa / viện', value: '' },
          ...faculties.map((faculty) => ({ label: faculty.name, value: faculty.id })),
        ]}
        currentFilter={facultyFilter}
        onFilterChange={setFacultyFilter}
        onAddNew={() => {
          setValidationError('');
          setIsModalOpen(true);
        }}
        addNewLabel="Thêm ngành"
        emptyMessage="Chưa có ngành đào tạo nào trong danh mục."
        keyExtractor={(item) => item.id}
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Thêm ngành / chương trình đào tạo">
        <form className="catalog-form" onSubmit={handleSubmit}>
          {validationError && <div className="catalog-validation-error" role="alert">{validationError}</div>}
          <div className="catalog-form-grid catalog-form-grid--code-name">
            <div className="form-group">
              <label htmlFor="major-code">Mã ngành đào tạo</label>
              <input id="major-code" type="text" placeholder="7480101" value={code} onChange={(event) => setCode(event.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="major-name">Tên ngành / chương trình</label>
              <input id="major-name" type="text" placeholder="Công nghệ Thông tin" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="major-faculty">Khoa / viện quản lý</label>
            <select id="major-faculty" value={facultyId} onChange={(event) => setFacultyId(event.target.value)} required>
              {faculties.map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.name} ({faculty.code})</option>)}
            </select>
          </div>
          <div className="catalog-form-grid catalog-form-grid--3">
            <div className="form-group">
              <label htmlFor="major-level">Trình độ</label>
              <select id="major-level" value={level} onChange={(event) => setLevel(event.target.value as DegreeLevel)}>
                <option value="Đại học">Đại học</option><option value="Thạc sĩ">Thạc sĩ</option><option value="Tiến sĩ">Tiến sĩ</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="major-duration">Thời gian (năm)</label>
              <input id="major-duration" type="number" step="0.5" value={duration} onChange={(event) => setDuration(event.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="major-credits">Tổng tín chỉ</label>
              <input id="major-credits" type="number" value={credits} onChange={(event) => setCredits(event.target.value)} />
            </div>
          </div>
          <div className="modal-footer catalog-form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Hủy</button>
            <button type="submit" className="btn btn-primary">Lưu ngành</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={majorToDelete !== null}
        onClose={() => setMajorToDelete(null)}
        onConfirm={() => {
          if (majorToDelete) onDeleteMajor(majorToDelete.id);
          setMajorToDelete(null);
        }}
        title="Xóa ngành đào tạo?"
        recordName={majorToDelete?.name ?? ''}
        confirmText="Xóa ngành"
      />
    </div>
  );
};
