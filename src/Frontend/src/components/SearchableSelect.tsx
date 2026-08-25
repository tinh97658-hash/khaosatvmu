import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  id?: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  /** Chữ mờ khi chưa chọn gì, ví dụ "Chọn học phần". */
  placeholder?: string;
  /** Mục rỗng đứng đầu danh sách, ví dụ "Chưa xác định". Bỏ trống thì không có. */
  emptyLabel?: string;
  disabled?: boolean;
  required?: boolean;
  'aria-label'?: string;
}

/**
 * Ô chọn cho phép gõ ngay tại chỗ để lọc danh sách. Vẫn PHẢI chọn một mục có
 * thật: chữ đang gõ chỉ là từ khóa lọc, rời ô mà chưa chọn thì ô trả về đúng
 * nhãn của giá trị cũ. Danh mục có hàng trăm học phần / giảng viên nên thả
 * xuống rồi cuộn tay là không dùng nổi.
 */
export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  id,
  value,
  options,
  onChange,
  placeholder = 'Chọn...',
  emptyLabel,
  disabled = false,
  required = false,
  'aria-label': ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [highlighted, setHighlighted] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const allOptions = useMemo(
    () => (emptyLabel ? [{ value: '', label: emptyLabel }, ...options] : options),
    [emptyLabel, options]
  );

  const selected = allOptions.find((option) => option.value === value) ?? null;

  const visibleOptions = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    if (!term) return allOptions;
    return allOptions.filter((option) => option.label.toLowerCase().includes(term));
  }, [allOptions, keyword]);

  const open = () => {
    if (disabled) return;
    setKeyword('');
    setHighlighted(Math.max(0, allOptions.findIndex((option) => option.value === value)));
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setKeyword('');
  };

  const pick = (option: SearchableSelectOption) => {
    onChange(option.value);
    close();
  };

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      close();
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  // Giữ mục đang trỏ luôn nằm trong tầm nhìn khi đi bằng phím mũi tên.
  useEffect(() => {
    if (!isOpen) return;
    listRef.current?.children[highlighted]?.scrollIntoView({ block: 'nearest' });
  }, [highlighted, isOpen]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        open();
        return;
      }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setHighlighted((current) => {
        const next = current + step;
        if (next < 0) return visibleOptions.length - 1;
        if (next >= visibleOptions.length) return 0;
        return next;
      });
      return;
    }
    if (event.key === 'Enter') {
      if (!isOpen) return;
      event.preventDefault();
      const option = visibleOptions[highlighted];
      if (option) pick(option);
      return;
    }
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      close();
    }
  };

  return (
    <div
      ref={rootRef}
      className={isOpen ? 'searchable-select is-open' : 'searchable-select'}
    >
      <input
        id={id}
        type="text"
        className="searchable-select__input"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={id ? `${id}-listbox` : undefined}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        disabled={disabled}
        required={required && !value}
        placeholder={selected ? selected.label : placeholder}
        value={isOpen ? keyword : (selected?.label ?? '')}
        onChange={(event) => {
          if (!isOpen) open();
          setKeyword(event.target.value);
          setHighlighted(0);
        }}
        onFocus={open}
        onClick={open}
        onKeyDown={handleKeyDown}
      />
      <ChevronDown className="searchable-select__caret" aria-hidden="true" />

      {isOpen && (
        <ul
          ref={listRef}
          id={id ? `${id}-listbox` : undefined}
          className="searchable-select__list"
          role="listbox"
        >
          {visibleOptions.length === 0 ? (
            <li className="searchable-select__empty">Không có lựa chọn nào khớp</li>
          ) : (
            visibleOptions.map((option, index) => (
              <li
                key={option.value || '__empty'}
                role="option"
                aria-selected={option.value === value}
                className={
                  index === highlighted
                    ? 'searchable-select__option is-highlighted'
                    : 'searchable-select__option'
                }
                onMouseEnter={() => setHighlighted(index)}
                onMouseDown={(event) => {
                  // mousedown chứ không phải click: click nổ sau blur, lúc đó
                  // danh sách đã đóng và cú bấm rơi vào khoảng không.
                  event.preventDefault();
                  pick(option);
                }}
              >
                <span>{option.label}</span>
                {option.value === value && <Check aria-hidden="true" />}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};
