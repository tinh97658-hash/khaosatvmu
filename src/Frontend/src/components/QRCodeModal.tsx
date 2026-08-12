import React from 'react';
import { Copy, Download, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from './Modal';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  qrUrl: string;
  surveyLink: string;
  onOpenSurveySimulator: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  qrUrl,
  surveyLink,
  onOpenSurveySimulator,
}) => {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(surveyLink);
      toast.success('Đã sao chép đường dẫn khảo sát');
    } catch {
      toast.error('Không thể sao chép tự động', {
        description: 'Hãy chọn và sao chép đường dẫn trong ô bên cạnh.',
      });
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mã QR khảo sát và đánh giá">
      <div className="survey-operations-page qr-modal-content">
        <h4 className="qr-modal-heading">{title}</h4>
        <p className="qr-modal-subtitle">{subtitle}</p>

        <div className="qr-preview-box">
          <img src={qrUrl} alt="Mã QR Khảo sát Sinh viên" className="qr-image" />
          <div className="qr-caption">
            Quét mã QR bằng điện thoại để làm bài đánh giá
          </div>
        </div>

        <div className="form-group qr-link-field">
          <label htmlFor="qr-survey-link">Đường dẫn bài khảo sát</label>
          <div className="qr-link-row">
            <input id="qr-survey-link" type="text" readOnly value={surveyLink} />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void handleCopy()}
            >
              <Copy className="operation-icon" aria-hidden="true" />
              Sao chép
            </button>
          </div>
        </div>

        <div className="qr-modal-actions">
          <button
            className="btn btn-secondary"
            onClick={() => {
              onClose();
              onOpenSurveySimulator();
            }}
          >
            <Smartphone className="operation-icon" aria-hidden="true" />
            Mở giao diện sinh viên
          </button>
          <a
            href={qrUrl}
            download="VMU_QR_Survey.png"
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary qr-download-link"
          >
            <Download className="operation-icon" aria-hidden="true" />
            Tải ảnh QR
          </a>
        </div>
      </div>
    </Modal>
  );
};
