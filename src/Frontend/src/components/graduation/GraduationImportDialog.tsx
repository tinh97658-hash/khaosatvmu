import { useId, useRef, useState } from 'react';
import { FileSpreadsheet, LoaderCircle, Upload } from 'lucide-react';
import { Modal } from '../Modal';
import type { GraduationDataset } from '../../types/graduationAnalytics';
import {
  GraduationImportFileError,
  parseGraduationImportFile,
  type GraduationParsedFile,
} from '../../utils/graduationImportExcel';

interface GraduationImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (payload: {
    datasetName: string;
    originalFileName: string;
    sourceSheetName: string;
    rows: GraduationParsedFile['rows'];
  }) => Promise<GraduationDataset>;
}

const errorMessages: Record<string, string> = {
  FILE_TYPE: 'Chỉ chấp nhận file Excel định dạng .xlsx.',
  FILE_SIZE: 'File Excel không được lớn hơn 5 MB.',
  READ_FAILED: 'Không thể đọc file. Hãy kiểm tra file không bị hỏng hoặc đặt mật khẩu.',
  SHEET_STRUCTURE_INVALID: 'Không tìm thấy đầy đủ 19 cột C–U của biểu mẫu.',
  NO_DATA_ROWS: 'File chưa có dòng dữ liệu nào.',
  TOO_MANY_ROWS: 'Mỗi lần chỉ được import tối đa 5.000 dòng.',
  VALUE_TYPE_INVALID: 'Có ô số lượng hoặc tỷ lệ không phải dạng số.',
  REVIEW_PERIOD_INVALID: 'Thời điểm xét tốt nghiệp phải có dạng như T7 - 2026.',
};

const display = (value: string | number | null, percent = false) => {
  if (value === null || value === '') return '—';
  return percent ? `${Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 4 })}%` : value;
};

export function GraduationImportDialog({ isOpen, onClose, onImport }: GraduationImportDialogProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [datasetName, setDatasetName] = useState('');
  const [parsed, setParsed] = useState<GraduationParsedFile | null>(null);
  const [previewMode, setPreviewMode] = useState<'all' | 'metrics'>('all');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    if (inputRef.current) inputRef.current.value = '';
    setFileName('');
    setDatasetName('');
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
    setDatasetName(file.name.replace(/\.xlsx$/i, ''));
    setParsing(true);
    try {
      setParsed(await parseGraduationImportFile(file));
    } catch (caught) {
      const code = caught instanceof GraduationImportFileError ? caught.code : 'READ_FAILED';
      const row = caught instanceof GraduationImportFileError && caught.rowNumber
        ? ` Dòng ${caught.rowNumber}.`
        : '';
      setError(`${errorMessages[code] ?? errorMessages.READ_FAILED}${row}`);
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
        datasetName: datasetName.trim(),
        originalFileName: fileName,
        sourceSheetName: parsed.sheetName,
        rows: parsed.rows,
      });
      reset();
      onClose();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      setError(message === 'GRADUATION_IMPORT_DUPLICATE'
        ? 'Nội dung file này đã được import trước đó.'
        : 'Không thể lưu bộ dữ liệu. Dữ liệu preview vẫn được giữ để bạn thử lại.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import dữ liệu tốt nghiệp">
      <div className="graduation-import" aria-busy={parsing || importing}>
        <div className="graduation-import__picker">
          <label htmlFor={inputId} className="btn btn-secondary">
            <FileSpreadsheet aria-hidden="true" size={17} />
            {fileName || 'Chọn file Excel'}
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept=".xlsx"
            onChange={(event) => void handleFile(event.target.files?.[0])}
            disabled={parsing || importing}
          />
          <span>Định dạng .xlsx · tối đa 5 MB · đọc đủ các cột C–U</span>
        </div>

        {parsing && <div className="graduation-state"><LoaderCircle className="spin" /> Đang đọc file...</div>}
        {error && <div className="graduation-alert" role="alert">{error}</div>}

        {parsed && (
          <>
            <div className="graduation-import__summary">
              <label>
                Tên bộ dữ liệu
                <input value={datasetName} onChange={(event) => setDatasetName(event.target.value)} />
              </label>
              <div><strong>{parsed.rows.length}</strong><span>dòng sẵn sàng import</span></div>
              <div><strong>19</strong><span>cột dữ liệu nguồn</span></div>
              <div><strong>{parsed.sheetName}</strong><span>sheet được đọc</span></div>
            </div>

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
                    <th colSpan={13}>Thông số trong đợt xét tốt nghiệp</th>
                  </tr>
                  <tr>
                    {previewMode === 'all' && <><th>Khoa</th><th>Mã CTĐT</th><th>Tên CTĐT</th><th>Khóa</th><th>Nhập học</th><th>Thời điểm</th></>}
                    <th>Được xét</th><th>Đúng hạn</th><th>Tỷ lệ</th><th>XS</th><th>% XS</th>
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
                      <td>{display(row.eligibleGraduateCount)}</td>
                      <td>{display(row.onTimeGraduateCount)}</td><td>{display(row.onTimeGraduateRate, true)}</td>
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
            disabled={!parsed || importing || !datasetName.trim()}
          >
            {importing ? <LoaderCircle className="spin" aria-hidden="true" /> : <Upload aria-hidden="true" size={17} />}
            {importing ? 'Đang lưu...' : 'Import và tạo dashboard'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
