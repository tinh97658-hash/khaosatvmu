import React, { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  ClipboardList,
  Copy,
  ExternalLink,
  LoaderCircle,
  Pencil,
  Plus,
  QrCode,
  Save,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../auth/authContext';
import { isReadOnlyRole } from '../auth/roles';
import { ConfirmDialog, Modal } from '../components/Modal';
import { QRCodeModal } from '../components/QRCodeModal';
import { useSemester } from '../context/semesterContext';
import { ApiError } from '../services/apiClient';
import { surveyApi, surveyErrorMessage, surveyLinkOf } from '../services/surveyApi';
import type {
  CourseSectionSurvey,
  SemesterSurvey,
  SurveyTemplate,
} from '../types';
import '../styles/survey-operations.css';

interface ScheduleForm {
  startTime: string;
  endTime: string;
}

/** Một học kỳ có thể có hàng trăm lớp nên bảng lớp được phân trang. */
const sectionPageSize = 20;

function messageFrom(error: unknown): string {
  return error instanceof ApiError ? surveyErrorMessage(error.errorCode) : surveyErrorMessage(null);
}

/** Chuyển ISO 8601 sang giá trị của input datetime-local (giờ máy người dùng). */
function toLocalInput(value: string): string {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function toIso(localValue: string): string {
  return new Date(localValue).toISOString();
}

function formatRange(startTime: string, endTime: string): string {
  const formatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  return `${formatter.format(new Date(startTime))} → ${formatter.format(new Date(endTime))}`;
}

const defaultSchedule = (): ScheduleForm => {
  const now = new Date();
  const nextMonth = new Date();
  nextMonth.setMonth(now.getMonth() + 1);

  const format = (date: Date) => date.toISOString().slice(0, 16);

  return {
    startTime: format(now),
    endTime: format(nextMonth),
  };
};

interface CourseSurveysPageProps {
  /** Chuyển sang màn Thống kê & Báo cáo để xem kết quả chi tiết của một bài khảo sát. */
  onOpenSurveyReport?: (courseSectionSurveyId: number) => void;
}

export const CourseSurveysPage: React.FC<CourseSurveysPageProps> = ({ onOpenSurveyReport }) => {
  const {
    academicYears,
    activeSemesterId,
  } = useSemester();
  const [semesterId, setSemesterId] = useState<string>(() =>
    activeSemesterId ? String(activeSemesterId) : ''
  );

  // Khi học kỳ làm việc toàn cục (Header) thay đổi, cập nhật trang khảo sát học phần
  useEffect(() => {
    if (activeSemesterId) {
      setSemesterId(String(activeSemesterId));
    }
  }, [activeSemesterId]);

  // Giảng viên chỉ theo dõi phiếu của lớp mình dạy: không tạo, không xoá, không sửa
  // lịch. Riêng link và mã QR thì giữ, vì chính họ là người đưa cho sinh viên.
  const { activeProfile } = useAuth();
  const readOnly = isReadOnlyRole(activeProfile?.roleCode);

  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [semesterSurveys, setSemesterSurveys] = useState<SemesterSurvey[]>([]);
  const [sectionSurveys, setSectionSurveys] = useState<Record<number, CourseSectionSurvey[]>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [sectionPages, setSectionPages] = useState<Record<number, number>>({});

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createTemplateId, setCreateTemplateId] = useState('');
  const [createSchedule, setCreateSchedule] = useState<ScheduleForm>(defaultSchedule);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingSection, setEditingSection] = useState<CourseSectionSurvey | null>(null);
  const [editSchedule, setEditSchedule] = useState<ScheduleForm>(defaultSchedule);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [deleting, setDeleting] = useState<SemesterSurvey | null>(null);
  const [qrTarget, setQrTarget] = useState<CourseSectionSurvey | null>(null);

  // Nạp danh sách template khảo sát. Bộ câu hỏi thuộc quyền
  // COURSE_QUESTION_SETS_ACCESS mà vai trò chỉ đọc không có, nên gọi vào là 403 và
  // trang hiện một dải lỗi đỏ thừa. Template cũng chỉ dùng để tạo đợt, mà vai trò đó
  // không tạo được — bỏ hẳn lời gọi. Xem congviec3.md mục H6.
  useEffect(() => {
    if (readOnly) return;
    const load = async () => {
      try {
        const nextTemplates = await surveyApi.templates();
        setTemplates(nextTemplates);
      } catch (error) {
        setLoadError(messageFrom(error));
      }
    };
    void load();
  }, [readOnly]);

  const loadSections = useCallback(async (semesterSurveyId: number) => {
    try {
      const sections = await surveyApi.courseSectionSurveys(semesterSurveyId);
      setSectionSurveys((prev) => ({ ...prev, [semesterSurveyId]: sections }));
    } catch (error) {
      toast.error('Không tải được danh sách lớp', { description: messageFrom(error) });
    }
  }, []);

  const loadSemesterSurveys = useCallback(
    async (selectedSemesterId: string, expandFirst = false) => {
      if (!selectedSemesterId) {
        setSemesterSurveys([]);
        return;
      }
      setLoading(true);
      try {
        const surveys = await surveyApi.semesterSurveys(Number(selectedSemesterId));
        setSemesterSurveys(surveys);
        setLoadError(null);
        // Mở sẵn đợt mới nhất để thấy ngay link và mã QR của từng lớp.
        if (expandFirst && surveys.length > 0) {
          const newest = surveys[0].semesterSurveyId;
          setExpanded((prev) => ({ ...prev, [newest]: true }));
          await loadSections(newest);
        }
      } catch (error) {
        setLoadError(messageFrom(error));
      } finally {
        setLoading(false);
      }
    },
    [loadSections]
  );

  useEffect(() => {
    setExpanded({});
    setSectionSurveys({});
    void loadSemesterSurveys(semesterId, true);
  }, [semesterId, loadSemesterSurveys]);

  const toggleExpanded = async (semesterSurveyId: number) => {
    const willExpand = !expanded[semesterSurveyId];
    setExpanded((prev) => ({ ...prev, [semesterSurveyId]: willExpand }));
    if (willExpand && !sectionSurveys[semesterSurveyId]) {
      await loadSections(semesterSurveyId);
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!semesterId) {
      setCreateError('Vui lòng chọn học kỳ trước.');
      return;
    }
    if (!createTemplateId) {
      setCreateError('Vui lòng chọn bộ câu hỏi khảo sát.');
      return;
    }
    if (new Date(createSchedule.endTime) <= new Date(createSchedule.startTime)) {
      setCreateError('Thời gian đóng phải sau thời gian mở.');
      return;
    }

    setCreating(true);
    try {
      const created = await surveyApi.createSemesterSurvey({
        semesterId: Number(semesterId),
        surveyTemplateId: Number(createTemplateId),
        startTime: toIso(createSchedule.startTime),
        endTime: toIso(createSchedule.endTime),
      });
      await loadSemesterSurveys(semesterId);
      setExpanded((prev) => ({ ...prev, [created.semesterSurveyId]: true }));
      await loadSections(created.semesterSurveyId);
      toast.success('Đã tạo bài khảo sát cho các lớp học phần', {
        description: `${created.templateName} · ${created.sectionSurveyCount} lớp`,
      });
      setIsCreateOpen(false);
      setCreateError(null);
    } catch (error) {
      setCreateError(messageFrom(error));
    } finally {
      setCreating(false);
    }
  };

  const handleSaveSchedule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingSection) return;
    if (new Date(editSchedule.endTime) <= new Date(editSchedule.startTime)) {
      setEditError('Thời gian đóng phải sau thời gian mở.');
      return;
    }

    setSavingSchedule(true);
    try {
      await surveyApi.updateSectionSurveySchedule(editingSection.courseSectionSurveyId, {
        startTime: toIso(editSchedule.startTime),
        endTime: toIso(editSchedule.endTime),
      });
      await loadSections(editingSection.semesterSurveyId);
      await loadSemesterSurveys(semesterId);
      toast.success('Đã cập nhật thời gian mở khảo sát');
      setEditingSection(null);
      setEditError(null);
    } catch (error) {
      setEditError(messageFrom(error));
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await surveyApi.deleteSemesterSurvey(deleting.semesterSurveyId);
      await loadSemesterSurveys(semesterId);
      toast.success('Đã xóa đợt khảo sát', { description: deleting.templateName });
    } catch (error) {
      toast.error('Không thể xóa đợt khảo sát', { description: messageFrom(error) });
    } finally {
      setDeleting(null);
    }
  };

  const handleCopyLink = async (linkToken: string) => {
    try {
      await navigator.clipboard.writeText(surveyLinkOf(linkToken));
      toast.success('Đã sao chép đường dẫn khảo sát');
    } catch {
      toast.error('Không thể sao chép tự động', {
        description: 'Hãy chọn và sao chép đường dẫn trong ô bên cạnh.',
      });
    }
  };

  const openSurveyReport = (courseSectionSurveyId: number) => {
    if (onOpenSurveyReport) {
      onOpenSurveyReport(courseSectionSurveyId);
    }
  };

  return (
    <div className="survey-operations-page course-surveys-page">
      <section className="operations-toolbar" aria-label="Chọn học kỳ">
        <div className="operations-filter-title">
          <CalendarDays className="operation-icon" aria-hidden="true" />
          <span>Chọn học kỳ cần khảo sát</span>
        </div>
        <div className="operations-field">
          <label htmlFor="course-survey-semester">Học kỳ</label>
          <select
            id="course-survey-semester"
            value={semesterId}
            onChange={(event) => setSemesterId(event.target.value)}
          >
            <option value="">Chọn học kỳ</option>
            {academicYears.map((year) => (
              <optgroup key={year.academicYearId} label={year.academicYearName}>
                {year.semesters.map((semester) => (
                  <option key={semester.semesterId} value={String(semester.semesterId)}>
                    {semester.semesterName} ({year.academicYearName})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        {!readOnly && (
          <div className="operations-tab-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!semesterId}
              onClick={() => {
                setCreateError(null);
                setCreateTemplateId(templates.length === 1 ? String(templates[0].surveyTemplateId) : '');
                setCreateSchedule(defaultSchedule());
                setIsCreateOpen(true);
              }}
            >
              <Plus className="operation-icon" aria-hidden="true" />
              Tạo bài khảo sát
            </button>
          </div>
        )}
      </section>

      {loadError && (
        <div className="operations-feedback operations-feedback--error" role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      )}

      {!semesterId && (
        <div className="operations-empty">
          <CalendarDays className="operation-icon" aria-hidden="true" />
          <strong>Chọn một học kỳ để xem hoặc tạo bài khảo sát</strong>
          <span>
            Khi tạo, mọi lớp học phần của học kỳ sẽ nhận cùng một bộ câu hỏi, mỗi lớp có link và mã
            QR riêng.
          </span>
        </div>
      )}

      {semesterId && loading && (
        <div className="operations-empty" role="status">
          <LoaderCircle className="operation-icon auth-spin" aria-hidden="true" />
          <strong>Đang tải đợt khảo sát...</strong>
        </div>
      )}

      {semesterId && !loading && semesterSurveys.length === 0 && (
        <div className="operations-empty">
          <QrCode className="operation-icon" aria-hidden="true" />
          <strong>Học kỳ này chưa có bài khảo sát nào</strong>
          <span>Bấm "Tạo bài khảo sát" để phát phiếu cho toàn bộ lớp học phần của kỳ.</span>
        </div>
      )}

      {semesterId && !loading && semesterSurveys.map((survey) => {
        const sections = sectionSurveys[survey.semesterSurveyId] ?? [];
        const isExpanded = expanded[survey.semesterSurveyId] ?? false;
        const totalPages = Math.max(1, Math.ceil(sections.length / sectionPageSize));
        const page = Math.min(sectionPages[survey.semesterSurveyId] ?? 1, totalPages);
        const firstIndex = (page - 1) * sectionPageSize;
        const visibleSections = sections.slice(firstIndex, firstIndex + sectionPageSize);
        const changePage = (nextPage: number) =>
          setSectionPages((prev) => ({
            ...prev,
            [survey.semesterSurveyId]: Math.min(Math.max(1, nextPage), totalPages),
          }));

        return (
          <section className="semester-survey-card" key={survey.semesterSurveyId}>
            <header className="semester-survey-header">
              <button
                type="button"
                className="semester-survey-toggle"
                onClick={() => void toggleExpanded(survey.semesterSurveyId)}
                aria-expanded={isExpanded}
                aria-controls={`semester-survey-${survey.semesterSurveyId}`}
              >
                {isExpanded ? (
                  <ChevronUp className="operation-icon" aria-hidden="true" />
                ) : (
                  <ChevronDown className="operation-icon" aria-hidden="true" />
                )}
                <span className="semester-survey-title">{survey.templateName}</span>
                <span className="operations-count">{survey.sectionSurveyCount} lớp</span>
              </button>

              <div className="semester-survey-meta">
                <span>
                  <CalendarDays className="operation-icon" aria-hidden="true" />
                  {formatRange(survey.startTime, survey.endTime)}
                </span>
                <span>
                  <Users className="operation-icon" aria-hidden="true" />
                  {survey.responseCount} lượt trả lời
                </span>
                <span>{survey.questionCount} câu hỏi</span>
                {!readOnly && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => setDeleting(survey)}
                  >
                    <Trash2 className="operation-icon" aria-hidden="true" />
                    Xóa đợt
                  </button>
                )}
              </div>
            </header>

            {isExpanded && (
              <div className="campaign-table-scroll" id={`semester-survey-${survey.semesterSurveyId}`}>
                <table className="campaign-table">
                  <thead>
                    <tr>
                      <th>Lớp học phần</th>
                      <th>Đường dẫn riêng</th>
                      <th>Thời gian mở</th>
                      <th>Lượt trả lời</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sections.length === 0 && (
                      <tr>
                        <td colSpan={5}>Đang tải danh sách lớp...</td>
                      </tr>
                    )}
                    {visibleSections.map((section) => (
                      <tr key={section.courseSectionSurveyId}>
                        <td className="campaign-primary-cell">
                          <div className="campaign-primary-value">
                            <span>
                              {section.courseCode} - {section.courseName}
                            </span>
                          </div>
                          <div className="campaign-secondary-value">
                            <span>
                              Lớp: <strong>{section.sectionName}</strong>; GV:{' '}
                              {section.lecturerName || 'Chưa phân công'}; Sĩ số: {section.classSize}
                            </span>
                          </div>
                        </td>
                        <td className="campaign-link-cell">
                          <div className="campaign-link-row">
                            <input
                              className="campaign-link-input"
                              aria-label={`Đường dẫn khảo sát lớp ${section.sectionName}`}
                              type="text"
                              readOnly
                              value={surveyLinkOf(section.linkToken)}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary operation-icon-button"
                              onClick={() => void handleCopyLink(section.linkToken)}
                              title="Sao chép đường dẫn"
                              aria-label={`Sao chép đường dẫn lớp ${section.sectionName}`}
                            >
                              <Copy className="operation-icon" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                        <td className="campaign-schedule-cell">
                          <div className="campaign-date">
                            <CalendarDays className="operation-icon" aria-hidden="true" />
                            <span>{formatRange(section.startTime, section.endTime)}</span>
                          </div>
                        </td>
                        <td>
                          {/* Số lượt trả lời là lối tắt sang trang Thống kê & Báo cáo,
                              mà vai trò chỉ đọc không có quyền vào đó — câu H-e chốt
                              giảng viên chỉ xem tiến độ, không xem kết quả. */}
                          {readOnly ? (
                            <span className="operations-count">{section.responseCount}</span>
                          ) : (
                            <button
                              type="button"
                              className="section-response-link"
                              onClick={() => openSurveyReport(section.courseSectionSurveyId)}
                              title="Xem kết quả chi tiết trong Thống kê & Báo cáo"
                            >
                              <span className="operations-count">{section.responseCount}</span>
                            </button>
                          )}
                        </td>
                        <td>
                          <div className="campaign-row-actions">
                            {!readOnly && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => openSurveyReport(section.courseSectionSurveyId)}
                              >
                                <ClipboardList className="operation-icon" aria-hidden="true" />
                                Kết quả
                              </button>
                            )}
                            {/* Mã QR và đường dẫn thì giữ cho mọi vai trò: giảng viên
                                chính là người đưa cho sinh viên, câu H-d. */}
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setQrTarget(section)}
                            >
                              <QrCode className="operation-icon" aria-hidden="true" />
                              QR
                            </button>
                            {!readOnly && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setEditingSection(section);
                                  setEditError(null);
                                  setEditSchedule({
                                    startTime: toLocalInput(section.startTime),
                                    endTime: toLocalInput(section.endTime),
                                  });
                                }}
                              >
                                <Pencil className="operation-icon" aria-hidden="true" />
                                Sửa lịch
                              </button>
                            )}
                            <a
                              className="btn btn-secondary btn-sm"
                              href={surveyLinkOf(section.linkToken)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink className="operation-icon" aria-hidden="true" />
                              Mở
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {isExpanded && sections.length > 0 && (
              <footer className="catalog-pagination section-survey-pagination">
                <span>
                  Hiển thị <strong>{firstIndex + 1}</strong>–
                  <strong>{Math.min(firstIndex + sectionPageSize, sections.length)}</strong> trên{' '}
                  <strong>{sections.length}</strong> lớp học phần
                </span>
                <div className="catalog-pagination__controls" aria-label="Phân trang lớp học phần">
                  <button
                    type="button"
                    className="catalog-page-button"
                    disabled={page <= 1}
                    onClick={() => changePage(page - 1)}
                    aria-label="Trang trước"
                    title="Trang trước"
                  >
                    <ChevronLeft aria-hidden="true" size={16} />
                  </button>
                  <span className="catalog-page-number" aria-current="page">{page}</span>
                  {totalPages > 1 && <span className="catalog-page-total">/ {totalPages}</span>}
                  <button
                    type="button"
                    className="catalog-page-button"
                    disabled={page >= totalPages}
                    onClick={() => changePage(page + 1)}
                    aria-label="Trang sau"
                    title="Trang sau"
                  >
                    <ChevronRight aria-hidden="true" size={16} />
                  </button>
                </div>
              </footer>
            )}
          </section>
        );
      })}

      <Modal
        isOpen={isCreateOpen}
        onClose={() => {
          if (creating) return;
          setIsCreateOpen(false);
          setCreateError(null);
        }}
        title="Tạo bài khảo sát cho học kỳ"
      >
        <form className="catalog-form" onSubmit={(event) => void handleCreate(event)}>
          {createError && (
            <div className="catalog-validation-error" role="alert">{createError}</div>
          )}

          <div className="catalog-context-band">
            Mỗi lớp học phần của học kỳ đã chọn sẽ được tạo một bài khảo sát riêng, dùng chung bộ
            câu hỏi bên dưới và có đường dẫn, mã QR riêng.
          </div>

          <div className="form-group">
            <label htmlFor="create-survey-template">Bộ câu hỏi khảo sát</label>
            <select
              id="create-survey-template"
              value={createTemplateId}
              onChange={(event) => setCreateTemplateId(event.target.value)}
              required
            >
              <option value="">Chọn bộ câu hỏi</option>
              {templates.map((template) => (
                <option key={template.surveyTemplateId} value={String(template.surveyTemplateId)}>
                  {template.templateName} ({template.questions.length} câu)
                </option>
              ))}
            </select>
          </div>

          <div className="catalog-form-grid catalog-form-grid--2">
            <div className="form-group">
              <label htmlFor="create-survey-start">Thời gian mở</label>
              <input
                id="create-survey-start"
                type="datetime-local"
                value={createSchedule.startTime}
                onChange={(event) =>
                  setCreateSchedule((prev) => ({ ...prev, startTime: event.target.value }))
                }
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="create-survey-end">Thời gian đóng</label>
              <input
                id="create-survey-end"
                type="datetime-local"
                value={createSchedule.endTime}
                onChange={(event) =>
                  setCreateSchedule((prev) => ({ ...prev, endTime: event.target.value }))
                }
                required
              />
            </div>
          </div>

          <div className="modal-footer catalog-form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsCreateOpen(false)}
              disabled={creating}
            >
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? (
                <LoaderCircle className="auth-spin" aria-hidden="true" size={16} />
              ) : (
                <Save aria-hidden="true" size={16} />
              )}
              Tạo bài khảo sát
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={editingSection !== null}
        onClose={() => {
          if (savingSchedule) return;
          setEditingSection(null);
          setEditError(null);
        }}
        title={
          editingSection
            ? `Thời gian mở khảo sát lớp ${editingSection.sectionName}`
            : 'Thời gian mở khảo sát'
        }
      >
        <form className="catalog-form" onSubmit={(event) => void handleSaveSchedule(event)}>
          {editError && <div className="catalog-validation-error" role="alert">{editError}</div>}

          <div className="catalog-form-grid catalog-form-grid--2">
            <div className="form-group">
              <label htmlFor="edit-survey-start">Thời gian mở</label>
              <input
                id="edit-survey-start"
                type="datetime-local"
                value={editSchedule.startTime}
                onChange={(event) =>
                  setEditSchedule((prev) => ({ ...prev, startTime: event.target.value }))
                }
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="edit-survey-end">Thời gian đóng</label>
              <input
                id="edit-survey-end"
                type="datetime-local"
                value={editSchedule.endTime}
                onChange={(event) =>
                  setEditSchedule((prev) => ({ ...prev, endTime: event.target.value }))
                }
                required
              />
            </div>
          </div>

          <div className="modal-footer catalog-form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditingSection(null)}
              disabled={savingSchedule}
            >
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={savingSchedule}>
              {savingSchedule ? (
                <LoaderCircle className="auth-spin" aria-hidden="true" size={16} />
              ) : (
                <Save aria-hidden="true" size={16} />
              )}
              Lưu lịch
            </button>
          </div>
        </form>
      </Modal>

      <QRCodeModal
        isOpen={qrTarget !== null}
        onClose={() => setQrTarget(null)}
        title={qrTarget ? `${qrTarget.courseCode} - ${qrTarget.courseName}` : ''}
        subtitle={
          qrTarget
            ? `Lớp ${qrTarget.sectionName} • GV: ${qrTarget.lecturerName || 'Chưa phân công'} • ${formatRange(
                qrTarget.startTime,
                qrTarget.endTime
              )}`
            : ''
        }
        surveyLink={qrTarget ? surveyLinkOf(qrTarget.linkToken) : ''}
        onOpenSurveySimulator={() => {
          if (qrTarget) window.open(surveyLinkOf(qrTarget.linkToken), '_blank', 'noreferrer');
        }}
      />

      <ConfirmDialog
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
        title="Xóa đợt khảo sát"
        recordName={deleting ? `${deleting.templateName} - ${deleting.semesterName}` : ''}
        warning="Toàn bộ bài khảo sát của các lớp trong đợt sẽ bị xóa theo."
      />
    </div>
  );
};
