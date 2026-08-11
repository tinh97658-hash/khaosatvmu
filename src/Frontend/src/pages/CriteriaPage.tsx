import React, { useState } from 'react';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import type { Criterion } from '../types';

interface CriteriaPageProps {
  criteria: Criterion[];
  surveyType?: 'Học phần' | 'Chương trình đào tạo';
  onAddCriterion: (criterion: Criterion) => void;
  onDeleteCriterion: (id: string) => void;
}

export const CriteriaPage: React.FC<CriteriaPageProps> = ({
  criteria,
  surveyType,
  onAddCriterion,
  onDeleteCriterion,
}) => {
  const [activeTab, setActiveTab] = useState<'Học phần' | 'Chương trình đào tạo'>(
    surveyType || 'Học phần'
  );
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [category, setCategory] = useState<'Học phần' | 'Chương trình đào tạo'>(activeTab);
  const [groupName, setGroupName] = useState('');
  const [code, setCode] = useState('');
  const [question, setQuestion] = useState('');
  const [weight, setWeight] = useState('1.0');

  // Keep category in form synced with activeTab when modal opens
  const handleOpenModal = () => {
    setCategory(activeTab);
    if (activeTab === 'Học phần') {
      setGroupName('Nội dung & Phương pháp giảng dạy');
    } else {
      setGroupName('Mục tiêu & Chuẩn đầu ra CTĐT (PLO)');
    }
    setIsModalOpen(true);
  };

  const filtered = criteria.filter((c) => {
    const matchesTab = c.category === activeTab;
    const matchesSearch =
      c.question.toLowerCase().includes(search.toLowerCase()) ||
      c.groupName.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !question.trim()) {
      alert('Vui lòng điền mã tiêu chí và nội dung câu hỏi khảo sát!');
      return;
    }
    const newCriterion: Criterion = {
      id: `cri-${Date.now()}`,
      category,
      groupName: groupName || (category === 'Học phần' ? 'Đánh giá môn học' : 'Chuẩn đầu ra CTĐT'),
      code,
      question,
      weight: parseFloat(weight) || 1.0,
      status: 'Kích hoạt',
    };
    onAddCriterion(newCriterion);
    setIsModalOpen(false);
    setCode('');
    setQuestion('');
  };

  const columns: Column<Criterion>[] = [
    {
      key: 'code',
      header: 'Mã Tiêu Chí',
      width: '110px',
      render: (item) => (
        <span className="badge badge-info" style={{ fontFamily: 'monospace', fontSize: '13px' }}>
          {item.code}
        </span>
      ),
    },
    {
      key: 'groupName',
      header: 'Nhóm Tiêu Chí Đánh Giá',
      width: '240px',
      render: (item) => (
        <div>
          <strong style={{ color: 'var(--vmu-navy)' }}>{item.groupName}</strong>
        </div>
      ),
    },
    {
      key: 'question',
      header: 'Nội Dung Câu Hỏi Khảo Sát (Mức độ đồng ý Likert 1-5)',
      render: (item) => (
        <span style={{ fontSize: '14px', color: 'var(--vmu-navy)', fontWeight: 500 }}>
          {item.question}
        </span>
      ),
    },
    {
      key: 'weight',
      header: 'Trọng Số',
      width: '90px',
      render: (item) => (
        <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{item.weight}</span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng Thái',
      width: '110px',
      render: (item) => (
        <span
          className={`badge ${item.status === 'Kích hoạt' ? 'badge-success' : 'badge-danger'}`}
        >
          {item.status}
        </span>
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
            if (confirm(`Xóa tiêu chí "${item.code}"?`)) {
              onDeleteCriterion(item.id);
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
          <h2>
            {activeTab === 'Học phần'
              ? 'BỘ TIÊU CHÍ ĐÁNH GIÁ HỌC PHẦN & MÔN HỌC'
              : 'BỘ TIÊU CHÍ ĐÁNH GIÁ CHƯƠNG TRÌNH ĐÀO TẠO'}
          </h2>
          <p>
            {activeTab === 'Học phần'
              ? 'Chuẩn hóa tiêu chí đánh giá hoạt động giảng dạy, học liệu, phòng thực hành và trải nghiệm môn học'
              : 'Chuẩn hóa tiêu chí đánh giá chuẩn đầu ra (PLO), khung chương trình, trải nghiệm sinh viên và sự đáp ứng của doanh nghiệp'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenModal}>
          + Thêm Tiêu Chí {activeTab}
        </button>
      </div>

      {/* Sub-tab Switcher Bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '2px solid var(--border-color)', paddingBottom: '8px' }}>
        <button
          className={`btn ${activeTab === 'Học phần' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('Học phần')}
        >
          📚 Tiêu Chí Đánh Giá Môn Học ({criteria.filter((c) => c.category === 'Học phần').length})
        </button>
        <button
          className={`btn ${activeTab === 'Chương trình đào tạo' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('Chương trình đào tạo')}
        >
          🎓 Tiêu Chí Đánh Giá CT Đào Tạo ({criteria.filter((c) => c.category === 'Chương trình đào tạo').length})
        </button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={`Tìm tiêu chí ${activeTab}...`}
        onAddNew={handleOpenModal}
        addNewLabel={`+ Thêm Tiêu Chí ${activeTab}`}
        keyExtractor={(item) => item.id}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`THÊM MỚI TIÊU CHÍ ĐÁNH GIÁ - ${activeTab.toUpperCase()}`}
      >
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} className="form-group">
            <div>
              <label>Phân Loại Tiêu Chí:</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                required
              >
                <option value="Học phần">Đánh giá Học phần (Môn học)</option>
                <option value="Chương trình đào tạo">Đánh giá Chương trình đào tạo</option>
              </select>
            </div>
            <div>
              <label>Mã Tiêu Chí (Kí hiệu):</label>
              <input
                type="text"
                placeholder={category === 'Học phần' ? 'VD: HP06' : 'VD: CTDT05'}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Nhóm Đánh Giá:</label>
            <input
              type="text"
              placeholder={
                category === 'Học phần'
                  ? 'VD: Phương pháp giảng dạy & Học liệu'
                  : 'VD: Chuẩn đầu ra (PLO) & Cơ sở vật chất khoa'
              }
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Nội Dung Câu Hỏi Khảo Sát (Mức độ đồng ý Likert 1-5):</label>
            <textarea
              rows={3}
              placeholder={
                category === 'Học phần'
                  ? 'VD: Giảng viên truyền đạt nội dung bài giảng rõ ràng, nhiệt tình...'
                  : 'VD: Chương trình đào tạo cung cấp đầy đủ kỹ năng nghề nghiệp thực tế...'
              }
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Trọng Số Tiêu Chí (Độ ưu tiên):</label>
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>

          <div className="modal-footer" style={{ padding: '16px 0 0 0', backgroundColor: 'transparent', borderTop: 'none' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary">
              Lưu Tiêu Chí
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
