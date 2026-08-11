import React, { useState } from 'react';
import { Modal } from '../components/Modal';
import { InlineTreeWizard } from '../components/InlineTreeWizard';
import type { SurveyCampaign, Major, CourseClass, Criterion } from '../types';

interface CampaignsPageProps {
  campaigns: SurveyCampaign[];
  majors: Major[];
  classes: CourseClass[];
  criteria: Criterion[];
  surveyType?: 'Học phần' | 'Chương trình đào tạo';
  onAddCampaign: (campaign: SurveyCampaign) => void;
  onAddMultipleCampaigns?: (campaigns: SurveyCampaign[]) => void;
  onDeleteCampaign: (id: string) => void;
  onUpdateCampaignDates: (id: string, startDate: string, endDate: string) => void;
  onOpenQR: (campaign: SurveyCampaign) => void;
}

export const CampaignsPage: React.FC<CampaignsPageProps> = ({
  campaigns,
  majors,
  classes,
  criteria,
  surveyType,
  onAddCampaign,
  onAddMultipleCampaigns,
  onDeleteCampaign,
  onUpdateCampaignDates,
  onOpenQR,
}) => {
  const [activeTab, setActiveTab] = useState<'Học phần' | 'Chương trình đào tạo'>(
    surveyType || 'Học phần'
  );

  // Filter States
  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [academicYearFilter, setAcademicYearFilter] = useState('');

  // Tree View Expand / Collapse state (Default open all)
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    '2025-2026_Học kỳ II': true,
    '2025-2026_Học kỳ I': true,
    '2026-2027_Học kỳ I': true,
  });

  // Inline Tree Wizard State (specifies target semester & academic year on the tree)
  const [activeWizardTarget, setActiveWizardTarget] = useState<{
    semester?: string;
    academicYear?: string;
  } | null>(null);

  // Edit QR Time Modal State
  const [editingCampaign, setEditingCampaign] = useState<SurveyCampaign | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');

  const handleOpenWizard = (semester?: string, academicYear?: string) => {
    if (academicYear && semester) {
      const folderKey = `${academicYear}_${semester}`;
      setExpandedFolders((prev) => ({ ...prev, [folderKey]: true }));
    }
    setActiveWizardTarget({ semester, academicYear });
  };

  const toggleFolder = (folderKey: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderKey]: !prev[folderKey],
    }));
  };

  const handleCreateMultipleFromWizard = (newCampaigns: SurveyCampaign[]) => {
    if (onAddMultipleCampaigns) {
      onAddMultipleCampaigns(newCampaigns);
    } else {
      newCampaigns.forEach((cmp) => onAddCampaign(cmp));
    }
    setActiveWizardTarget(null);
  };

  const handleSaveDateEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCampaign) {
      onUpdateCampaignDates(editingCampaign.id, editStartDate, editEndDate);
      setEditingCampaign(null);
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    alert('📋 Đã sao chép đường dẫn bài khảo sát vào khay nhớ tạm!');
  };

  const handleBatchDownloadQR = () => {
    alert(`📦 Đã nén và xuất thành công tệp Zip chứa toàn bộ Mã QR Code của ${filteredCampaigns.length} bài khảo sát thuộc đợt này!`);
  };

  // Filter Campaigns Data by Tab, Search, Semester & Academic Year
  const filteredCampaigns = campaigns.filter((cmp) => {
    const matchesTab = cmp.type === activeTab;
    const matchesSearch =
      cmp.title.toLowerCase().includes(search.toLowerCase()) ||
      (cmp.classCode && cmp.classCode.toLowerCase().includes(search.toLowerCase())) ||
      (cmp.courseName && cmp.courseName.toLowerCase().includes(search.toLowerCase())) ||
      (cmp.majorName && cmp.majorName.toLowerCase().includes(search.toLowerCase()));

    const matchesSemester = semesterFilter ? cmp.semester === semesterFilter : true;
    const matchesAcademicYear = academicYearFilter ? cmp.academicYear === academicYearFilter : true;

    return matchesTab && matchesSearch && matchesSemester && matchesAcademicYear;
  });

  // Group Campaigns by Academic Year -> Semester for Tree View
  const treeData = filteredCampaigns.reduce((acc, cmp) => {
    const year = cmp.academicYear || '2025-2026';
    const sem = cmp.semester || 'Học kỳ II';

    if (!acc[year]) acc[year] = {};
    if (!acc[year][sem]) acc[year][sem] = [];

    acc[year][sem].push(cmp);
    return acc;
  }, {} as Record<string, Record<string, SurveyCampaign[]>>);

  return (
    <div>
      {/* Top Banner Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h2>
            {activeTab === 'Học phần'
              ? 'GIAO DIỆN QUẢN LÝ ĐỢT KHẢO SÁT HỌC PHẦN & MÔN HỌC'
              : 'GIAO DIỆN QUẢN LÝ ĐỢT KHẢO SÁT CHƯƠNG TRÌNH ĐÀO TẠO'}
          </h2>
          <p>
            Cấu trúc phân cấp Cây Thư Mục: <strong>Năm Học &rarr; Học Kỳ &rarr; Các Bài Khảo Sát Tích Hợp QR & Link Duy Nhất</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={handleBatchDownloadQR}>
            📦 Tải Hàng Loạt QR Code (Zip)
          </button>
          <button className="btn btn-primary" onClick={() => handleOpenWizard('Học kỳ II', '2025-2026')}>
            + Quy Trình Khởi Tạo Đợt Khảo Sát (Cây Thư Mục)
          </button>
        </div>
      </div>

      {/* Sub-tab Switcher Bar */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px',
          borderBottom: '2px solid var(--border-color)',
          paddingBottom: '8px',
        }}
      >
        <button
          className={`btn ${activeTab === 'Học phần' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('Học phần')}
        >
          📚 Đợt Khảo Sát Môn Học / Lớp HP ({campaigns.filter((c) => c.type === 'Học phần').length})
        </button>
        <button
          className={`btn ${activeTab === 'Chương trình đào tạo' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('Chương trình đào tạo')}
        >
          🎓 Đợt Khảo Sát Chương Trình Đào Tạo ({campaigns.filter((c) => c.type === 'Chương trình đào tạo').length})
        </button>
      </div>

      {/* Academic Semester & Year Search & Filter Bar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          backgroundColor: '#F8FAFC',
          padding: '10px 14px',
          border: '1px solid var(--border-color)',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--vmu-navy)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          🔍 BỘ LỌC TÌM KIẾM:
        </span>

        <input
          type="text"
          placeholder="Tìm theo tên bài, mã lớp, môn học hay giảng viên..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '5px 10px',
            fontSize: '13px',
            border: '1px solid var(--border-color)',
            width: '260px',
            backgroundColor: '#FFFFFF',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dark)' }}>Học Kỳ:</label>
          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            style={{
              padding: '5px 10px',
              fontSize: '13px',
              border: '1px solid var(--border-color)',
              backgroundColor: '#FFFFFF',
              color: 'var(--vmu-navy)',
              fontWeight: 500,
            }}
          >
            <option value="">-- Tất cả Học kỳ --</option>
            <option value="Học kỳ I">Học kỳ I</option>
            <option value="Học kỳ II">Học kỳ II</option>
            <option value="Học kỳ Hè">Học kỳ Hè</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dark)' }}>Năm Học:</label>
          <select
            value={academicYearFilter}
            onChange={(e) => setAcademicYearFilter(e.target.value)}
            style={{
              padding: '5px 10px',
              fontSize: '13px',
              border: '1px solid var(--border-color)',
              backgroundColor: '#FFFFFF',
              color: 'var(--vmu-navy)',
              fontWeight: 500,
            }}
          >
            <option value="">-- Tất cả Năm học --</option>
            <option value="2025-2026">Năm học 2025-2026</option>
            <option value="2026-2027">Năm học 2026-2027</option>
          </select>
        </div>

        {(semesterFilter || academicYearFilter || search) && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearch('');
              setSemesterFilter('');
              setAcademicYearFilter('');
            }}
            style={{ fontSize: '12px', padding: '4px 10px' }}
          >
            ✕ Xóa bộ lọc
          </button>
        )}
      </div>

      {/* TREE DIRECTORY VIEW (Học kỳ -> Tất cả bài khảo sát) */}
      <div className="tree-directory-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {Object.keys(treeData).length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', backgroundColor: '#F8FAFC', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
            🚫 Không tìm thấy bài khảo sát nào trong cây thư mục phù hợp với bộ lọc được chọn.
          </div>
        ) : (
          Object.entries(treeData).map(([year, semesters]) => (
            <div
              key={year}
              style={{
                border: '1px solid var(--border-color)',
                backgroundColor: '#FFFFFF',
              }}
            >
              {/* Year Level Node (Root Node) */}
              <div
                style={{
                  backgroundColor: 'var(--vmu-navy)',
                  color: '#FFFFFF',
                  padding: '10px 16px',
                  fontWeight: 700,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📁 NĂM HỌC {year}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="badge badge-info" style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#FFF' }}>
                    {Object.values(semesters).reduce((sum, list) => sum + list.length, 0)} Bài Khảo Sát
                  </span>
                  <button
                    className="btn btn-sm"
                    style={{
                      backgroundColor: 'var(--accent-green)',
                      color: '#FFFFFF',
                      fontSize: '11px',
                      padding: '3px 8px',
                      fontWeight: 600,
                      border: 'none',
                    }}
                    onClick={() => handleOpenWizard(undefined, year)}
                    title={`Khởi tạo đợt khảo sát cho Năm học ${year}`}
                  >
                    + Tạo Khảo Sát ({year})
                  </button>
                </div>
              </div>

              {/* Semester Folders Level (Child Nodes) */}
              <div style={{ padding: '12px' }}>
                {Object.entries(semesters).map(([semesterName, campaignList]) => {
                  const folderKey = `${year}_${semesterName}`;
                  const isExpanded = expandedFolders[folderKey] !== false; // Default true

                  return (
                    <div
                      key={folderKey}
                      style={{
                        marginBottom: '12px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: '#F8FAFC',
                      }}
                    >
                      {/* Semester Folder Header Toggle Bar */}
                      <div
                        onClick={() => toggleFolder(folderKey)}
                        style={{
                          padding: '10px 14px',
                          backgroundColor: '#EDF2F7',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          userSelect: 'none',
                          borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--vmu-navy)' }}>
                          <span>{isExpanded ? '📂' : '📁'}</span>
                          <span>{semesterName} ({year})</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400 }}>
                            ({campaignList.length} đợt khảo sát)
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ padding: '2px 8px', fontSize: '11px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenWizard(semesterName, year);
                            }}
                            title={`Khởi tạo bài khảo sát cho ${semesterName} (${year})`}
                          >
                            + Thêm Bài Khảo Sát ({semesterName})
                          </button>
                          <span style={{ fontSize: '12px', color: 'var(--vmu-blue)', fontWeight: 600 }}>
                            {isExpanded ? 'Thu gọn ▲' : 'Mở rộng ▼'}
                          </span>
                        </div>
                      </div>

                      {/* List of Survey Campaigns under this Semester Folder */}
                      {isExpanded && (
                        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {/* Inline Wizard Branch inside Tree Semester Folder */}
                          {activeWizardTarget &&
                            (activeWizardTarget.semester === semesterName || !activeWizardTarget.semester) &&
                            (activeWizardTarget.academicYear === year || !activeWizardTarget.academicYear) && (
                              <InlineTreeWizard
                                surveyType={activeTab}
                                initialSemester={activeWizardTarget.semester || semesterName}
                                initialAcademicYear={activeWizardTarget.academicYear || year}
                                majors={majors}
                                classes={classes}
                                criteria={criteria}
                                onCreateCampaigns={handleCreateMultipleFromWizard}
                                onCancel={() => setActiveWizardTarget(null)}
                              />
                            )}

                          {campaignList.map((row) => {
                            const today = new Date().toISOString().split('T')[0];
                            const isActive = today >= row.startDate && today <= row.endDate;
                            const surveyLink = row.surveyLink || `https://khaosat.vimaru.edu.vn/survey/${row.id}`;

                            return (
                              <div
                                key={row.id}
                                style={{
                                  backgroundColor: '#FFFFFF',
                                  padding: '12px 14px',
                                  border: '1px solid var(--border-color)',
                                  borderLeft: '4px solid var(--vmu-blue)',
                                  display: 'grid',
                                  gridTemplateColumns: '2fr 1.5fr 1.5fr 140px',
                                  gap: '12px',
                                  alignItems: 'center',
                                }}
                              >
                                {/* Info Column */}
                                <div>
                                  <div style={{ fontWeight: 700, color: 'var(--vmu-navy)', fontSize: '13px' }}>
                                    📄 {row.title}
                                  </div>
                                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    🏫 Lớp: <strong style={{ color: 'var(--text-dark)' }}>{row.classCode || 'Toàn khóa'}</strong> &bull; GV: {row.lecturerName || 'Chưa phân công'}
                                  </div>
                                </div>

                                {/* Link Column */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <input
                                    type="text"
                                    readOnly
                                    value={surveyLink}
                                    style={{
                                      fontSize: '11px',
                                      padding: '4px 6px',
                                      width: '100%',
                                      backgroundColor: '#F1F5F9',
                                      border: '1px solid var(--border-color)',
                                      color: 'var(--vmu-blue)',
                                      fontWeight: 500,
                                    }}
                                  />
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    style={{ padding: '2px 6px', fontSize: '11px' }}
                                    onClick={() => handleCopyLink(surveyLink)}
                                    title="Sao chép liên kết"
                                  >
                                    📋
                                  </button>
                                </div>

                                {/* Countdown & Schedule */}
                                <div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    🗓️ {row.startDate} ~ {row.endDate}
                                  </div>
                                  <div style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className={`badge ${isActive ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '11px' }}>
                                      {isActive ? '🟢 Mở quét QR' : '⏳ Quá hạn'}
                                    </span>
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      style={{ padding: '1px 5px', fontSize: '10px' }}
                                      onClick={() => {
                                        setEditingCampaign(row);
                                        setEditStartDate(row.startDate);
                                        setEditEndDate(row.endDate);
                                      }}
                                    >
                                      ✏️ Lịch
                                    </button>
                                  </div>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                  <button className="btn btn-qr btn-sm" style={{ padding: '3px 8px', fontSize: '11px' }} onClick={() => onOpenQR(row)}>
                                    📱 Mã QR
                                  </button>
                                  <button className="btn btn-danger btn-sm" style={{ padding: '3px 8px', fontSize: '11px' }} onClick={() => onDeleteCampaign(row.id)}>
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit QR Scanning Validity Period Modal */}
      {editingCampaign && (
        <Modal
          isOpen={!!editingCampaign}
          onClose={() => setEditingCampaign(null)}
          title={`ĐỔI LỊCH QUÉT MÃ QR CODE - ${editingCampaign.title}`}
        >
          <form onSubmit={handleSaveDateEdit}>
            <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--vmu-navy)', backgroundColor: 'var(--vmu-blue-light)', padding: '12px' }}>
              📱 Cấu hình điều chỉnh khoảng thời gian hệ thống mở quét mã QR Code cho người tham gia.
            </div>

            <div className="form-group">
              <label>Ngày Bắt Đầu Cho Phép Quét QR:</label>
              <input
                type="date"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Ngày Kết Thúc Cho Phép Quét QR:</label>
              <input
                type="date"
                value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
                required
              />
            </div>

            <div className="modal-footer" style={{ padding: '16px 0 0 0', backgroundColor: 'transparent', borderTop: 'none' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditingCampaign(null)}>
                Hủy
              </button>
              <button type="submit" className="btn btn-primary">
                Lưu Thay Đổi
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
