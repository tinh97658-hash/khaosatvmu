import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Info,
  LoaderCircle,
  Send,
  UserRound,
} from 'lucide-react';
import { ApiError } from '../services/apiClient';
import { publicSurveyApi, surveyErrorMessage } from '../services/surveyApi';
import type { PublicSurvey } from '../types';
import '../styles/public-survey.css';

const maximumCommentLength = 1000;

/** Số câu hỏi hiển thị trên mỗi trang, tránh phiếu 30 câu thành một trang cuộn dài. */
const questionsPerPage = 10;

interface PublicSurveyPageProps {
  linkToken: string;
}

function messageFrom(error: unknown): string {
  return error instanceof ApiError ? surveyErrorMessage(error.errorCode) : surveyErrorMessage(null);
}

function formatRange(startTime: string, endTime: string): string {
  const formatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  return `${formatter.format(new Date(startTime))} → ${formatter.format(new Date(endTime))}`;
}

/** Dưới ngưỡng này thì đổi bảng ma trận sang từng thẻ câu hỏi cho dễ bấm. */
const narrowScreenQuery = '(max-width: 760px)';

export const PublicSurveyPage: React.FC<PublicSurveyPageProps> = ({ linkToken }) => {
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(narrowScreenQuery).matches
  );
  const [survey, setSurvey] = useState<PublicSurvey | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [comments, setComments] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const questionsTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia(narrowScreenQuery);
    const handleChange = (event: MediaQueryListEvent) => setIsNarrow(event.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const loadedSurvey = await publicSurveyApi.survey(linkToken);
        setSurvey(loadedSurvey);
        setLoadError(null);

        // Khôi phục bài làm từ LocalStorage nếu có
        try {
          const draftRaw = localStorage.getItem(`survey_draft_${linkToken}`);
          if (draftRaw) {
            const draft = JSON.parse(draftRaw);
            if (draft.answers) setAnswers(draft.answers);
            if (draft.comments) setComments(draft.comments);
          }
        } catch {
          // Bỏ qua nếu localStorage bị ngắt hoặc lỗi parse
        }
      } catch (error) {
        setLoadError(messageFrom(error));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [linkToken]);

  // Tự động lưu tiến độ vào LocalStorage
  useEffect(() => {
    if (!survey || submitted) return;
    try {
      if (Object.keys(answers).length > 0 || comments.trim()) {
        localStorage.setItem(
          `survey_draft_${linkToken}`,
          JSON.stringify({ answers, comments })
        );
      }
    } catch {
      // Bỏ qua lỗi truy cập localStorage
    }
  }, [answers, comments, linkToken, survey, submitted]);

  const answeredCount = useMemo(
    () => (survey ? survey.questions.filter((q) => answers[q.questionId] !== undefined).length : 0),
    [survey, answers]
  );
  const totalQuestions = survey?.questions.length ?? 0;
  const progress = totalQuestions === 0 ? 0 : Math.round((answeredCount / totalQuestions) * 100);

  const pageCount = Math.max(1, Math.ceil(totalQuestions / questionsPerPage));
  const currentPage = Math.min(pageIndex, pageCount - 1);
  const firstQuestionIndex = currentPage * questionsPerPage;
  const pageQuestions = useMemo(
    () => survey?.questions.slice(firstQuestionIndex, firstQuestionIndex + questionsPerPage) ?? [],
    [survey, firstQuestionIndex]
  );
  const isLastPage = currentPage === pageCount - 1;

  /** Trang nào còn câu bỏ trống thì được đánh dấu trên thanh số trang. */
  const incompletePages = useMemo(() => {
    if (!survey) return [] as boolean[];
    return Array.from({ length: pageCount }, (_, page) =>
      survey.questions
        .slice(page * questionsPerPage, page * questionsPerPage + questionsPerPage)
        .some((question) => answers[question.questionId] === undefined)
    );
  }, [survey, answers, pageCount]);

  const goToPage = (page: number) => {
    setPageIndex(Math.min(Math.max(page, 0), pageCount - 1));
    questionsTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!survey || submitting) return;

    if (answeredCount < totalQuestions) {
      setSubmitError('Vui lòng trả lời đầy đủ tất cả câu hỏi trước khi nộp.');
      // Đưa người dùng tới ngay trang còn câu bỏ trống, vì khi phân trang họ
      // không nhìn thấy câu thiếu nằm ở đâu.
      const firstIncomplete = incompletePages.indexOf(true);
      if (firstIncomplete >= 0) goToPage(firstIncomplete);
      return;
    }

    setSubmitting(true);
    try {
      await publicSurveyApi.submit(linkToken, {
        answers: survey.questions.map((question) => ({
          questionId: question.questionId,
          selectedValue: answers[question.questionId],
        })),
        additionalComments: comments.trim() ? comments.trim() : null,
      });
      setSubmitted(true);
      setSubmitError(null);

      // Xóa bản nháp khi nộp bài thành công
      try {
        localStorage.removeItem(`survey_draft_${linkToken}`);
      } catch {
        // Bỏ qua
      }
    } catch (error) {
      setSubmitError(messageFrom(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="public-survey">
        <div className="public-survey-state" role="status">
          <LoaderCircle className="auth-spin" aria-hidden="true" />
          <span>Đang tải phiếu khảo sát...</span>
        </div>
      </main>
    );
  }

  if (loadError || !survey) {
    return (
      <main className="public-survey">
        <div className="public-survey-state public-survey-state--error" role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{loadError ?? 'Không tìm thấy phiếu khảo sát.'}</span>
        </div>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="public-survey">
        <section className="public-survey-card public-survey-success" aria-live="polite">
          <CheckCircle2 aria-hidden="true" />
          <h1>Đã ghi nhận phiếu khảo sát</h1>
          <p>
            Cảm ơn bạn đã đánh giá lớp <strong>{survey.sectionName}</strong> - {survey.courseName}.
            Ý kiến của bạn được ghi nhận ẩn danh.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="public-survey">
      <section className="public-survey-card">
        <header className="public-survey-header">
          <h1>{survey.templateName}</h1>
          <p>Ý kiến của bạn rất quan trọng đối với chúng tôi.</p>

          <div className="public-survey-context">
            <span>
              <BookOpen aria-hidden="true" />
              {survey.courseCode} - {survey.courseName}
            </span>
            <span>
              <ClipboardList aria-hidden="true" />
              Lớp học phần: <strong>{survey.sectionName}</strong>
            </span>
            <span>
              <UserRound aria-hidden="true" />
              Giảng viên: <strong>{survey.lecturerName || 'Chưa phân công'}</strong>
            </span>
            <span>
              <CalendarDays aria-hidden="true" />
              {survey.semesterName} ({survey.academicYearName})
            </span>
          </div>
        </header>

        <div className="public-survey-note">
          <Info aria-hidden="true" />
          <div>
            <strong>Hướng dẫn</strong>
            <p>
              Vui lòng chọn một mức từ {survey.answerOptions[0]?.value ?? 1} đến{' '}
              {survey.answerOptions[survey.answerOptions.length - 1]?.value ?? 5} cho mỗi câu hỏi.
              Phiếu mở trong khoảng {formatRange(survey.startTime, survey.endTime)}.
            </p>
          </div>
        </div>

        {!survey.isOpen && (
          <div className="public-survey-alert" role="alert">
            <CircleAlert aria-hidden="true" />
            <span>Phiếu khảo sát chưa mở hoặc đã hết hạn nên không thể nộp bài.</span>
          </div>
        )}

        <div className="public-survey-progress">
          <span>
            {answeredCount}/{totalQuestions} câu hỏi
          </span>
          <div className="public-survey-progress-bar">
            <span style={{ width: `${progress}%` }} />
          </div>
          <span>{progress}% hoàn thành</span>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)}>
          <div ref={questionsTopRef} />

          {pageCount > 1 && (
            <nav className="public-survey-pager" aria-label="Phân trang câu hỏi">
              <span className="public-survey-pager-status">
                Câu {firstQuestionIndex + 1}-{firstQuestionIndex + pageQuestions.length}/
                {totalQuestions}
              </span>
              <div className="public-survey-pager-pages">
                {Array.from({ length: pageCount }, (_, page) => (
                  <button
                    type="button"
                    key={page}
                    className={[
                      'public-survey-pager-page',
                      page === currentPage ? 'public-survey-pager-page--current' : '',
                      incompletePages[page] ? 'public-survey-pager-page--incomplete' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-current={page === currentPage ? 'page' : undefined}
                    aria-label={`Trang ${page + 1}${incompletePages[page] ? ' (còn câu chưa trả lời)' : ''}`}
                    onClick={(event) => {
                      event.preventDefault();
                      goToPage(page);
                    }}
                  >
                    {page + 1}
                  </button>
                ))}
              </div>
            </nav>
          )}

          {isNarrow ? (
            <ol className="public-survey-cards">
              {pageQuestions.map((question, index) => (
                <li className="public-survey-question-card" key={question.questionId}>
                  <p className="public-survey-question-text">
                    {firstQuestionIndex + index + 1}. {question.questionText}
                  </p>
                  <div
                    className="public-survey-option-row"
                    role="radiogroup"
                    aria-label={question.questionText}
                  >
                    {survey.answerOptions.map((option) => (
                      <label
                        className={
                          answers[question.questionId] === option.value
                            ? 'public-survey-option public-survey-option--selected'
                            : 'public-survey-option'
                        }
                        key={option.answerScaleOptionId}
                      >
                        <span className="public-survey-option-value">{option.value}</span>
                        <input
                          type="radio"
                          name={`question-${question.questionId}`}
                          value={option.value}
                          checked={answers[question.questionId] === option.value}
                          disabled={!survey.isOpen || submitting}
                          onChange={() => {
                            setAnswers((prev) => ({
                              ...prev,
                              [question.questionId]: option.value,
                            }));
                            setSubmitError(null);
                          }}
                        />
                        <span className="public-survey-option-text">{option.displayText}</span>
                      </label>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
          <div className="public-survey-table-scroll">
            <table className="public-survey-table">
              <thead>
                <tr>
                  <th scope="col">Tiêu chí đánh giá</th>
                  {survey.answerOptions.map((option) => (
                    <th key={option.answerScaleOptionId} scope="col">
                      {option.displayText}
                      <small>({option.value})</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageQuestions.map((question, index) => (
                  <tr key={question.questionId}>
                    <th scope="row">
                      {firstQuestionIndex + index + 1}. {question.questionText}
                    </th>
                    {survey.answerOptions.map((option) => (
                      <td key={option.answerScaleOptionId}>
                        <label className="public-survey-radio">
                          <input
                            type="radio"
                            name={`question-${question.questionId}`}
                            value={option.value}
                            checked={answers[question.questionId] === option.value}
                            disabled={!survey.isOpen || submitting}
                            onChange={() => {
                              setAnswers((prev) => ({
                                ...prev,
                                [question.questionId]: option.value,
                              }));
                              setSubmitError(null);
                            }}
                          />
                          <span className="public-survey-sr-only">
                            {question.questionText}: {option.displayText}
                          </span>
                        </label>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}

          {isLastPage && (
            <div className="public-survey-comments">
              <label htmlFor="public-survey-comments">Ý kiến khác của bạn (nếu có)</label>
              <textarea
                id="public-survey-comments"
                rows={4}
                maxLength={maximumCommentLength}
                placeholder="Nhập ý kiến của bạn tại đây..."
                value={comments}
                disabled={!survey.isOpen || submitting}
                onChange={(event) => setComments(event.target.value)}
              />
              <span className="public-survey-counter">
                {comments.length}/{maximumCommentLength}
              </span>
            </div>
          )}

          {submitError && (
            <div className="public-survey-alert" role="alert">
              <CircleAlert aria-hidden="true" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="public-survey-actions">
            {currentPage > 0 && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={submitting}
                onClick={(event) => {
                  event.preventDefault();
                  goToPage(currentPage - 1);
                }}
              >
                <ChevronLeft aria-hidden="true" />
                Trang trước
              </button>
            )}
            {/* Hai nhánh phải khác "key": nếu dùng chung một nút, React chỉ đổi
                thuộc tính type từ "button" sang "submit" ngay trong lúc xử lý cú
                bấm "Trang sau" ở trang áp chót, rồi trình duyệt chạy hành vi mặc
                định trên chính nút đó và nộp form ngoài ý muốn. */}
            {isLastPage ? (
              <button
                key="submit"
                type="submit"
                className="btn btn-primary"
                disabled={!survey.isOpen || submitting}
              >
                {submitting ? (
                  <LoaderCircle className="auth-spin" aria-hidden="true" />
                ) : (
                  <Send aria-hidden="true" />
                )}
                {submitting ? 'Đang gửi...' : 'Nộp bài khảo sát'}
              </button>
            ) : (
              <button
                key="next"
                type="button"
                className="btn btn-primary"
                disabled={submitting}
                onClick={(event) => {
                  event.preventDefault();
                  goToPage(currentPage + 1);
                }}
              >
                Trang sau
                <ChevronRight aria-hidden="true" />
              </button>
            )}
          </div>
        </form>

        <footer className="public-survey-footer">
          Thông tin của bạn được ghi nhận ẩn danh và chỉ dùng cho mục đích khảo sát.
        </footer>
      </section>
    </main>
  );
};
