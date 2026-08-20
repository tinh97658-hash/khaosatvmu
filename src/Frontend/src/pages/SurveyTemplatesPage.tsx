import React, { useCallback, useEffect, useState } from 'react';
import {
  CircleAlert,
  Eye,
  FileSpreadsheet,
  ListChecks,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { ConfirmDialog, Modal } from '../components/Modal';
import { SurveyTemplateImportDialog } from '../components/SurveyTemplateImportDialog';
import { ApiError } from '../services/apiClient';
import {
  surveyApi,
  surveyErrorMessage,
  type SaveSurveyTemplatePayload,
} from '../services/surveyApi';
import { maximumAnswerScaleOptions, maximumQuestionsPerTemplate } from '../types';
import type { AnswerScale, AnswerScaleKind, SurveyTemplate } from '../types';
import '../styles/survey-operations.css';

/** Một dòng câu hỏi trong trình soạn: nội dung kèm thang trả lời của riêng nó. */
interface QuestionForm {
  questionText: string;
  answerScaleId: string;
  /** Mức bắt buộc của câu bẫy độ tập trung. Chuỗi rỗng nghĩa là câu bình thường. */
  attentionCheckValue: string;
}

interface TemplateForm {
  surveyTemplateId: number | null;
  templateName: string;
  questions: QuestionForm[];
}

/** Một mức của thang; `value` cho nhập tay vì thang Có/Không dùng 1 và 5. */
interface ScaleOptionForm {
  value: string;
  displayText: string;
}

interface ScaleForm {
  answerScaleId: number | null;
  answerScaleName: string;
  scaleKind: AnswerScaleKind;
  options: ScaleOptionForm[];
}

const emptyQuestion: QuestionForm = {
  questionText: '',
  answerScaleId: '',
  attentionCheckValue: '',
};

const emptyTemplateForm: TemplateForm = {
  surveyTemplateId: null,
  templateName: '',
  questions: [emptyQuestion],
};

const emptyScaleForm: ScaleForm = {
  answerScaleId: null,
  answerScaleName: '',
  scaleKind: 'Options',
  options: [1, 2, 3, 4, 5].map((value) => ({ value: String(value), displayText: '' })),
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(new Date(value));

function messageFrom(error: unknown): string {
  return error instanceof ApiError ? surveyErrorMessage(error.errorCode) : surveyErrorMessage(null);
}

export const SurveyTemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [answerScales, setAnswerScales] = useState<AnswerScale[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [form, setForm] = useState<TemplateForm>(emptyTemplateForm);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isScalesOpen, setIsScalesOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<SurveyTemplate | null>(null);
  const [deleting, setDeleting] = useState<SurveyTemplate | null>(null);

  const [scaleForm, setScaleForm] = useState<ScaleForm>(emptyScaleForm);
  const [scaleError, setScaleError] = useState<string | null>(null);
  const [scaleSaving, setScaleSaving] = useState(false);
  const [deletingScaleId, setDeletingScaleId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextTemplates, nextScales] = await Promise.all([
        surveyApi.templates(),
        surveyApi.answerScales(),
      ]);
      setTemplates(nextTemplates);
      setAnswerScales(nextScales);
      setLoadError(null);
    } catch (error) {
      setLoadError(messageFrom(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const scaleNameOf = (answerScaleId: number) =>
    answerScales.find((scale) => scale.answerScaleId === answerScaleId)?.answerScaleName ?? '—';

  /** Tên các thang mà một bộ đang dùng, không lặp, theo thứ tự câu hỏi. */
  const scaleNamesOf = (template: SurveyTemplate) =>
    [...new Set(template.questions.map((question) => question.answerScaleId))]
      .map(scaleNameOf)
      .join(' · ');

  const normalized = search.trim().toLowerCase();
  const filtered = templates.filter(
    (item) => !normalized || item.templateName.toLowerCase().includes(normalized)
  );

  // ------------------------------------------------------------- Bộ câu hỏi

  // Chỉ có đúng một thang thì chọn sẵn cho đỡ phải bấm.
  const defaultScaleId = answerScales.length === 1 ? String(answerScales[0].answerScaleId) : '';

  const openCreate = () => {
    setValidationError(null);
    setForm({
      ...emptyTemplateForm,
      questions: [{ questionText: '', answerScaleId: defaultScaleId, attentionCheckValue: '' }],
    });
    setIsEditorOpen(true);
  };

  const openEdit = (template: SurveyTemplate) => {
    setValidationError(null);
    setForm({
      surveyTemplateId: template.surveyTemplateId,
      templateName: template.templateName,
      questions: template.questions.map((question) => ({
        questionText: question.questionText,
        answerScaleId: String(question.answerScaleId),
        attentionCheckValue:
          question.attentionCheckValue === null ? '' : String(question.attentionCheckValue),
      })),
    });
    setIsEditorOpen(true);
  };

  const updateQuestion = (index: number, patch: Partial<QuestionForm>) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question, position) =>
        position === index ? { ...question, ...patch } : question
      ),
    }));
  };

  const addQuestion = () => {
    if (form.questions.length >= maximumQuestionsPerTemplate) {
      setValidationError(`Mỗi bộ câu hỏi chỉ được tối đa ${maximumQuestionsPerTemplate} câu.`);
      return;
    }
    setForm((prev) => ({
      ...prev,
      // Câu mới thường cùng thang với câu ngay trên nó.
      questions: [
        ...prev.questions,
        {
          questionText: '',
          answerScaleId: prev.questions.at(-1)?.answerScaleId ?? defaultScaleId,
          attentionCheckValue: '',
        },
      ],
    }));
  };

  const removeQuestion = (index: number) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, position) => position !== index),
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const templateName = form.templateName.trim();
    if (!templateName) {
      setValidationError('Vui lòng nhập tên bộ câu hỏi.');
      return;
    }

    const filled = form.questions
      .map((question) => ({ ...question, questionText: question.questionText.trim() }))
      .filter((question) => question.questionText.length > 0);

    if (filled.length === 0) {
      setValidationError('Bộ câu hỏi cần ít nhất một câu hỏi có nội dung.');
      return;
    }
    if (filled.length > maximumQuestionsPerTemplate) {
      setValidationError(`Mỗi bộ câu hỏi chỉ được tối đa ${maximumQuestionsPerTemplate} câu.`);
      return;
    }
    if (filled.some((question) => !question.answerScaleId)) {
      setValidationError('Vui lòng chọn thang trả lời cho từng câu hỏi.');
      return;
    }

    const payload = {
      templateName,
      questions: filled.map((question) => ({
        questionText: question.questionText,
        answerScaleId: Number(question.answerScaleId),
        // Để trống là câu bình thường; backend còn kiểm mức có thật của thang.
        attentionCheckValue: question.attentionCheckValue
          ? Number(question.attentionCheckValue)
          : null,
      })),
    };

    setSaving(true);
    try {
      if (form.surveyTemplateId === null) {
        await surveyApi.createTemplate(payload);
      } else {
        await surveyApi.updateTemplate(form.surveyTemplateId, payload);
      }
      setTemplates(await surveyApi.templates());
      toast.success(form.surveyTemplateId === null ? 'Đã tạo bộ câu hỏi' : 'Đã cập nhật bộ câu hỏi', {
        description: `${templateName} · ${filled.length} câu hỏi`,
      });
      setIsEditorOpen(false);
      setForm(emptyTemplateForm);
      setValidationError(null);
    } catch (error) {
      setValidationError(messageFrom(error));
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async (draft: SaveSurveyTemplatePayload): Promise<string | null> => {
    try {
      await surveyApi.createTemplate(draft);
      setTemplates(await surveyApi.templates());
      toast.success('Đã tạo bộ câu hỏi từ Excel', {
        description: `${draft.templateName} · ${draft.questions.length} câu hỏi`,
      });
      return null;
    } catch (error) {
      return messageFrom(error);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await surveyApi.deleteTemplate(deleting.surveyTemplateId);
      setTemplates(await surveyApi.templates());
      toast.success('Đã xóa bộ câu hỏi', { description: deleting.templateName });
    } catch (error) {
      toast.error('Không thể xóa bộ câu hỏi', { description: messageFrom(error) });
    } finally {
      setDeleting(null);
    }
  };

  // --------------------------------------------------------- Thang trả lời

  const openScaleCreate = () => {
    setScaleError(null);
    setDeletingScaleId(null);
    setScaleForm(emptyScaleForm);
  };

  const openScaleEdit = (scale: AnswerScale) => {
    setScaleError(null);
    setDeletingScaleId(null);
    setScaleForm({
      answerScaleId: scale.answerScaleId,
      answerScaleName: scale.answerScaleName,
      scaleKind: scale.scaleKind,
      options: scale.options
        .slice()
        .sort((left, right) => left.value - right.value)
        .map((option) => ({ value: String(option.value), displayText: option.displayText })),
    });
  };

  const handleSaveScale = async (event: React.FormEvent) => {
    event.preventDefault();

    const answerScaleName = scaleForm.answerScaleName.trim();
    if (!answerScaleName) {
      setScaleError('Vui lòng nhập tên thang trả lời.');
      return;
    }

    // Thang tự nhập chữ không có mức nào để nhập.
    if (scaleForm.scaleKind === 'Text') {
      await saveScale({ answerScaleName, scaleKind: 'Text', options: [] });
      return;
    }

    if (scaleForm.options.some((option) => !option.displayText.trim())) {
      setScaleError('Vui lòng nhập nhãn cho tất cả các mức.');
      return;
    }

    const values = scaleForm.options.map((option) => Number(option.value));
    if (values.some((value) => !Number.isInteger(value) || value < 1 || value > maximumAnswerScaleOptions)) {
      setScaleError(`Giá trị của mỗi mức phải là số nguyên từ 1 đến ${maximumAnswerScaleOptions}.`);
      return;
    }
    if (new Set(values).size !== values.length) {
      setScaleError('Hai mức không được trùng giá trị.');
      return;
    }

    await saveScale({
      answerScaleName,
      scaleKind: 'Options',
      options: scaleForm.options.map((option) => ({
        value: Number(option.value),
        displayText: option.displayText.trim(),
      })),
    });
  };

  const saveScale = async (payload: {
    answerScaleName: string;
    scaleKind: AnswerScaleKind;
    options: { value: number; displayText: string }[];
  }) => {
    const answerScaleName = payload.answerScaleName;

    setScaleSaving(true);
    try {
      if (scaleForm.answerScaleId === null) {
        await surveyApi.createAnswerScale(payload);
      } else {
        await surveyApi.updateAnswerScale(scaleForm.answerScaleId, payload);
      }
      setAnswerScales(await surveyApi.answerScales());
      toast.success(
        scaleForm.answerScaleId === null ? 'Đã tạo thang trả lời' : 'Đã cập nhật thang trả lời',
        { description: answerScaleName }
      );
      setScaleForm(emptyScaleForm);
      setScaleError(null);
    } catch (error) {
      setScaleError(messageFrom(error));
    } finally {
      setScaleSaving(false);
    }
  };

  const handleDeleteScale = async (answerScaleId: number) => {
    try {
      await surveyApi.deleteAnswerScale(answerScaleId);
      setAnswerScales(await surveyApi.answerScales());
      toast.success('Đã xóa thang trả lời');
      if (scaleForm.answerScaleId === answerScaleId) setScaleForm(emptyScaleForm);
    } catch (error) {
      setScaleError(messageFrom(error));
    } finally {
      setDeletingScaleId(null);
    }
  };

  const columns: Column<SurveyTemplate>[] = [
    {
      key: 'surveyTemplateId',
      header: 'Mã bộ',
      width: '90px',
      filterValue: (item) => String(item.surveyTemplateId),
      numeric: true,
      render: (item) => <span className="catalog-code">{item.surveyTemplateId}</span>,
    },
    {
      key: 'templateName',
      header: 'Tên bộ câu hỏi',
      filterValue: (item) => item.templateName,
      render: (item) => <span className="catalog-cell-primary">{item.templateName}</span>,
    },
    {
      key: 'answerScales',
      header: 'Thang trả lời',
      width: '260px',
      filterValue: scaleNamesOf,
      render: (item) => <span className="catalog-cell-primary">{scaleNamesOf(item) || '—'}</span>,
    },
    {
      key: 'questions',
      header: 'Số câu hỏi',
      width: '120px',
      filterValue: (item) => String(item.questions.length),
      numeric: true,
      render: (item) => (
        <span className="catalog-cell-primary">
          {item.questions.length}/{maximumQuestionsPerTemplate}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Ngày tạo',
      width: '120px',
      filterValue: (item) => formatDate(item.createdAt),
      render: (item) => <span className="catalog-cell-primary">{formatDate(item.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: 'Thao tác',
      width: '130px',
      render: (item) => (
        <div className="catalog-actions">
          <button
            type="button"
            className="catalog-icon-button"
            onClick={() => setViewing(item)}
            aria-label={`Xem bộ câu hỏi ${item.templateName}`}
            title="Xem câu hỏi"
          >
            <Eye aria-hidden="true" size={15} />
          </button>
          <button
            type="button"
            className="catalog-icon-button"
            onClick={() => openEdit(item)}
            aria-label={`Sửa bộ câu hỏi ${item.templateName}`}
            title="Sửa"
          >
            <Pencil aria-hidden="true" size={15} />
          </button>
          <button
            type="button"
            className="catalog-icon-button catalog-icon-button--danger"
            onClick={() => setDeleting(item)}
            aria-label={`Xóa bộ câu hỏi ${item.templateName}`}
            title="Xóa"
          >
            <Trash2 aria-hidden="true" size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="catalog-page catalog-page--wide survey-templates-page">
      <header className="catalog-page-header">
        <div>
          <h2>Bộ câu hỏi khảo sát</h2>
          <p>
            Bảng "SurveyTemplates" và "SurveyQuestions". Mỗi câu hỏi có thang trả lời riêng nên
            một bộ trộn được nhiều loại thang; mỗi bộ tối đa {maximumQuestionsPerTemplate} câu hỏi.
          </p>
        </div>
      </header>

      {loadError && (
        <div className="admin-alert" role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      )}

      {!loadError && !loading && answerScales.length === 0 && (
        <div className="admin-alert" role="status">
          <CircleAlert aria-hidden="true" />
          <span>
            Chưa có thang trả lời nào. Hãy tạo thang trả lời trước khi tạo bộ câu hỏi.
          </span>
        </div>
      )}

      <DataTable
        columns={columns}
        data={filtered}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm tên bộ câu hỏi..."
        onAddNew={openCreate}
        addNewLabel="Tạo bộ câu hỏi"
        toolbarActions={(
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm catalog-add-button"
              onClick={() => {
                openScaleCreate();
                setIsScalesOpen(true);
              }}
            >
              <ListChecks aria-hidden="true" size={16} />
              <span>Thang trả lời</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm catalog-add-button"
              onClick={() => setIsImportOpen(true)}
            >
              <FileSpreadsheet aria-hidden="true" size={16} />
              <span>Import Excel</span>
            </button>
          </>
        )}
        emptyMessage={loading ? 'Đang tải bộ câu hỏi...' : 'Chưa có bộ câu hỏi khảo sát nào.'}
        keyExtractor={(item) => String(item.surveyTemplateId)}
        pageSize={20}
      />

      <Modal
        isOpen={isEditorOpen}
        onClose={() => {
          if (saving) return;
          setIsEditorOpen(false);
          setValidationError(null);
        }}
        title={form.surveyTemplateId === null ? 'Tạo bộ câu hỏi khảo sát' : 'Sửa bộ câu hỏi khảo sát'}
      >
        <form className="catalog-form" onSubmit={(event) => void handleSubmit(event)}>
          {validationError && (
            <div className="catalog-validation-error" role="alert">{validationError}</div>
          )}

          <div className="form-group">
            <label htmlFor="survey-template-name">Tên bộ câu hỏi</label>
            <input
              id="survey-template-name"
              type="text"
              placeholder="VD: Khảo sát học phần học kỳ I"
              value={form.templateName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, templateName: event.target.value }))
              }
              required
            />
          </div>

          <section className="survey-question-editor" aria-label="Danh sách câu hỏi">
            <header className="survey-question-editor-header">
              <strong>Danh sách câu hỏi</strong>
              <span
                className={
                  form.questions.length >= maximumQuestionsPerTemplate
                    ? 'survey-question-counter is-full'
                    : 'survey-question-counter'
                }
              >
                {form.questions.length}/{maximumQuestionsPerTemplate} câu
              </span>
            </header>

            <div className="survey-question-rows">
              {form.questions.map((question, index) => (
                // Danh sách chỉ thêm/bớt ở cuối nên dùng vị trí làm key là đủ.
                <div className="survey-question-row" key={index}>
                  <span className="survey-question-row-index">{index + 1}</span>
                  <div className="survey-question-row-fields">
                    <textarea
                      rows={2}
                      placeholder="Nội dung câu hỏi"
                      aria-label={`Nội dung câu hỏi ${index + 1}`}
                      value={question.questionText}
                      onChange={(event) =>
                        updateQuestion(index, { questionText: event.target.value })
                      }
                    />
                    <select
                      aria-label={`Thang trả lời của câu hỏi ${index + 1}`}
                      value={question.answerScaleId}
                      onChange={(event) =>
                        updateQuestion(index, { answerScaleId: event.target.value })
                      }
                    >
                      <option value="">Chọn thang trả lời</option>
                      {answerScales.map((scale) => (
                        <option key={scale.answerScaleId} value={String(scale.answerScaleId)}>
                          {scale.answerScaleName}
                          {scale.scaleKind === 'Text' ? ' (tự nhập)' : ''}
                        </option>
                      ))}
                    </select>
                    {(() => {
                      // Câu bẫy chỉ đặt được trên thang có mức chọn sẵn: thang tự
                      // nhập chữ không có mức nào để bắt người ta chọn.
                      const scale = answerScales.find(
                        (item) => String(item.answerScaleId) === question.answerScaleId
                      );
                      const canTrap = scale?.scaleKind === 'Options';

                      return (
                        <label className="survey-question-trap">
                          <span>Câu bẫy — mức bắt buộc</span>
                          <select
                            aria-label={`Mức bắt buộc của câu bẫy cho câu hỏi ${index + 1}`}
                            value={canTrap ? question.attentionCheckValue : ''}
                            disabled={!canTrap}
                            title={
                              canTrap
                                ? undefined
                                : 'Chỉ đặt được câu bẫy trên thang có mức chọn sẵn'
                            }
                            onChange={(event) =>
                              updateQuestion(index, { attentionCheckValue: event.target.value })
                            }
                          >
                            <option value="">Không phải câu bẫy</option>
                            {(scale?.options ?? []).map((option) => (
                              <option key={option.answerScaleOptionId} value={String(option.value)}>
                                Mức {option.value} — {option.displayText}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    })()}
                  </div>
                  <button
                    type="button"
                    className="catalog-icon-button catalog-icon-button--danger"
                    onClick={() => removeQuestion(index)}
                    aria-label={`Xóa câu hỏi ${index + 1}`}
                    title="Xóa câu hỏi"
                  >
                    <Trash2 aria-hidden="true" size={15} />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={addQuestion}
              disabled={form.questions.length >= maximumQuestionsPerTemplate}
            >
              <Plus aria-hidden="true" size={16} />
              Thêm câu hỏi
            </button>
          </section>

          <div className="modal-footer catalog-form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsEditorOpen(false)}
              disabled={saving}
            >
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (
                <LoaderCircle className="auth-spin" aria-hidden="true" size={16} />
              ) : (
                <Save aria-hidden="true" size={16} />
              )}
              {form.surveyTemplateId === null ? 'Tạo bộ câu hỏi' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isScalesOpen}
        onClose={() => {
          if (scaleSaving) return;
          setIsScalesOpen(false);
          setScaleError(null);
        }}
        title="Thang trả lời"
      >
        <div className="answer-scale-manager">
          {scaleError && (
            <div className="catalog-validation-error" role="alert">{scaleError}</div>
          )}

          <section className="answer-scale-list" aria-label="Danh sách thang trả lời">
            {answerScales.length === 0 && (
              <p className="answer-scale-empty">Chưa có thang trả lời nào.</p>
            )}
            {answerScales.map((scale) => (
              <div className="answer-scale-row" key={scale.answerScaleId}>
                <div className="answer-scale-row-body">
                  <strong>
                    <span className="answer-scale-code">#{scale.answerScaleId}</span>{' '}
                    {scale.answerScaleName}
                  </strong>
                  <span>
                    {scale.scaleKind === 'Text'
                      ? 'Người trả lời tự nhập chữ'
                      : scale.options
                          .slice()
                          .sort((left, right) => left.value - right.value)
                          .map((option) => `${option.value}. ${option.displayText}`)
                          .join(' · ')}
                  </span>
                </div>
                {deletingScaleId === scale.answerScaleId ? (
                  <div className="answer-scale-confirm">
                    <span>Xóa thang này?</span>
                    <button
                      type="button"
                      className="btn catalog-danger-button btn-sm"
                      onClick={() => void handleDeleteScale(scale.answerScaleId)}
                    >
                      Xóa
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setDeletingScaleId(null)}
                    >
                      Hủy
                    </button>
                  </div>
                ) : (
                  <div className="catalog-actions">
                    <button
                      type="button"
                      className="catalog-icon-button"
                      onClick={() => openScaleEdit(scale)}
                      aria-label={`Sửa thang ${scale.answerScaleName}`}
                      title="Sửa"
                    >
                      <Pencil aria-hidden="true" size={15} />
                    </button>
                    <button
                      type="button"
                      className="catalog-icon-button catalog-icon-button--danger"
                      onClick={() => setDeletingScaleId(scale.answerScaleId)}
                      aria-label={`Xóa thang ${scale.answerScaleName}`}
                      title="Xóa"
                    >
                      <Trash2 aria-hidden="true" size={15} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </section>

          <form className="catalog-form" onSubmit={(event) => void handleSaveScale(event)}>
            <div className="catalog-form-grid catalog-form-grid--2">
              <div className="form-group">
                <label htmlFor="answer-scale-name">
                  {scaleForm.answerScaleId === null ? 'Tên thang mới' : 'Tên thang'}
                </label>
                <input
                  id="answer-scale-name"
                  type="text"
                  placeholder="VD: Mức độ hài lòng"
                  value={scaleForm.answerScaleName}
                  onChange={(event) =>
                    setScaleForm((prev) => ({ ...prev, answerScaleName: event.target.value }))
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="answer-scale-kind">Loại thang</label>
                <select
                  id="answer-scale-kind"
                  value={scaleForm.scaleKind}
                  onChange={(event) =>
                    setScaleForm((prev) => ({
                      ...prev,
                      scaleKind: event.target.value as AnswerScaleKind,
                    }))
                  }
                >
                  <option value="Options">Chọn mức có sẵn</option>
                  <option value="Text">Người trả lời tự nhập chữ</option>
                </select>
              </div>
            </div>

            {scaleForm.scaleKind === 'Text' ? (
              <p className="answer-scale-empty">
                Thang tự nhập không có mức nào. Câu hỏi dùng thang này không tính vào điểm
                trung bình của phiếu.
              </p>
            ) : (
              <>
                <div className="answer-scale-options">
                  {scaleForm.options.map((option, index) => (
                    // Số mức chỉ thay đổi ở cuối danh sách nên dùng vị trí làm key.
                    <div className="answer-scale-option-row" key={index}>
                      <select
                        className="answer-scale-option-value"
                        aria-label={`Giá trị của mức thứ ${index + 1}`}
                        value={option.value}
                        onChange={(event) =>
                          setScaleForm((prev) => ({
                            ...prev,
                            options: prev.options.map((current, position) =>
                              position === index
                                ? { ...current, value: event.target.value }
                                : current
                            ),
                          }))
                        }
                      >
                        {Array.from({ length: maximumAnswerScaleOptions }, (_, offset) => offset + 1).map(
                          (value) => (
                            <option key={value} value={String(value)}>
                              {value}
                            </option>
                          )
                        )}
                      </select>
                      <input
                        type="text"
                        placeholder={`Nhãn của mức thứ ${index + 1}`}
                        aria-label={`Nhãn của mức thứ ${index + 1}`}
                        value={option.displayText}
                        onChange={(event) =>
                          setScaleForm((prev) => ({
                            ...prev,
                            options: prev.options.map((current, position) =>
                              position === index
                                ? { ...current, displayText: event.target.value }
                                : current
                            ),
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>

                <p className="answer-scale-hint">
                  Giá trị quyết định điểm của mức đó. Thang chỉ có hai mức như "Có/Không" nên
                  dùng 1 và 5 để cùng dải điểm với thang mức độ hài lòng.
                </p>

                <div className="answer-scale-option-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      setScaleForm((prev) => {
                        // Gợi ý giá trị chưa dùng nhỏ nhất để đỡ phải sửa tay.
                        const used = new Set(prev.options.map((option) => Number(option.value)));
                        const next =
                          Array.from(
                            { length: maximumAnswerScaleOptions },
                            (_, offset) => offset + 1
                          ).find((value) => !used.has(value)) ?? 1;

                        return {
                          ...prev,
                          options: [...prev.options, { value: String(next), displayText: '' }],
                        };
                      })
                    }
                    disabled={scaleForm.options.length >= maximumAnswerScaleOptions}
                  >
                    <Plus aria-hidden="true" size={16} />
                    Thêm mức
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      setScaleForm((prev) => ({
                        ...prev,
                        options: prev.options.slice(0, -1),
                      }))
                    }
                    disabled={scaleForm.options.length <= 2}
                  >
                    Bớt mức
                  </button>
                </div>
              </>
            )}

            <div className="modal-footer catalog-form-actions">
              {scaleForm.answerScaleId !== null && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={openScaleCreate}
                  disabled={scaleSaving}
                >
                  Thêm thang mới
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={scaleSaving}>
                {scaleSaving ? (
                  <LoaderCircle className="auth-spin" aria-hidden="true" size={16} />
                ) : (
                  <Save aria-hidden="true" size={16} />
                )}
                {scaleForm.answerScaleId === null ? 'Tạo thang trả lời' : 'Lưu thang trả lời'}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      <Modal
        isOpen={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing ? `${viewing.templateName} (${viewing.questions.length} câu)` : ''}
      >
        <div className="survey-question-preview">
          {viewing && (
            <p className="survey-question-preview-scale">
              Thang trả lời đang dùng: <strong>{scaleNamesOf(viewing) || '—'}</strong>
            </p>
          )}
          <ol>
            {viewing?.questions.map((question) => (
              <li key={question.questionId}>
                {question.questionText}
                <span className="survey-question-preview-badge">
                  {scaleNameOf(question.answerScaleId)}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="modal-footer catalog-form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setViewing(null)}>
            Đóng
          </button>
        </div>
      </Modal>

      <SurveyTemplateImportDialog
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        answerScales={answerScales}
        onImport={handleImport}
      />

      <ConfirmDialog
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
        title="Xóa bộ câu hỏi khảo sát"
        recordName={deleting?.templateName ?? ''}
        warning={'Các câu hỏi trong bộ bị xóa theo (ON DELETE CASCADE).'}
      />
    </div>
  );
};
