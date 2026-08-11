import React from 'react';
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
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`MÃ QR KHẢO SÁT & ĐÁNH GIÁ - VMU`}>
      <div style={{ textAlign: 'center' }}>
        <h4 style={{ color: 'var(--vmu-navy)', fontSize: '17px', fontWeight: 700, marginBottom: '6px' }}>
          {title}
        </h4>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '18px' }}>
          {subtitle}
        </p>

        <div className="qr-preview-box">
          <img src={qrUrl} alt="Mã QR Khảo sát Sinh viên" className="qr-image" />
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--vmu-navy)' }}>
            Quét mã QR bằng điện thoại để làm bài đánh giá
          </div>
        </div>

        <div className="form-group" style={{ textAlign: 'left' }}>
          <label>Đường dẫn bài khảo sát (URL):</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="text" readOnly value={surveyLink} style={{ backgroundColor: '#F8FAFC' }} />
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                navigator.clipboard.writeText(surveyLink);
                alert('Đã sao chép đường dẫn bài khảo sát!');
              }}
            >
              Sao Chép
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
          <button
            className="btn btn-qr"
            onClick={() => {
              onClose();
              onOpenSurveySimulator();
            }}
          >
            <span>📱</span> Mở Giao Diện Sinh Viên (Thử nghiệm)
          </button>
          <a
            href={qrUrl}
            download="VMU_QR_Survey.png"
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
            style={{ textDecoration: 'none' }}
          >
            <span>⬇️</span> Tải Ảnh QR
          </a>
        </div>
      </div>
    </Modal>
  );
};
