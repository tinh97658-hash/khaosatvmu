import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CircleAlert,
  Eye,
  LoaderCircle,
  MessageSquare,
  Star,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { QuestionAnalysisChart } from '../components/QuestionAnalysisChart';
import { ApiError } from '../services/apiClient';
import { reportApi } from '../services/reportApi';
import { surveyApi, surveyErrorMessage } from '../services/surveyApi';
import type {
  CourseSectionSurvey,
  SectionSurveyAnalysis,
  SurveyResponseDetail,
  SurveyResponseSummary,
} from '../types';
import '../styles/survey-operations.css';
import '../styles/reports.css';

interface SectionSurveyResponsesPageProps {
  courseSectionSurveyId: number;
  onBack: () => void;
  /** Nhãn nút quay lại, mặc định dành cho màn quản lý khảo sát. */
  backLabel?: string;
  /** Bật phân tích từng câu hỏi của bài khảo sát (dùng trong Thống kê & Báo cáo). */
  showAnalysis?: boolean;
}

function messageFrom(error: unknown): string {
  return error instanceof ApiError ? surveyErrorMessage(error.errorCode) : surveyErrorMessage(null);
}

const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const formatDateTime = (value: string) => dateTimeFormatter.format(new Date(value));

export const SectionSurveyResponsesPage: React.FC<SectionSurveyResponsesPageProps> = ({
  courseSectionSurveyId,
  onBack,
  backLabel = 'Quay lại danh sách lớp',
  showAnalysis = false,
}) => {
  const [sectionSurvey, setSectionSurvey] = useState<CourseSectionSurvey | null>(null);
  const [responses, setResponses] = useState<SurveyResponseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [analysis, setAnalysis] = useState<SectionSurveyAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(showAnalysis);

  const [detail, setDetail] = useState<SurveyResponseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [survey, nextResponses] = await Promise.all([
        surveyApi.courseSectionSurvey(courseSectionSurveyId),
        surveyApi.surveyResponses(courseSectionSurveyId),
      ]);
      setSectionSurvey(survey);
      setResponses(nextResponses);
      setLoadError(null);
    } catch (error) {
      setLoadError(messageFrom(error));
    } finally {
      setLoading(false);
    }
  }, [courseSectionSurveyId]);

  useEffect(() => {
    if (!showAnalysis) return;
    let cancelled = false;
    setAnalysisLoading(true);
    reportApi
      .sectionAnalysis(courseSectionSurveyId)
      .then((data) => {
        if (!cancelled) setAnalysis(data);
      })
      .catch(() => {
        // Phân tích là phần phụ; không làm hỏng danh sách phiếu.
        if (!cancelled) setAnalysis(null);
      })
      .finally(() => {
        if (!cancelled) setAnalysisLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseSectionSurveyId, showAnalysis]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (responseId: number) => {
    setDetailLoading(true);
    try {
      setDetail(await surveyApi.surveyResponse(responseId));
    } catch (error) {
      toast.error('Không mở được phiếu trả lời', { description: messageFrom(error) });
    } finally {
      setDetailLoading(false);
    }
  };

  // Các mức của thang trả lời lấy từ chính phiếu đầu tiên, đủ cả mức không ai chọn.
  const scaleValues = responses[0]?.valueCounts ?? [];

  const averageScore =
    responses.length === 0
      ? 0
      : responses.reduce((total, response) => total + response.score, 0) / responses.length;

  const normalized = search.trim().toLowerCase();
  const filtered = responses.filter(
    (response) =>
      !normalized ||
      String(response.responseId).includes(normalized) ||
      (response.additionalComments ?? '').toLowerCase().includes(normalized)
  );

  const columns: Column<SurveyResponseSummary>[] = [
    {
      key: 'responseId',
      header: 'Mã phiếu',
      width: '90px',
      render: (item) => <span className="catalog-code">#{item.responseId}</span>,
    },
    {
      key: 'submittedAt',
      header: 'Thời gian nộp',
      width: '140px',
      render: (item) => (
        <span className="catalog-cell-primary">{formatDateTime(item.submittedAt)}</span>
      ),
    },
    {
      key: 'score',
      header: 'Điểm',
      width: '80px',
      render: (item) => <span className="response-score">{item.score.toFixed(2)}</span>,
    },
    ...scaleValues.map((option) => ({
      key: `value-${option.value}`,
      header: `Mức ${option.value}`,
      width: '80px',
      render: (item: SurveyResponseSummary) => {
        const count = item.valueCounts.find((x) => x.value === option.value)?.count ?? 0;
        return (
          <span className={count > 0 ? 'response-count' : 'response-count is-zero'}>{count}</span>
        );
      },
    })),
    {
      key: 'additionalComments',
      header: 'Ý kiến khác',
      render: (item) =>
        item.additionalComments ? (
          <span className="response-comment">{item.additionalComments}</span>
        ) : (
          <span className="response-comment is-empty">Không có</span>
        ),
    },
    {
      key: 'actions',
      header: 'Theo dõi chi tiết',
      width: '130px',
      render: (item) => (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => void openDetail(item.responseId)}
          disabled={detailLoading}
        >
          <Eye className="operation-icon" aria-hidden="true" />
          Chi tiết
        </button>
      ),
    },
  ];

  return (
    <div className="survey-operations-page section-responses-page">
      <div className="section-responses-back">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>
          <ArrowLeft className="operation-icon" aria-hidden="true" />
          {backLabel}
        </button>
      </div>

      {loadError && (
        <div className="operations-feedback operations-feedback--error" role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      )}

      {sectionSurvey && (
        <section className="section-responses-summary" aria-label="Thông tin bài khảo sát">
          <div className="section-responses-heading">
            <h2>
              {sectionSurvey.courseCode} - {sectionSurvey.courseName}
            </h2>
            <p>
              Lớp <strong>{sectionSurvey.sectionName}</strong> · GV:{' '}
              {sectionSurvey.lecturerName || 'Chưa phân công'} · Sĩ số {sectionSurvey.classSize}
            </p>
          </div>
          <div className="section-responses-stats">
            <span>
              <Users className="operation-icon" aria-hidden="true" />
              {responses.length} phiếu đã thu
            </span>
            <span>
              <Star className="operation-icon" aria-hidden="true" />
              Điểm trung bình {averageScore.toFixed(2)}
            </span>
            <span>
              <MessageSquare className="operation-icon" aria-hidden="true" />
              {responses.filter((response) => response.additionalComments).length} phiếu có ý kiến
            </span>
            <span>
              <CalendarDays className="operation-icon" aria-hidden="true" />
              {formatDateTime(sectionSurvey.startTime)} → {formatDateTime(sectionSurvey.endTime)}
            </span>
          </div>
        </section>
      )}

      {showAnalysis && analysisLoading && (
        <div className="operations-empty section-analysis-loading" role="status">
          <LoaderCircle className="operation-icon auth-spin" aria-hidden="true" />
          <strong>Đang phân tích kết quả theo câu hỏi...</strong>
        </div>
      )}

      {showAnalysis && !analysisLoading && analysis && (
        <QuestionAnalysisChart
          questions={analysis.questions}
          templateName={analysis.templateName}
          overallAverageScore={analysis.averageScore}
          responseCount={analysis.responseCount}
          title="Phân tích kết quả theo câu hỏi"
          showDistributionTable={true}
        />
      )}

      <DataTable
        columns={columns}
        data={filtered}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo mã phiếu hoặc ý kiến..."
        emptyMessage={loading ? 'Đang tải phiếu trả lời...' : 'Lớp này chưa có phiếu trả lời nào.'}
        keyExtractor={(item) => String(item.responseId)}
        pageSize={20}
      />

      <Modal
        isOpen={detail !== null}
        onClose={() => setDetail(null)}
        title={detail ? `Phiếu trả lời #${detail.responseId} (chỉ xem)` : ''}
      >
        {detail && (
          <div className="response-detail">
            <div className="response-detail-meta">
              <span>
                <strong>{detail.templateName}</strong>
              </span>
              <span>
                {detail.courseCode} - {detail.courseName} · Lớp {detail.sectionName} · GV:{' '}
                {detail.lecturerName || 'Chưa phân công'}
              </span>
              <span>
                Nộp lúc {formatDateTime(detail.submittedAt)} · Điểm trung bình{' '}
                <strong>{detail.score.toFixed(2)}</strong>
              </span>
            </div>

            <div className="admin-import-table-scroll response-detail-table">
              <table>
                <thead>
                  <tr>
                    <th>Câu hỏi</th>
                    {detail.answerOptions.map((option) => (
                      <th key={option.answerScaleOptionId}>
                        {option.displayText}
                        <small>({option.value})</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.answers.map((answer, index) => (
                    <tr key={answer.questionId}>
                      <td className="response-detail-question">
                        {index + 1}. {answer.questionText}
                      </td>
                      {detail.answerOptions.map((option) => (
                        <td key={option.answerScaleOptionId}>
                          <input
                            type="radio"
                            checked={answer.selectedValue === option.value}
                            disabled
                            readOnly
                            aria-label={`${answer.questionText}: ${option.displayText}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="response-detail-comment">
              <strong>Ý kiến khác của sinh viên</strong>
              <p>{detail.additionalComments || 'Không có ý kiến.'}</p>
            </div>
          </div>
        )}

        <div className="modal-footer catalog-form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setDetail(null)}>
            Đóng
          </button>
        </div>
      </Modal>

      {detailLoading && (
        <div className="operations-feedback" role="status">
          <LoaderCircle className="auth-spin" aria-hidden="true" />
          <span>Đang mở phiếu trả lời...</span>
        </div>
      )}
    </div>
  );
};
