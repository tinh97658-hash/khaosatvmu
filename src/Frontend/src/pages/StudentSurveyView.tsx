import React, { useState } from 'react';
import type { Criterion } from '../types';

interface StudentSurveyViewProps {
  criteria: Criterion[];
  onCloseStudentView: () => void;
  onSurveySubmitted: () => void;
}

export const StudentSurveyView: React.FC<StudentSurveyViewProps> = ({
  criteria,
  onCloseStudentView,
  onSurveySubmitted,
}) => {
  const [studentId, setStudentId] = useState('SV63-10254');
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const activeCriteria = criteria.filter((c) => c.status === 'Kích hoạt');

  const handleRatingSelect = (criterionId: string, score: number) => {
    setRatings((prev) => ({ ...prev, [criterionId]: score }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.keys(ratings).length < activeCriteria.length) {
      alert('Vui lòng đánh giá đủ tất cả các tiêu chí trong phiếu khảo sát!');
      return;
    }
    setSubmitted(true);
    onSurveySubmitted();
  };

  if (submitted) {
    return (
      <div className="student-view-container">
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
          <h2 style={{ color: 'var(--vmu-navy)', fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>
            NỘP BÀI KHẢO SÁT THÀNH CÔNG!
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
            Cảm ơn bạn đã quét mã QR và đóng góp ý kiến đánh giá chất lượng học phần tại Trường Đại học Hàng hải Việt Nam (VMU).
          </p>
          <div className="student-badge-info" style={{ color: 'var(--vmu-navy)', backgroundColor: 'var(--vmu-blue-light)' }}>
            <span>Mã lượt khảo sát: #VMU-2026-{Math.floor(Math.random() * 89999 + 10000)}</span>
          </div>

          <div style={{ marginTop: '32px' }}>
            <button className="btn btn-primary" onClick={onCloseStudentView}>
              &larr; Trở Về Trang Quản Trị Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="student-view-container">
      {/* Top Banner / Student Context Header */}
      <div className="student-header">
        <div style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--vmu-gold)' }}>
          TRƯỜNG ĐẠI HỌC HÀNG HẢI VIỆT NAM &bull; KVALITET
        </div>
        <h1>PHIẾU ĐÁNH GIÁ KẾT QUẢ HỌC PHẦN (QUÉT QR CODE)</h1>
        <p>Ý kiến của bạn góp phần trực tiếp nâng cao chất lượng đào tạo và giảng dạy tại VMU</p>

        <div className="student-badge-info">
          <span>📚 Lớp HP: IT201.01 - Lập trình Web</span>
          <span>👨‍🏫 GV: TS. Nguyễn Văn A</span>
        </div>
      </div>

      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px', backgroundColor: '#FFFBEB', borderColor: '#FCD34D' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#92400E' }}>
          <span style={{ fontSize: '18px' }}>📱</span>
          <div>
            <strong>Giao diện quét mã QR di động:</strong> Mức 1: Rất không đồng ý &rarr; Mức 5: Rất đồng ý. Hãy chọn đánh giá trung thực cho từng câu hỏi.
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Mã Sinh Viên / Mã Định Danh (Ẩn danh đối soát):</label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="Nhập mã sinh viên..."
              required
            />
          </div>
        </div>

        {/* Survey Questions List */}
        {activeCriteria.map((c, index) => {
          const currentRating = ratings[c.id] || 0;
          return (
            <div key={c.id} className="survey-question-card">
              <div className="survey-question-title">
                Câu {index + 1}. [{c.groupName}] {c.question}
              </div>

              <div className="likert-options">
                {[1, 2, 3, 4, 5].map((score) => {
                  const labels = [
                    'Rất không đồng ý',
                    'Không đồng ý',
                    'Phân vân / Trung lập',
                    'Đồng ý',
                    'Rất đồng ý',
                  ];
                  const isSelected = currentRating === score;
                  return (
                    <div
                      key={score}
                      className={`likert-option ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleRatingSelect(c.id, score)}
                    >
                      <div className="likert-score">{score}</div>
                      <div className="likert-label">{labels[score - 1]}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Additional Feedback */}
        <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Ý kiến đóng góp / Gợi ý cải tiến khác cho Học phần & Nhà trường:</label>
            <textarea
              rows={4}
              placeholder="Nhập ý kiến riêng của bạn về cơ sở vật chất, bài giảng, bài tập lớn..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCloseStudentView}
          >
            &larr; Thoát Giao Diện Quét QR
          </button>
          <button type="submit" className="btn btn-primary" style={{ padding: '12px 28px', fontSize: '15px' }}>
            Nộp Bài Đánh Giá 🚀
          </button>
        </div>
      </form>
    </div>
  );
};
