import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import type { AuthProfile, AuthUser } from '../types';

interface UserAccountMenuProps {
  user: AuthUser;
  activeProfile: AuthProfile;
  roleName: string;
  busy: boolean;
  onChangeProfile: () => void;
  onLogout: () => void;
}

export function UserAccountMenu({
  user,
  activeProfile,
  roleName,
  busy,
  onChangeProfile,
  onLogout,
}: UserAccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const initials = (user.displayName ?? user.email)
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (busy) setIsOpen(false);
  }, [busy]);

  const runAction = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <div className="user-account" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="user-account__trigger"
        aria-label="Mở menu tài khoản"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        disabled={busy}
        onClick={() => {
          setIsOpen((open) => !open);
          if (!isOpen) window.requestAnimationFrame(() => firstActionRef.current?.focus());
        }}
      >
        {user.avatarUrl ? (
          <img className="user-account__avatar" src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="user-account__avatar initials" aria-hidden="true">{initials}</span>
        )}
        <span className="user-account__identity">
          <strong>{user.displayName ?? user.email}</strong>
          <span>{roleName}</span>
        </span>
        <ChevronDown className="user-account__chevron" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="user-account__menu" role="menu" aria-label="Tùy chọn tài khoản">
          <div className="user-account__summary">
            <span className="user-account__summary-icon" aria-hidden="true"><ShieldCheck /></span>
            <span>
              <small>PHIÊN ĐANG SỬ DỤNG</small>
              <strong>{activeProfile.name}</strong>
              <span>{user.email}</span>
            </span>
          </div>
          <div className="user-account__actions">
            <button
              ref={firstActionRef}
              type="button"
              role="menuitem"
              onClick={() => runAction(onChangeProfile)}
            >
              <RefreshCw aria-hidden="true" />
              <span>
                <strong>Thay đổi phiên làm việc</strong>
                <small>Chọn profile và phạm vi quyền khác</small>
              </span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="is-danger"
              onClick={() => runAction(onLogout)}
            >
              <LogOut aria-hidden="true" />
              <span>
                <strong>Đăng xuất</strong>
                <small>Kết thúc phiên truy cập hiện tại</small>
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
