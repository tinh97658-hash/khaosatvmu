import React, { useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  CircleAlert,
  Send,
  Smartphone,
  UserRound,
} from 'lucide-react';
import type { Criterion } from '../types';
import '../styles/survey-operations.css';

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
  const [validationError, setValidationError] = useState<string | null>(null);

  const activeCriteria = criteria.filter((c) => c.status === 'Kích hoạt');

  const handleRatingSelect = (criterionId: string, score: number) => {
    setRatings((prev) => ({ ...prev, [criterionId]: score }));
    setValidationError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.keys(ratings).length < activeCriteria.length) {
      setValidationError('Vui lòng đánh giá đầy đủ tất cả tiêu chí trước khi nộp phiếu.');
      return;
    }
    setSubmitted(true);
    onSurveySubmitted();
  };

  if (submitted) {
    return (
      <main className="survey-operations-page student-survey">
        <section className="student-success" aria-live="polite">
          <div className="student-success-mark">
            <CheckCircle2 aria-hidden="true" />
          </div>
          <h2>Nộp bài khảo sát thành công</h2>
          <p>
            Cảm ơn bạn đã quét mã QR và đóng góp ý kiến đánh giá chất lượng học phần tại Trường Đại học Hàng hải Việt Nam (VMU).
          </p>
          <div className="student-submission-code">
            Mã lượt khảo sát: #VMU-2026-{Math.floor(Math.random() * 89999 + 10000)}
          </div>
          <button className="btn btn-primary" onClick={onCloseStudentView}>
            <ArrowLeft className="operation-icon" aria-hidden="true" />
            Trở về trang quản trị
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="survey-operations-page student-survey">
      <header className="student-survey-header">
        <div className="student-survey-eyebrow">Trường Đại học Hàng hải Việt Nam</div>
        <h1>Phiếu đánh giá kết quả học phần</h1>
        <p>Ý kiến của bạn góp phần trực tiếp nâng cao chất lượng đào tạo và giảng dạy tại VMU</p>

        <div className="student-context">
          <span><BookOpen className="operation-icon" aria-hidden="true" /> Lớp HP: IT201.01 - Lập trình Web</span>
          <span><UserRound className="operation-icon" aria-hidden="true" /> GV: TS. Nguyễn Văn A</span>
        </div>
      </header>

      <div className="student-survey-notice">
        <Smartphone className="operation-icon" aria-hidden="true" />
        <div>
          <strong>Thang đánh giá:</strong> Mức 1 là rất không đồng ý, mức 5 là rất đồng ý. Hãy chọn đánh giá cho từng câu hỏi.
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <section className="student-identity">
          <div className="form-group">
            <label htmlFor="student-id">Mã sinh viên / mã định danh đối soát</label>
            <input
              id="student-id"
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="Nhập mã sinh viên..."
              required
            />
          </div>
        </section>

        {activeCriteria.map((c, index) => {
          const currentRating = ratings[c.id] || 0;
          return (
            <section key={c.id} className="student-survey-question">
              <div className="student-question-title" id={`question-${c.id}`}>
                Câu {index + 1}. [{c.groupName}] {c.question}
              </div>

              <div className="student-likert-options" role="radiogroup" aria-labelledby={`question-${c.id}`}>
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
                    <button
                      type="button"
                      key={score}
                      className={`student-likert-option ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => handleRatingSelect(c.id, score)}
                      role="radio"
                      aria-checked={isSelected}
                    >
                      <span className="student-likert-score">{score}</span>
                      <span className="student-likert-label">{labels[score - 1]}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}

        {validationError && (
          <div className="operations-feedback operations-feedback--error student-validation" role="alert">
            <CircleAlert aria-hidden="true" />
            <span>{validationError}</span>
          </div>
        )}

        <section className="student-feedback">
          <div className="form-group">
            <label htmlFor="student-feedback">Ý kiến đóng góp hoặc gợi ý cải tiến</label>
            <textarea
              id="student-feedback"
              rows={4}
              placeholder="Nhập ý kiến riêng của bạn về cơ sở vật chất, bài giảng, bài tập lớn..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </div>
        </section>

        <div className="student-survey-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCloseStudentView}
          >
            <ArrowLeft className="operation-icon" aria-hidden="true" />
            Thoát phiếu khảo sát
          </button>
          <button type="submit" className="btn btn-primary">
            <Send className="operation-icon" aria-hidden="true" />
            Nộp bài đánh giá
          </button>
        </div>
      </form>
    </main>
  );
};
