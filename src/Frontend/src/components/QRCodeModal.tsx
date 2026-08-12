import React, { useState } from 'react';
import { CheckCircle2, CircleAlert, Copy, Download, Smartphone } from 'lucide-react';
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
  const [copyStatus, setCopyStatus] = useState<'success' | 'error' | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(surveyLink);
      setCopyStatus('success');
    } catch {
      setCopyStatus('error');
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
          {copyStatus && (
            <div
              className={`operations-feedback operations-feedback--${copyStatus}`}
              role={copyStatus === 'error' ? 'alert' : 'status'}
            >
              {copyStatus === 'success'
                ? <CheckCircle2 aria-hidden="true" />
                : <CircleAlert aria-hidden="true" />}
              <span>
                {copyStatus === 'success'
                  ? 'Đã sao chép đường dẫn khảo sát.'
                  : 'Không thể sao chép tự động. Hãy chọn và sao chép đường dẫn.'}
              </span>
            </div>
          )}
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
