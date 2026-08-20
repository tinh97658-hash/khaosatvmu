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
import { surveyApi, surveyErrorMessage } from '../services/surveyApi';
import { maximumAnswerScaleOptions, maximumQuestionsPerTemplate } from '../types';
import type { AnswerScale, SurveyTemplate } from '../types';
import '../styles/survey-operations.css';

interface TemplateForm {
  surveyTemplateId: number | null;
  templateName: string;
  answerScaleId: string;
  /** Mỗi phần tử là nội dung một câu hỏi ("SurveyQuestions"."QuestionText"). */
  questions: string[];
}

interface ScaleForm {
  answerScaleId: number | null;
  answerScaleName: string;
  /** Nhãn của các mức 1..n, n tối đa bằng maximumAnswerScaleOptions. */
  displayTexts: string[];
}

const emptyTemplateForm: TemplateForm = {
  surveyTemplateId: null,
  templateName: '',
  answerScaleId: '',
  questions: [''],
};

const emptyScaleForm: ScaleForm = {
  answerScaleId: null,
  answerScaleName: '',
  displayTexts: ['', '', '', '', ''],
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

  const normalized = search.trim().toLowerCase();
  const filtered = templates.filter(
    (item) => !normalized || item.templateName.toLowerCase().includes(normalized)
  );

  // ------------------------------------------------------------- Bộ câu hỏi

  const openCreate = () => {
    setValidationError(null);
    setForm({
      ...emptyTemplateForm,
      answerScaleId: answerScales.length === 1 ? String(answerScales[0].answerScaleId) : '',
    });
    setIsEditorOpen(true);
  };

  const openEdit = (template: SurveyTemplate) => {
    setValidationError(null);
    setForm({
      surveyTemplateId: template.surveyTemplateId,
      templateName: template.templateName,
      answerScaleId: String(template.answerScaleId),
      questions: template.questions.map((question) => question.questionText),
    });
    setIsEditorOpen(true);
  };

  const updateQuestion = (index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question, position) =>
        position === index ? value : question
      ),
    }));
  };

  const addQuestion = () => {
    if (form.questions.length >= maximumQuestionsPerTemplate) {
      setValidationError(`Mỗi bộ câu hỏi chỉ được tối đa ${maximumQuestionsPerTemplate} câu.`);
      return;
    }
    setForm((prev) => ({ ...prev, questions: [...prev.questions, ''] }));
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
    if (!form.answerScaleId) {
      setValidationError('Vui lòng chọn thang trả lời cho bộ câu hỏi.');
      return;
    }

    const questions = form.questions.map((question) => question.trim()).filter(Boolean);
    if (questions.length === 0) {
      setValidationError('Bộ câu hỏi cần ít nhất một câu hỏi có nội dung.');
      return;
    }
    if (questions.length > maximumQuestionsPerTemplate) {
      setValidationError(`Mỗi bộ câu hỏi chỉ được tối đa ${maximumQuestionsPerTemplate} câu.`);
      return;
    }

    const payload = {
      templateName,
      answerScaleId: Number(form.answerScaleId),
      questions,
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
        description: `${templateName} · ${questions.length} câu hỏi`,
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

  const handleImport = async (draft: {
    templateName: string;
    answerScaleId: number;
    questions: string[];
  }): Promise<string | null> => {
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
      displayTexts: scale.options
        .slice()
        .sort((left, right) => left.value - right.value)
        .map((option) => option.displayText),
    });
  };

  const handleSaveScale = async (event: React.FormEvent) => {
    event.preventDefault();

    const answerScaleName = scaleForm.answerScaleName.trim();
    if (!answerScaleName) {
      setScaleError('Vui lòng nhập tên thang trả lời.');
      return;
    }
    if (scaleForm.displayTexts.some((text) => !text.trim())) {
      setScaleError('Vui lòng nhập nhãn cho tất cả các mức.');
      return;
    }

    const payload = {
      answerScaleName,
      options: scaleForm.displayTexts.map((displayText, index) => ({
        value: index + 1,
        displayText: displayText.trim(),
      })),
    };

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
      key: 'answerScaleId',
      header: 'Thang trả lời',
      width: '220px',
      filterValue: (item) => scaleNameOf(item.answerScaleId),
      render: (item) => (
        <span className="catalog-cell-primary">{scaleNameOf(item.answerScaleId)}</span>
      ),
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
            Bảng "SurveyTemplates" và "SurveyQuestions". Mỗi bộ dùng chung một thang trả lời và tối
            đa {maximumQuestionsPerTemplate} câu hỏi.
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

          <div className="catalog-form-grid catalog-form-grid--2">
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
            <div className="form-group">
              <label htmlFor="survey-template-scale">Thang trả lời</label>
              <select
                id="survey-template-scale"
                value={form.answerScaleId}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, answerScaleId: event.target.value }))
                }
                required
              >
                <option value="">Chọn thang trả lời</option>
                {answerScales.map((scale) => (
                  <option key={scale.answerScaleId} value={String(scale.answerScaleId)}>
                    {scale.answerScaleName}
                  </option>
                ))}
              </select>
            </div>
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
                  <textarea
                    rows={2}
                    placeholder="Nội dung câu hỏi"
                    aria-label={`Nội dung câu hỏi ${index + 1}`}
                    value={question}
                    onChange={(event) => updateQuestion(index, event.target.value)}
                  />
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
                  <strong>{scale.answerScaleName}</strong>
                  <span>
                    {scale.options
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

            <div className="answer-scale-options">
              {scaleForm.displayTexts.map((displayText, index) => (
                // Số mức chỉ thay đổi ở cuối danh sách nên dùng vị trí làm key.
                <div className="answer-scale-option-row" key={index}>
                  <span className="answer-scale-option-value">{index + 1}</span>
                  <input
                    type="text"
                    placeholder={`Nhãn của mức ${index + 1}`}
                    aria-label={`Nhãn của mức ${index + 1}`}
                    value={displayText}
                    onChange={(event) =>
                      setScaleForm((prev) => ({
                        ...prev,
                        displayTexts: prev.displayTexts.map((text, position) =>
                          position === index ? event.target.value : text
                        ),
                      }))
                    }
                  />
                </div>
              ))}
            </div>

            <div className="answer-scale-option-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  setScaleForm((prev) => ({
                    ...prev,
                    displayTexts: [...prev.displayTexts, ''],
                  }))
                }
                disabled={scaleForm.displayTexts.length >= maximumAnswerScaleOptions}
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
                    displayTexts: prev.displayTexts.slice(0, -1),
                  }))
                }
                disabled={scaleForm.displayTexts.length <= 2}
              >
                Bớt mức
              </button>
            </div>

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
              Thang trả lời: <strong>{scaleNameOf(viewing.answerScaleId)}</strong>
            </p>
          )}
          <ol>
            {viewing?.questions.map((question) => (
              <li key={question.questionId}>{question.questionText}</li>
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
