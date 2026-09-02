import { useId, useRef, useState } from 'react';
import { FileSpreadsheet, LoaderCircle, Upload } from 'lucide-react';
import { Modal } from '../Modal';
import type { GraduationPeriod } from '../../types/graduationAnalytics';
import {
  GraduationImportFileError,
  parseGraduationImportFile,
  type GraduationParsedFile,
} from '../../utils/graduationImportExcel';

interface GraduationImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (payload: {
    originalFileName: string;
    sourceSheetName: string;
    rows: GraduationParsedFile['rows'];
  }) => Promise<GraduationPeriod>;
}

const errorMessages: Record<string, string> = {
  FILE_TYPE: 'Chỉ chấp nhận file Excel định dạng .xlsx.',
  FILE_SIZE: 'File Excel không được lớn hơn 5 MB.',
  READ_FAILED: 'Không thể đọc file. Hãy kiểm tra file không bị hỏng hoặc đặt mật khẩu.',
  SHEET_STRUCTURE_INVALID: 'Không tìm thấy đúng bộ 16 cột C–R được đánh số 1–6, 10–19.',
  LEGACY_STRUCTURE_UNSUPPORTED: 'File còn cấu trúc 19 cột cũ (cột 7–9). Hãy dùng biểu mẫu mới 16 cột.',
  NO_DATA_ROWS: 'File chưa có dòng dữ liệu nào.',
  TOO_MANY_ROWS: 'Mỗi lần chỉ được import tối đa 5.000 dòng.',
  VALUE_TYPE_INVALID: 'Có ô số lượng hoặc tỷ lệ không phải dạng số.',
  REVIEW_PERIOD_INVALID: 'Thời điểm xét tốt nghiệp phải có dạng như T7 - 2026.',
  MULTIPLE_REVIEW_PERIODS: 'Mỗi file chỉ được chứa một đợt tốt nghiệp.',
};

const display = (value: string | number | null, percent = false) => {
  if (value === null || value === '') return '—';
  return percent ? `${Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 4 })}%` : value;
};

export function GraduationImportDialog({ isOpen, onClose, onImport }: GraduationImportDialogProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<GraduationParsedFile | null>(null);
  const [previewMode, setPreviewMode] = useState<'all' | 'metrics'>('all');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    if (inputRef.current) inputRef.current.value = '';
    setFileName('');
    setParsed(null);
    setPreviewMode('all');
    setError(null);
  };

  const handleClose = () => {
    if (parsing || importing) return;
    reset();
    onClose();
  };

  const handleFile = async (file?: File) => {
    reset();
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    try {
      setParsed(await parseGraduationImportFile(file));
    } catch (caught) {
      const code = caught instanceof GraduationImportFileError ? caught.code : 'READ_FAILED';
      const row = caught instanceof GraduationImportFileError && caught.rowNumber
        ? ` Dòng ${caught.rowNumber}.`
        : '';
      const periods = caught instanceof GraduationImportFileError && caught.periods?.length
        ? ` Các đợt tìm thấy: ${caught.periods.join(', ')}.`
        : '';
      setError(`${errorMessages[code] ?? errorMessages.READ_FAILED}${row}${periods}`);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!parsed || !fileName) return;
    setImporting(true);
    setError(null);
    try {
      await onImport({
        originalFileName: fileName,
        sourceSheetName: parsed.sheetName,
        rows: parsed.rows,
      });
      reset();
      onClose();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      setError(message === 'GRADUATION_PERIOD_EXISTS'
        ? `Đợt ${parsed.reviewPeriod.label} đã tồn tại. Hãy dùng thao tác thay thế đợt khi cần sửa dữ liệu.`
        : 'Không thể lưu đợt tốt nghiệp. Dữ liệu preview vẫn được giữ để bạn thử lại.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import đợt tốt nghiệp"
      size={parsed ? 'data-preview' : 'import'}
    >
      <div className="graduation-import" aria-busy={parsing || importing}>
        <div className={`graduation-import__picker${fileName ? ' has-file' : ''}`}>
          <div className="graduation-import__file-icon" aria-hidden="true">
            <FileSpreadsheet size={24} />
          </div>
          <div className="graduation-import__file-copy">
            <strong>{fileName || 'Chọn file dữ liệu tốt nghiệp'}</strong>
            <span>Excel .xlsx · tối đa 5 MB · 16 cột C–R · một file là một đợt</span>
          </div>
          <label htmlFor={inputId} className="btn btn-secondary">
            {fileName ? 'Chọn file khác' : 'Chọn file Excel'}
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept=".xlsx"
            onChange={(event) => void handleFile(event.target.files?.[0])}
            disabled={parsing || importing}
          />
        </div>

        {parsing && <div className="graduation-state"><LoaderCircle className="spin" /> Đang đọc file...</div>}
        {error && <div className="graduation-alert" role="alert">{error}</div>}

        {parsed && (
          <>
            <div className="graduation-import__summary">
              <div><strong>{parsed.reviewPeriod.label}</strong><span>đợt phát hiện</span></div>
              <div><strong>{parsed.rows.length}</strong><span>dòng sẵn sàng import</span></div>
              <div><strong>16</strong><span>cột dữ liệu nguồn</span></div>
              <div><strong>{parsed.sheetName}</strong><span>sheet được đọc</span></div>
            </div>

            {parsed.warnings.map((warning) => (
              <div className="graduation-alert" role="status" key={warning.code}>
                Có {warning.groups.length} nhóm trùng Khoa + CTĐT + Khóa. Các dòng nguồn vẫn được giữ
                riêng và sẽ được cộng khi phân tích: {warning.groups.map((group) =>
                  `${group.label} (dòng ${group.sourceRowNumbers.join(', ')})`).join('; ')}.
              </div>
            ))}

            <div className="graduation-preview-toolbar" aria-label="Tùy chọn cột xem trước">
              <span>Xem trước dữ liệu</span>
              <div role="group" aria-label="Nhóm cột hiển thị">
                <button type="button" className={previewMode === 'all' ? 'is-selected' : ''} onClick={() => setPreviewMode('all')}>Tất cả cột</button>
                <button type="button" className={previewMode === 'metrics' ? 'is-selected' : ''} onClick={() => setPreviewMode('metrics')}>Chỉ tiêu</button>
              </div>
            </div>
            <div className="graduation-preview" aria-label="Xem trước dữ liệu import">
              <table className={previewMode === 'metrics' ? 'is-metrics-only' : ''}>
                <thead>
                  <tr>
                    <th rowSpan={2}>Dòng</th>
                    {previewMode === 'all' && <th colSpan={6}>Thông tin chính</th>}
                    <th colSpan={10}>Thông số trong đợt xét tốt nghiệp</th>
                  </tr>
                  <tr>
                    {previewMode === 'all' && <><th>Khoa</th><th>Mã CTĐT</th><th>Tên CTĐT</th><th>Khóa</th><th>Nhập học</th><th>Thời điểm</th></>}
                    <th>XS</th><th>% XS</th>
                    <th>Giỏi</th><th>% Giỏi</th><th>Khá</th><th>% Khá</th><th>T.Bình</th><th>% T.Bình</th>
                    <th>VHVL</th><th>% VHVL</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 100).map((row) => (
                    <tr key={row.sourceRowNumber}>
                      <td>{row.sourceRowNumber}</td>
                      {previewMode === 'all' && <><td>{row.facultyName}</td><td>{display(row.programCode)}</td>
                        <td>{row.programName}</td><td>{row.cohort}</td><td>{display(row.initialEnrollmentCount)}</td>
                        <td>{row.reviewPeriodText}</td></>}
                      <td>{display(row.excellentCount)}</td><td>{display(row.excellentRate, true)}</td>
                      <td>{display(row.veryGoodCount)}</td><td>{display(row.veryGoodRate, true)}</td>
                      <td>{display(row.goodCount)}</td><td>{display(row.goodRate, true)}</td>
                      <td>{display(row.averageCount)}</td><td>{display(row.averageRate, true)}</td>
                      <td>{display(row.workStudyTransferCount)}</td><td>{display(row.workStudyTransferRate, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsed.rows.length > 100 && <p className="graduation-note">Đang xem 100/{parsed.rows.length} dòng đầu tiên.</p>}
          </>
        )}

        <div className="graduation-import__actions">
          <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={parsing || importing}>Hủy</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleImport()}
            disabled={!parsed || importing}
          >
            {importing ? <LoaderCircle className="spin" aria-hidden="true" /> : <Upload aria-hidden="true" size={17} />}
            {importing ? 'Đang lưu...' : `Import đợt ${parsed?.reviewPeriod.label ?? ''}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
