import React, { useState } from 'react';
import type { SurveyCampaign, CourseClass, Criterion, Major } from '../types';

interface InlineTreeWizardProps {
  surveyType: 'Học phần' | 'Chương trình đào tạo';
  initialSemester?: string;
  initialAcademicYear?: string;
  majors: Major[];
  classes: CourseClass[];
  criteria: Criterion[];
  onCreateCampaigns: (newCampaigns: SurveyCampaign[]) => void;
  onCancel: () => void;
}

export const InlineTreeWizard: React.FC<InlineTreeWizardProps> = ({
  surveyType,
  initialSemester = 'Học kỳ II',
  initialAcademicYear = '2025-2026',
  majors,
  classes,
  criteria,
  onCreateCampaigns,
  onCancel,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1 States
  const [semester, setSemester] = useState(initialSemester);
  const [academicYear, setAcademicYear] = useState(initialAcademicYear);
  const [campaignTitle, setCampaignTitle] = useState(
    surveyType === 'Học phần'
      ? `Đợt Khảo sát Đánh giá Chất lượng Giảng dạy Học phần ${initialSemester} (${initialAcademicYear})`
      : `Đợt Khảo sát Đánh giá Chương trình Đào tạo Ngành ${initialAcademicYear}`
  );
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  // Step 2 States
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(
    classes.map((c) => c.id)
  );
  const [selectedMajorId, setSelectedMajorId] = useState<string>(majors[0]?.id || '');
  const [isImported, setIsImported] = useState(false);

  // Step 3 States
  const [selectedCriterionTemplate, setSelectedCriterionTemplate] = useState<string>(
    surveyType === 'Học phần' ? 'Mẫu tiêu chuẩn KHP VMU 2026' : 'Mẫu chuẩn đầu ra PLO CTĐT 2026'
  );

  // Excel Import Simulation
  const handleSimulateExcelImport = () => {
    setIsImported(true);
    alert('📥 Đã Import thành công 5 Lớp Học Phần và 10 Nhóm lớp (N01, N02) từ tệp Excel Dữ liệu Đào tạo VMU!');
  };

  const handleToggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedClassIds(classes.map((c) => c.id));
    } else {
      setSelectedClassIds([]);
    }
  };

  const handleToggleClass = (id: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Generate campaigns and add directly to tree
  const handleCompleteWizard = () => {
    const timestamp = Date.now();
    const generated: SurveyCampaign[] = [];

    if (surveyType === 'Học phần') {
      const selectedClasses = classes.filter((c) => selectedClassIds.includes(c.id));

      selectedClasses.forEach((cls, idx) => {
        const groups = cls.groups || [];
        if (groups.length === 0) {
          const id = `cmp-wiz-${timestamp}-${idx}`;
          const surveyLink = `https://khaosat.vimaru.edu.vn/survey/${id}`;
          const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(surveyLink)}`;

          generated.push({
            id,
            title: `Khảo sát Đánh giá Lớp HP ${cls.code} - ${cls.courseName}`,
            type: 'Học phần',
            semester,
            academicYear,
            courseId: cls.courseId,
            courseCode: cls.courseCode,
            courseName: cls.courseName,
            classId: cls.id,
            classCode: cls.code,
            lecturerName: cls.lecturerName,
            startDate,
            endDate,
            status: 'Đang diễn ra',
            targetAudience: `Sinh viên Lớp HP ${cls.code} (${cls.lecturerName}) - ${semester} ${academicYear}`,
            surveyLink,
            qrCodeUrl,
            totalTargetResponses: cls.totalStudents,
            actualResponses: cls.completedResponses || 0,
          });
        } else {
          groups.forEach((grp, gIdx) => {
            const id = `cmp-wiz-${timestamp}-${idx}-${gIdx}`;
            const surveyLink = `https://khaosat.vimaru.edu.vn/survey/${id}`;
            const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(surveyLink)}`;

            generated.push({
              id,
              title: `Khảo sát Đánh giá Lớp HP ${grp.fullGroupCode} - ${cls.courseName}`,
              type: 'Học phần',
              semester,
              academicYear,
              courseId: cls.courseId,
              courseCode: cls.courseCode,
              courseName: `${cls.courseName} [Nhóm ${grp.groupCode}]`,
              classId: cls.id,
              classCode: grp.fullGroupCode,
              lecturerName: grp.lecturerName,
              startDate,
              endDate,
              status: 'Đang diễn ra',
              targetAudience: `Sinh viên Nhóm ${grp.groupCode} (${grp.lecturerName}) - ${semester} ${academicYear}`,
              surveyLink,
              qrCodeUrl,
              totalTargetResponses: grp.studentCount,
              actualResponses: grp.completedResponses || 0,
            });
          });
        }
      });
    } else {
      const selectedMajor = majors.find((m) => m.id === selectedMajorId) || majors[0];
      const id = `cmp-wiz-prog-${timestamp}`;
      const surveyLink = `https://khaosat.vimaru.edu.vn/survey/${id}`;
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(surveyLink)}`;

      generated.push({
        id,
        title: campaignTitle || `Khảo sát Đánh giá Chương trình Đào tạo Ngành ${selectedMajor?.name || 'CNTT'}`,
        type: 'Chương trình đào tạo',
        semester,
        academicYear,
        majorId: selectedMajor?.id,
        majorName: selectedMajor?.name,
        startDate,
        endDate,
        status: 'Đang diễn ra',
        targetAudience: `Sinh viên khóa cuối & Cựu sinh viên Ngành ${selectedMajor?.name}`,
        surveyLink,
        qrCodeUrl,
        totalTargetResponses: 150,
        actualResponses: 0,
      });
    }

    onCreateCampaigns(generated);
    alert(`🎉 Đã tự động khởi tạo thành công ${generated.length} bài khảo sát trực tiếp vào Cây Thư Mục!`);
  };

  return (
    <div
      style={{
        border: '2px dashed var(--vmu-blue)',
        backgroundColor: '#F0F7FF',
        padding: '16px',
        margin: '8px 0 16px 0',
        boxShadow: '0 4px 12px rgba(0, 32, 96, 0.08)',
        position: 'relative',
      }}
    >
      {/* Node Header Label */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--vmu-navy)',
          color: '#FFFFFF',
          padding: '8px 12px',
          fontWeight: 700,
          fontSize: '13px',
          marginBottom: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🌱 WORKFLOW KHỞI TẠO TRỰC TIẾP TRÊN CÂY:</span>
          <span style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>
            {semester} ({academicYear})
          </span>
        </div>
        <button
          onClick={onCancel}
          style={{
            background: 'none',
            border: 'none',
            color: '#FFFFFF',
            fontSize: '14px',
            cursor: 'pointer',
            fontWeight: 700,
          }}
          title="Hủy khởi tạo trên cây"
        >
          ✕ Đóng Workflow
        </button>
      </div>

      {/* Step Indicator Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '16px',
          backgroundColor: '#FFFFFF',
          padding: '10px 14px',
          border: '1px solid var(--border-color)',
        }}
      >
        {[
          { num: 1, label: '1. Thời gian & Tên đợt' },
          { num: 2, label: surveyType === 'Học phần' ? '2. Import / Chọn Lớp HP' : '2. Chọn Ngành' },
          { num: 3, label: '3. Chọn Tiêu chí' },
          { num: 4, label: '4. Sinh QR & Link Cây' },
        ].map((s) => (
          <div
            key={s.num}
            style={{
              fontWeight: step === s.num ? 700 : 500,
              color: step === s.num ? 'var(--vmu-blue)' : step > s.num ? 'var(--accent-green)' : 'var(--text-muted)',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: step === s.num ? 'var(--vmu-blue)' : step > s.num ? 'var(--accent-green)' : '#CBD5E1',
                color: '#FFF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              {step > s.num ? '✓' : s.num}
            </span>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* STEP 1: Basic Info & Duration */}
      {step === 1 && (
        <div style={{ backgroundColor: '#FFFFFF', padding: '14px', border: '1px solid var(--border-color)' }}>
          <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--vmu-navy)', backgroundColor: 'var(--vmu-blue-light)', padding: '8px 12px' }}>
            📌 <strong>Bước 1:</strong> Thiết lập đợt khảo sát cho <strong>{semester} ({academicYear})</strong> và thời gian quét QR Code.
          </div>

          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600 }}>Tên Tổng Thể Đợt Khảo Sát:</label>
            <input
              type="text"
              value={campaignTitle}
              onChange={(e) => setCampaignTitle(e.target.value)}
              style={{ width: '100%', padding: '6px 10px', fontSize: '13px', border: '1px solid var(--border-color)' }}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} className="form-group">
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Học Kỳ Được Chọn:</label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', fontSize: '13px', border: '1px solid var(--border-color)' }}
              >
                <option value="Học kỳ I">Học kỳ I</option>
                <option value="Học kỳ II">Học kỳ II</option>
                <option value="Học kỳ Hè">Học kỳ Hè</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Năm Học Được Chọn:</label>
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', fontSize: '13px', border: '1px solid var(--border-color)' }}
              >
                <option value="2025-2026">2025-2026</option>
                <option value="2026-2027">2026-2027</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} className="form-group">
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Ngày Bắt Đầu Cho Phép Quét QR:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', fontSize: '13px', border: '1px solid var(--border-color)' }}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Ngày Kết Thúc Cho Phép Quét QR:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', fontSize: '13px', border: '1px solid var(--border-color)' }}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
            <button className="btn btn-secondary btn-sm" onClick={onCancel}>
              Hủy
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setStep(2)}>
              Tiếp Theo: Import Lớp HP &rarr;
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Import & Select Classes / Majors */}
      {step === 2 && (
        <div style={{ backgroundColor: '#FFFFFF', padding: '14px', border: '1px solid var(--border-color)' }}>
          {surveyType === 'Học phần' ? (
            <>
              <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--vmu-navy)', backgroundColor: 'var(--vmu-blue-light)', padding: '8px 12px' }}>
                📥 <strong>Bước 2:</strong> Import danh sách Lớp HP của {semester} ({academicYear}) từ Excel hoặc tích chọn bên dưới:
              </div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                <button className="btn btn-secondary btn-sm" onClick={handleSimulateExcelImport}>
                  📥 Import Tệp Excel (.xlsx) Lớp HP & Giảng Viên
                </button>
                {isImported && (
                  <span className="badge badge-success" style={{ alignSelf: 'center', fontSize: '11px' }}>
                    ✓ Đã kết nối dữ liệu Excel Đào tạo
                  </span>
                )}
              </div>

              <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-color)', marginBottom: '14px' }}>
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '6px', textAlign: 'center', width: '35px' }}>
                        <input
                          type="checkbox"
                          checked={selectedClassIds.length === classes.length}
                          onChange={handleToggleSelectAll}
                        />
                      </th>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Mã Lớp HP</th>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Tên Học Phần</th>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Nhóm & GV</th>
                      <th style={{ padding: '6px', textAlign: 'center' }}>Sĩ số</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map((cls) => {
                      const isSelected = selectedClassIds.includes(cls.id);
                      return (
                        <tr key={cls.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ textAlign: 'center', padding: '6px' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleClass(cls.id)}
                            />
                          </td>
                          <td style={{ padding: '6px', fontFamily: 'monospace', fontWeight: 600 }}>{cls.code}</td>
                          <td style={{ padding: '6px' }}>{cls.courseName}</td>
                          <td style={{ padding: '6px', fontSize: '11px' }}>
                            {cls.groups && cls.groups.length > 0 ? (
                              cls.groups.map((g) => (
                                <span key={g.id} className="badge badge-info" style={{ marginRight: '3px', fontSize: '10px' }}>
                                  {g.groupCode}: {g.lecturerName}
                                </span>
                              ))
                            ) : (
                              <span>{cls.lecturerName}</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', padding: '6px' }}>{cls.totalStudents} SV</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--vmu-navy)', backgroundColor: 'var(--vmu-blue-light)', padding: '8px 12px' }}>
                🎓 <strong>Bước 2:</strong> Chọn Ngành Đào Tạo để khởi tạo khảo sát CTĐT:
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Ngành Học Đánh Giá:</label>
                <select
                  value={selectedMajorId}
                  onChange={(e) => setSelectedMajorId(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', fontSize: '13px', border: '1px solid var(--border-color)' }}
                >
                  {majors.map((m) => (
                    <option key={m.id} value={m.id}>
                      [{m.code}] {m.name} - Khoa: {m.facultyName}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setStep(1)}>
              &larr; Quay lại
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                if (surveyType === 'Học phần' && selectedClassIds.length === 0) {
                  alert('Vui lòng chọn ít nhất 1 Lớp HP!');
                  return;
                }
                setStep(3);
              }}
            >
              Tiếp Theo: Chọn Tiêu Chí &rarr;
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Select Survey Questionnaire Template */}
      {step === 3 && (
        <div style={{ backgroundColor: '#FFFFFF', padding: '14px', border: '1px solid var(--border-color)' }}>
          <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--vmu-navy)', backgroundColor: 'var(--vmu-blue-light)', padding: '8px 12px' }}>
            📋 <strong>Bước 3:</strong> Chọn Bộ tiêu chí câu hỏi đánh giá chuẩn hóa được áp dụng cho đợt này:
          </div>

          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600 }}>Mẫu Phiếu Khảo Sát Khung Tiêu Chí:</label>
            <select
              value={selectedCriterionTemplate}
              onChange={(e) => setSelectedCriterionTemplate(e.target.value)}
              style={{ width: '100%', padding: '6px 10px', fontSize: '13px', border: '1px solid var(--border-color)' }}
            >
              <option value="Mẫu tiêu chuẩn KHP VMU 2026">
                Mẫu Tiêu Chuẩn Đánh Giá Học Phần Likert 1-5 (Nội dung, Giảng viên, CSVC)
              </option>
              <option value="Mẫu chuẩn đầu ra PLO CTĐT 2026">
                Mẫu Đánh Giá Chuẩn Đầu Ra (PLO) & Chương Trình Đào Tạo Ngành
              </option>
            </select>
          </div>

          <div style={{ backgroundColor: '#F8FAFC', padding: '10px', border: '1px dashed var(--border-color)', marginBottom: '14px' }}>
            <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--vmu-navy)', marginBottom: '6px' }}>
              Danh sách {criteria.length} tiêu chí câu hỏi sẽ nhúng vào Mã QR trên Cây Thư Mục:
            </div>
            <ul style={{ paddingLeft: '18px', margin: 0, fontSize: '11px', color: 'var(--text-dark)' }}>
              {criteria.slice(0, 4).map((c) => (
                <li key={c.id} style={{ marginBottom: '3px' }}>
                  <strong>[{c.code}]</strong> {c.question}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setStep(2)}>
              &larr; Quay lại
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setStep(4)}>
              Tiếp Theo: Sinh Mã QR & Link &rarr;
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Confirm and Generate Tree Nodes */}
      {step === 4 && (
        <div style={{ backgroundColor: '#FFFFFF', padding: '14px', border: '1px solid var(--border-color)' }}>
          <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--vmu-navy)', backgroundColor: '#E0F2FE', padding: '8px 12px' }}>
            ⚡ <strong>Bước 4 (Hoàn tất):</strong> Xác nhận để tự động sinh các nút đợt khảo sát mới trực tiếp vào nhánh Cây Thư Mục.
          </div>

          <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderLeft: '4px solid var(--vmu-blue)', marginBottom: '14px' }}>
            <div style={{ fontWeight: 700, color: 'var(--vmu-navy)', fontSize: '14px', marginBottom: '6px' }}>
              📊 TỔNG QUAN ĐỢT KHẢO SÁT SẼ KHỞI TẠO TRÊN CÂY:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px' }}>
              <div>• <strong>Tên đợt:</strong> {campaignTitle}</div>
              <div>• <strong>Học kỳ & Năm:</strong> {semester} ({academicYear})</div>
              <div>• <strong>Lịch quét QR:</strong> {startDate} ~ {endDate}</div>
              <div>• <strong>Bộ tiêu chí:</strong> {selectedCriterionTemplate}</div>
              <div>• <strong>Số lớp/nhóm được tạo:</strong> {selectedClassIds.length} đợt khảo sát</div>
              <div>• <strong>Vị trí nhúng:</strong> <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>Thư mục {semester} ({academicYear})</span></div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setStep(3)}>
              &larr; Quay lại
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleCompleteWizard}>
              🚀 Khởi Tạo & Tự Động Sinh Nhánh Cây Thư Mục
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
