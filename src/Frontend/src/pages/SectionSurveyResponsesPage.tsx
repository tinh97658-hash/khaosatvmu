import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CircleAlert,
  Eye,
  LoaderCircle,
  MessageSquare,
  Star,
  TriangleAlert,
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
import { rejectionReasonTexts } from '../types';
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

const dateFormatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' });

const formatDate = (value: string) => dateFormatter.format(new Date(value));

const countOfValue = (item: SurveyResponseSummary, value: number) =>
  item.valueCounts.find((entry) => entry.value === value)?.count ?? 0;

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

  // Điểm trung bình là số liệu chất lượng nên chỉ gộp phiếu qua bộ lọc nhiễu,
  // khớp với cách backend tính trong báo cáo.
  const validResponses = responses.filter((response) => response.isValid);
  const averageScore =
    validResponses.length === 0
      ? 0
      : validResponses.reduce((total, response) => total + response.score, 0) /
        validResponses.length;

  const invalidCount = responses.filter((response) => !response.isValid).length;

  // Ý kiến của phiếu bị lọc không dùng được vào kết quả nào nên không đếm.
  const commentedCount = validResponses.filter((response) => response.additionalComments).length;

  const normalized = search.trim().toLowerCase();
  const filtered = responses.filter(
    (response) =>
      !normalized ||
      String(response.responseId).includes(normalized) ||
      (response.additionalComments ?? '').toLowerCase().includes(normalized)
  );

  // Mọi cột đều có menu lọc trên tiêu đề, thay cho ô lọc riêng phía trên bảng.
  const columns: Column<SurveyResponseSummary>[] = [
    {
      key: 'responseId',
      header: 'Mã phiếu',
      width: '86px',
      sortValue: (item) => item.responseId,
      filterValue: (item) => `#${item.responseId}`,
      render: (item) => <span className="catalog-code">#{item.responseId}</span>,
    },
    {
      key: 'submittedAt',
      header: 'Thời gian nộp',
      width: '132px',
      sortValue: (item) => item.submittedAt,
      // Lọc theo ngày: lọc tới từng phút thì mỗi phiếu một giá trị, gom được gì.
      filterValue: (item) => formatDate(item.submittedAt),
      render: (item) => (
        <span className="catalog-cell-primary">{formatDateTime(item.submittedAt)}</span>
      ),
    },
    {
      key: 'score',
      header: 'Điểm',
      width: '72px',
      numeric: true,
      sortValue: (item) => item.score,
      filterValue: (item) => item.score.toFixed(2),
      render: (item) => <span className="response-score">{item.score.toFixed(2)}</span>,
    },
    {
      key: 'isValid',
      header: 'Trạng thái',
      width: '104px',
      filterValue: (item) => (item.isValid ? 'Hợp lệ' : 'Bị lọc'),
      render: (item) =>
        item.isValid ? (
          <span className="response-validity">Hợp lệ</span>
        ) : (
          <span className="response-validity is-rejected">
            <TriangleAlert aria-hidden="true" size={13} />
            Bị lọc
          </span>
        ),
    },
    {
      key: 'rejectionReasons',
      header: 'Lý do bị lọc',
      width: '220px',
      // Dịch mã sang tiếng Việt, không phơi TOO_FAST ra màn hình.
      filterValue: (item) => rejectionReasonTexts(item.rejectionReasons).join(' · ') || '—',
      render: (item) => {
        const reasons = rejectionReasonTexts(item.rejectionReasons);
        if (reasons.length === 0) return <span className="response-comment is-empty">—</span>;
        // Gộp một dòng, đủ lý do nằm trong tooltip — bảng này rất dài.
        return (
          <span className="response-reasons" title={reasons.join(' · ')}>
            {reasons.join(' · ')}
          </span>
        );
      },
    },
    ...scaleValues.map((option) => ({
      key: `value-${option.value}`,
      header: `Mức ${option.value}`,
      width: '72px',
      numeric: true,
      sortValue: (item: SurveyResponseSummary) => countOfValue(item, option.value),
      filterValue: (item: SurveyResponseSummary) => String(countOfValue(item, option.value)),
      render: (item: SurveyResponseSummary) => {
        const count = countOfValue(item, option.value);
        return (
          <span className={count > 0 ? 'response-count' : 'response-count is-zero'}>{count}</span>
        );
      },
    })),
    {
      key: 'additionalComments',
      header: 'Ý kiến khác',
      filterValue: (item) => (item.additionalComments ? 'Có ý kiến' : 'Không có'),
      render: (item) =>
        item.additionalComments ? (
          <span className="response-comment" title={item.additionalComments}>
            {item.additionalComments}
          </span>
        ) : (
          <span className="response-comment is-empty">Không có</span>
        ),
    },
    {
      key: 'actions',
      header: 'Chi tiết',
      width: '92px',
      render: (item) => (
        <button
          type="button"
          className="btn btn-secondary btn-sm response-row-action"
          onClick={() => void openDetail(item.responseId)}
          disabled={detailLoading}
        >
          <Eye className="operation-icon" aria-hidden="true" />
          Xem
        </button>
      ),
    },
  ];

  return (
    <div className="survey-operations-page section-responses-page">
      {loadError && (
        <div className="operations-feedback operations-feedback--error" role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      )}

      {sectionSurvey && (
        <section className="section-responses-summary" aria-label="Thông tin bài khảo sát">
          {/* Nút quay lại nằm cùng hàng với tên lớp, đỡ một băng riêng phía trên. */}
          <div className="section-responses-heading">
            <button
              type="button"
              className="btn btn-secondary btn-sm section-responses-back"
              onClick={onBack}
              title={backLabel}
            >
              <ArrowLeft className="operation-icon" aria-hidden="true" />
            </button>
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
              {commentedCount} phiếu hợp lệ có ý kiến
            </span>
            <span className={invalidCount > 0 ? 'section-responses-stat--warning' : undefined}>
              <TriangleAlert className="operation-icon" aria-hidden="true" />
              {invalidCount} phiếu bị lọc nhiễu
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
        showIndex={false}
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

            {/* Mỗi câu có thang riêng nên liệt kê từng câu kèm đáp án thay vì
                dựng một bảng ma trận dùng chung các cột. */}
            <div className="admin-import-table-scroll response-detail-table">
              <table>
                <thead>
                  <tr>
                    <th>Câu hỏi</th>
                    <th>Thang trả lời</th>
                    <th>Trả lời</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.answers.map((answer, index) => {
                    const scale = detail.answerScales.find(
                      (item) => item.answerScaleId === answer.answerScaleId
                    );

                    return (
                      <tr key={answer.questionId}>
                        <td className="response-detail-question">
                          {index + 1}. {answer.questionText}
                        </td>
                        <td>{scale?.answerScaleName ?? '—'}</td>
                        <td>
                          {answer.scaleKind === 'Text' ? (
                            <span className="response-comment">
                              {answer.answerValue || 'Không trả lời.'}
                            </span>
                          ) : (
                            <span>
                              {answer.selectedText || '—'}
                              {answer.selectedValue !== null && (
                                <small> ({answer.selectedValue})</small>
                              )}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
