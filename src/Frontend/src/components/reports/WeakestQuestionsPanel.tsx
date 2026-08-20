import React from 'react';
import { AlertTriangle, Star } from 'lucide-react';
import type { QuestionRating } from '../../types';
import { scoreColor } from './theme';

interface WeakestQuestionsPanelProps {
  questions: QuestionRating[];
  totalResponses: number;
}

const ratingLabel = (score: number): string => {
  if (score >= 4.5) return 'Xuất sắc';
  if (score >= 4.0) return 'Tốt';
  if (score >= 3.0) return 'Trung bình';
  if (score > 0) return 'Cần cải thiện';
  return 'Chưa có điểm';
};

/** Top tiêu chí (câu hỏi) yếu nhất toàn trường — gợi ý ưu tiên cải tiến. */
export const WeakestQuestionsPanel: React.FC<WeakestQuestionsPanelProps> = ({
  questions,
  totalResponses,
}) => {
  if (questions.length === 0) {
    return (
      <div className="reports-chart-empty">
        Chưa đủ dữ liệu để xác định tiêu chí yếu nhất (cần ≥ 10 phiếu trả lời/câu).
      </div>
    );
  }

  return (
    <div className="reports-weakest">
      <div className="reports-weakest-hint">
        <AlertTriangle className="operation-icon" aria-hidden="true" />
        <span>
          Gộp từ {totalResponses.toLocaleString('vi-VN')} phiếu — ưu tiên cải tiến các tiêu chí có điểm thấp nhất.
        </span>
      </div>
      <ol className="reports-weakest-list">
        {questions.map((question, index) => {
          const color = scoreColor(question.averageScore);
          const total = question.totalAnswers;
          return (
            <li key={question.questionId} className="reports-weakest-item">
              <span className="reports-weakest-rank">{index + 1}</span>
              <div className="reports-weakest-body">
                <div className="reports-weakest-head">
                  <span className="reports-weakest-text" title={question.questionText}>
                    {question.questionText}
                  </span>
                  <span className="reports-weakest-score" style={{ color }}>
                    <Star style={{ width: 12, height: 12, fill: 'currentColor' }} aria-hidden="true" />
                    {question.averageScore > 0 ? question.averageScore.toFixed(2) : '—'}
                    <small> · {ratingLabel(question.averageScore)}</small>
                  </span>
                </div>
                {/* Bộ trộn nhiều thang nên phải nói rõ điểm này đo bằng thang nào. */}
                {question.answerScaleName && (
                  <span className="reports-weakest-scale">{question.answerScaleName}</span>
                )}
                <div className="reports-weakest-dist" aria-label={`Phân bố ${total} lượt trả lời`}>
                  {[1, 2, 3, 4, 5].map((value) => {
                    const option = question.optionDistribution?.find((o) => o.value === value);
                    const count = option?.count ?? 0;
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <span
                        key={value}
                        className="reports-weakest-dist-seg"
                        title={`Mức ${value}: ${count} lượt (${pct.toFixed(0)}%)`}
                        style={{ width: `${pct}%`, background: color }}
                      />
                    );
                  })}
                </div>
                <span className="reports-weakest-answers">{total} lượt trả lời</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
