import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onSubmit?: () => void;
  submitText?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  onSubmit,
  submitText = 'Lưu Thay Đổi',
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">{children}</div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Hủy Bỏ
          </button>
          {onSubmit && (
            <button className="btn btn-primary" onClick={onSubmit}>
              {submitText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
