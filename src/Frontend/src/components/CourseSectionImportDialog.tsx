import { useId, useRef, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  RotateCcw,
  Upload,
} from 'lucide-react';
import {
  downloadCourseSectionImportTemplate,
  parseCourseSectionImportFile,
  CourseSectionImportFileError,
  type CourseSectionImportFileErrorCode,
  type ImportCourseSectionRow,
} from '../utils/courseSectionImportExcel';
import { ApiError } from '../services/apiClient';
import { catalogErrorMessage, type CatalogImportResponse } from '../services/catalogApi';
import { Modal } from './Modal';

interface CourseSectionImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Học kỳ đang chọn, hiển thị để người dùng biết import vào đâu. */
  semesterLabel: string;
  onImport: (rows: ImportCourseSectionRow[]) => Promise<CatalogImportResponse>;
}

const fileErrorMessages: Record<CourseSectionImportFileErrorCode, string> = {
  FILE_TYPE: 'Chỉ chấp nhận tệp Excel có định dạng .xlsx.',
  FILE_SIZE: 'Tệp Excel không được lớn hơn 5 MB.',
  FILE_EMPTY: 'Tệp Excel không có dữ liệu.',
  CODE_HEADER_MISSING: 'Không tìm thấy cột "Mã học phần" trong hàng tiêu đề.',
  NAME_HEADER_MISSING: 'Không tìm thấy cột "Tên lớp" trong hàng tiêu đề.',
  NO_DATA_ROWS: 'Tệp Excel chưa có dòng lớp học phần nào.',
  TOO_MANY_ROWS: 'Mỗi lần chỉ được import tối đa 500 lớp học phần.',
  READ_FAILED: 'Không thể đọc tệp Excel. Hãy kiểm tra tệp không bị hỏng hoặc đặt mật khẩu.',
};

export function CourseSectionImportDialog({
  isOpen,
  onClose,
  semesterLabel,
  onImport,
}: CourseSectionImportDialogProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ImportCourseSectionRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<CatalogImportResponse | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const reset = () => {
    if (inputRef.current) inputRef.current.value = '';
    setFileName('');
    setRows([]);
    setParseError(null);
    setRequestError(null);
    setResult(null);
  };

  const handleClose = () => {
    if (parsing || importing) return;
    reset();
    onClose();
  };

  const handleFileChange = async (file?: File) => {
    reset();
    if (!file) return;

    setFileName(file.name);
    setParsing(true);
    try {
      setRows(await parseCourseSectionImportFile(file));
    } catch (error) {
      setParseError(
        error instanceof CourseSectionImportFileError
          ? fileErrorMessages[error.code]
          : fileErrorMessages.READ_FAILED
      );
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    setRequestError(null);
    try {
      setResult(await onImport(rows));
    } catch (error) {
      setRequestError(
        error instanceof ApiError ? catalogErrorMessage(error.errorCode) : catalogErrorMessage(null)
      );
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    setTemplateError(null);
    try {
      await downloadCourseSectionImportTemplate();
    } catch {
      setTemplateError('Không thể tạo tệp mẫu. Hãy thử lại.');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const failedItems = result?.items.filter((item) => !item.succeeded) ?? [];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import lớp học phần từ Excel">
      <div className="admin-import-dialog" aria-busy={parsing}>
        <div className="admin-form-intro">
          <FileSpreadsheet aria-hidden="true" />
          <p>
            Hàng đầu tiên cần có cột <strong>Mã học phần</strong> và <strong>Tên lớp</strong>. Học
            phần tra theo mã, cột Tên học phần chỉ để đối chiếu. Giảng viên tra theo{' '}
            <strong>Email</strong>; nếu bỏ trống email thì tra theo họ tên, thu hẹp bằng bộ môn và
            khoa viện. Tối đa 500 dòng.
          </p>
        </div>

        <div className="catalog-context-band">
          Import vào học kỳ: <strong>{semesterLabel}</strong>
        </div>

        {!result && (
          <>
            <div className="import-template-row">
              <span>Chưa có tệp đúng định dạng? Tải tệp mẫu rồi điền dữ liệu vào.</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void handleDownloadTemplate()}
                disabled={downloadingTemplate}
              >
                {downloadingTemplate ? (
                  <LoaderCircle className="auth-spin" aria-hidden="true" />
                ) : (
                  <Download aria-hidden="true" />
                )}
                {downloadingTemplate ? 'Đang tạo tệp...' : 'Tải file mẫu'}
              </button>
            </div>

            {templateError && (
              <div className="admin-alert" role="alert">
                <CircleAlert aria-hidden="true" />
                <span>{templateError}</span>
              </div>
            )}

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
                disabled={parsing}
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

            {requestError && (
              <div className="admin-alert" role="alert">
                <CircleAlert aria-hidden="true" />
                <span>{requestError}</span>
              </div>
            )}

            {rows.length > 0 && (
              <section className="admin-import-preview" aria-label="Xem trước dữ liệu import">
                <header>
                  <strong>{rows.length} lớp học phần sẵn sàng import</strong>
                  <span>Hiển thị {Math.min(rows.length, 8)} dòng đầu</span>
                </header>
                <div className="admin-import-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Dòng</th>
                        <th>Mã học phần</th>
                        <th>Tên học phần</th>
                        <th>Tên lớp</th>
                        <th>Sĩ số</th>
                        <th>Giảng viên</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 8).map((row) => (
                        <tr key={row.rowNumber}>
                          <td>{row.rowNumber}</td>
                          <td>
                            {row.courseCode || (
                              <span className="admin-import-invalid">Thiếu mã</span>
                            )}
                          </td>
                          <td>{row.courseName || '—'}</td>
                          <td>
                            {row.sectionName || (
                              <span className="admin-import-invalid">Thiếu tên lớp</span>
                            )}
                          </td>
                          <td>{row.classSize || '0'}</td>
                          <td>
                            {row.lecturerEmail || row.lecturerFullName || (
                              <span className="admin-import-invalid">Thiếu giảng viên</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        {result && (
          <section className="admin-import-result" aria-live="polite">
            <div className={`admin-import-summary ${result.skippedCount > 0 ? 'has-warnings' : ''}`}>
              {result.skippedCount > 0 ? (
                <CircleAlert aria-hidden="true" />
              ) : (
                <CheckCircle2 aria-hidden="true" />
              )}
              <div>
                <strong>Hoàn tất import {result.totalCount} dòng</strong>
                <span>
                  {result.createdCount} đã thêm, {result.skippedCount} bị bỏ qua
                </span>
              </div>
            </div>

            {failedItems.length > 0 && (
              <div className="admin-import-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Dòng</th>
                      <th>Tên lớp</th>
                      <th>Mã học phần</th>
                      <th>Lý do bỏ qua</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedItems.map((item) => (
                      <tr key={`${item.rowNumber}-${item.name}`}>
                        <td>{item.rowNumber}</td>
                        <td>{item.name || 'Không có'}</td>
                        <td>{item.facultyName || 'Không có'}</td>
                        <td>{catalogErrorMessage(item.errorCode)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <div className="modal-footer admin-inline-footer">
          {result ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={reset}>
                <RotateCcw aria-hidden="true" />
                Import file khác
              </button>
              <button type="button" className="btn btn-primary" onClick={handleClose}>
                Đóng
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClose}
                disabled={parsing || importing}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleImport()}
                disabled={rows.length === 0 || parsing || importing}
              >
                {importing ? (
                  <LoaderCircle className="auth-spin" aria-hidden="true" />
                ) : (
                  <Upload aria-hidden="true" />
                )}
                {importing ? 'Đang lưu...' : `Import ${rows.length || ''} lớp học phần`}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
