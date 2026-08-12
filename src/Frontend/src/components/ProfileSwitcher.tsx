import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, LoaderCircle } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import type { AuthProfile } from '../types';
import '../styles/profile-switcher.css';

interface ProfileSwitcherProps {
  activeProfile: AuthProfile;
  profiles: AuthProfile[];
  disabled: boolean;
  roleNames: Record<string, string>;
  onSelect: (profileId: string) => void;
}

export function ProfileSwitcher({
  activeProfile,
  profiles,
  disabled,
  roleNames,
  onSelect,
}: ProfileSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const selectedIndex = Math.max(0, profiles.findIndex((profile) => profile.id === activeProfile.id));
  const getRoleName = (roleCode: string) => roleNames[roleCode] ?? roleCode;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (disabled) setIsOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (isOpen) optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  const open = (index = selectedIndex) => {
    if (disabled || profiles.length === 0) return;
    setActiveIndex(index);
    setIsOpen(true);
  };

  const close = (restoreFocus = false) => {
    setIsOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const selectProfile = (profile: AuthProfile) => {
    close(true);
    if (profile.id !== activeProfile.id) onSelect(profile.id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || profiles.length === 0) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        open(selectedIndex);
        return;
      }

      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => (current + direction + profiles.length) % profiles.length);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isOpen) selectProfile(profiles[activeIndex]);
      else open();
      return;
    }

    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      close(true);
    }
  };

  return (
    <div className="profile-combobox" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        className="profile-combobox__trigger"
        aria-label="Hồ sơ làm việc"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={isOpen ? `${listboxId}-option-${activeIndex}` : undefined}
        aria-busy={disabled}
        disabled={disabled}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={handleKeyDown}
      >
        <span className="profile-combobox__value">
          <span className="profile-combobox__name" title={activeProfile.name}>{activeProfile.name}</span>
          <span className="profile-combobox__role">{getRoleName(activeProfile.roleCode)}</span>
        </span>
        {disabled ? (
          <LoaderCircle className="profile-combobox__spinner" aria-hidden="true" />
        ) : (
          <ChevronDown className="profile-combobox__chevron" aria-hidden="true" />
        )}
      </button>

      {isOpen && (
        <div id={listboxId} className="profile-combobox__menu" role="listbox" aria-label="Chọn hồ sơ làm việc">
          {profiles.map((profile, index) => {
            const isSelected = profile.id === activeProfile.id;
            const isActive = index === activeIndex;

            return (
              <button
                key={profile.id}
                ref={(element) => { optionRefs.current[index] = element; }}
                id={`${listboxId}-option-${index}`}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={isSelected}
                className={`profile-combobox__option${isActive ? ' is-active' : ''}${isSelected ? ' is-selected' : ''}`}
                onClick={() => selectProfile(profile)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className="profile-combobox__option-copy">
                  <span className="profile-combobox__option-name" title={profile.name}>{profile.name}</span>
                  <span className="profile-combobox__option-role">{getRoleName(profile.roleCode)}</span>
                </span>
                {isSelected && <Check aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
