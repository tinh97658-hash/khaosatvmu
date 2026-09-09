import { useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';

interface ExportFailedRowsButtonProps {
  /** Số dòng lỗi, dùng luôn trong nhãn để người dùng biết sẽ xuất ra bao nhiêu. */
  count: number;
  onExport: () => Promise<void>;
  label?: string;
}

/**
 * Nút xuất các dòng import bị lỗi ra tệp Excel.
 *
 * Tệp lớp học phần thật có 500-2000 dòng nên khi hỏng vài chục dòng thì dò trên
 * màn hình là không xuể. Tệp xuất ra giữ nguyên bố cục cột của tệp mẫu kèm số
 * dòng gốc và lý do, sửa xong nạp lại được ngay chính tệp đó.
 */
export function ExportFailedRowsButton({ count, onExport, label }: ExportFailedRowsButtonProps) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (count === 0) return null;

  const handleClick = async () => {
    setExporting(true);
    setError(null);
    try {
      await onExport();
    } catch {
      setError('Không tạo được tệp dòng lỗi. Hãy thử lại.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="admin-import-export-failed">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => void handleClick()}
        disabled={exporting}
      >
        {exporting ? (
          <LoaderCircle className="auth-spin" aria-hidden="true" />
        ) : (
          <Download aria-hidden="true" />
        )}
        {exporting ? 'Đang tạo tệp...' : `${label ?? 'Xuất'} ${count} dòng lỗi ra Excel`}
      </button>
      {error && <span className="admin-import-export-failed-error">{error}</span>}
    </div>
  );
}
