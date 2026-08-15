import { useId, useRef, useState } from 'react';
import { CircleAlert, Download, FileSpreadsheet, LoaderCircle, Upload } from 'lucide-react';
import {
  downloadSurveyTemplateImportTemplate,
  parseSurveyTemplateImportFile,
  SurveyTemplateImportFileError,
  type ImportSurveyQuestionRow,
  type SurveyTemplateImportFileErrorCode,
} from '../utils/surveyTemplateImportExcel';
import { maximumQuestionsPerTemplate } from '../types';
import type { AnswerScale } from '../types';
import { Modal } from './Modal';
import '../styles/auth-admin.css';

interface SurveyTemplateImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  answerScales: AnswerScale[];
  /** Tạo bộ câu hỏi qua API. Trả về thông báo lỗi, null nếu thành công. */
  onImport: (draft: {
    templateName: string;
    answerScaleId: number;
    questions: string[];
  }) => Promise<string | null>;
}

const fileErrorMessages: Record<SurveyTemplateImportFileErrorCode, string> = {
  FILE_TYPE: 'Chỉ chấp nhận tệp Excel có định dạng .xlsx.',
  FILE_SIZE: 'Tệp Excel không được lớn hơn 5 MB.',
  FILE_EMPTY: 'Tệp Excel không có dữ liệu.',
  QUESTION_HEADER_MISSING: 'Không tìm thấy cột "Nội dung câu hỏi" trong hàng tiêu đề.',
  NO_DATA_ROWS: 'Tệp Excel chưa có câu hỏi nào.',
  TOO_MANY_ROWS: `Mỗi bộ câu hỏi chỉ được tối đa ${maximumQuestionsPerTemplate} câu.`,
  READ_FAILED: 'Không thể đọc tệp Excel. Hãy kiểm tra tệp không bị hỏng hoặc đặt mật khẩu.',
};

export function SurveyTemplateImportDialog({
  isOpen,
  onClose,
  answerScales,
  onImport,
}: SurveyTemplateImportDialogProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [templateName, setTemplateName] = useState('');
  const [answerScaleId, setAnswerScaleId] = useState('');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ImportSurveyQuestionRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetFile = () => {
    if (inputRef.current) inputRef.current.value = '';
    setFileName('');
    setRows([]);
    setParseError(null);
    setFormError(null);
  };

  const handleClose = () => {
    if (parsing || saving) return;
    resetFile();
    setTemplateName('');
    setAnswerScaleId('');
    onClose();
  };

  const handleFileChange = async (file?: File) => {
    resetFile();
    if (!file) return;

    setFileName(file.name);
    setParsing(true);
    try {
      setRows(await parseSurveyTemplateImportFile(file));
      // Chưa đặt tên bộ thì lấy tạm tên tệp cho đỡ phải gõ lại.
      if (!templateName.trim()) setTemplateName(file.name.replace(/\.xlsx$/i, ''));
    } catch (error) {
      setParseError(
        error instanceof SurveyTemplateImportFileError
          ? fileErrorMessages[error.code]
          : fileErrorMessages.READ_FAILED
      );
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    if (!templateName.trim()) {
      setFormError('Vui lòng nhập tên bộ câu hỏi.');
      return;
    }
    if (!answerScaleId) {
      setFormError('Vui lòng chọn thang trả lời cho bộ câu hỏi.');
      return;
    }

    setSaving(true);
    const message = await onImport({
      templateName: templateName.trim(),
      answerScaleId: Number(answerScaleId),
      questions: rows.map((row) => row.questionText),
    });
    setSaving(false);

    if (message) {
      setFormError(message);
      return;
    }
    handleClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Tạo bộ câu hỏi từ Excel">
      <div className="admin-import-dialog" aria-busy={parsing || saving}>
        <div className="admin-form-intro">
          <FileSpreadsheet aria-hidden="true" />
          <p>
            Hàng đầu tiên cần có cột <strong>Nội dung câu hỏi</strong>, mỗi dòng tiếp theo là một
            câu hỏi ghi vào bảng "SurveyQuestions". Mỗi bộ tối đa{' '}
            {maximumQuestionsPerTemplate} câu.
          </p>
        </div>

        <div className="import-template-row">
          <span>Chưa có tệp đúng định dạng? Tải tệp mẫu rồi điền câu hỏi vào.</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void downloadSurveyTemplateImportTemplate()}
          >
            <Download aria-hidden="true" />
            Tải file mẫu
          </button>
        </div>

        <div className="survey-template-import-fields">
          <div className="form-group">
            <label htmlFor={`${inputId}-name`}>Tên bộ câu hỏi</label>
            <input
              id={`${inputId}-name`}
              type="text"
              placeholder="VD: Khảo sát học phần học kỳ I"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor={`${inputId}-scale`}>Thang trả lời</label>
            <select
              id={`${inputId}-scale`}
              value={answerScaleId}
              onChange={(event) => setAnswerScaleId(event.target.value)}
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

        <label className="admin-import-picker" htmlFor={inputId}>
          <Upload aria-hidden="true" />
          <span>
            <strong>{fileName || 'Chọn tệp Excel'}</strong>
            <small>Định dạng .xlsx, dung lượng tối đa 5 MB</small>
          </span>
          <span className="btn btn-secondary">Chọn file</span>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={parsing || saving}
            onChange={(event) => void handleFileChange(event.target.files?.[0])}
          />
        </label>

        {parsing && (
          <div className="admin-import-state" role="status">
            <LoaderCircle className="auth-spin" aria-hidden="true" />
            Đang đọc tệp Excel...
          </div>
        )}

        {parseError && (
          <div className="admin-alert" role="alert">
            <CircleAlert aria-hidden="true" />
            <span>{parseError}</span>
          </div>
        )}

        {formError && (
          <div className="admin-alert" role="alert">
            <CircleAlert aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}

        {rows.length > 0 && (
          <section className="admin-import-preview" aria-label="Xem trước câu hỏi">
            <header>
              <strong>
                {rows.length}/{maximumQuestionsPerTemplate} câu hỏi sẵn sàng
              </strong>
              <span>Hiển thị {Math.min(rows.length, 8)} câu đầu</span>
            </header>
            <div className="admin-import-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Dòng</th>
                    <th>Nội dung câu hỏi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 8).map((row) => (
                    <tr key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      <td>{row.questionText}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <div className="modal-footer admin-inline-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleClose}
            disabled={parsing || saving}
          >
            Hủy
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleImport()}
            disabled={rows.length === 0 || parsing || saving}
          >
            {saving ? (
              <LoaderCircle className="auth-spin" aria-hidden="true" />
            ) : (
              <Upload aria-hidden="true" />
            )}
            {saving ? 'Đang lưu...' : `Tạo bộ ${rows.length || ''} câu hỏi`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
