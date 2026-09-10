import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
// Kiểu dáng của chính ô chọn nằm trong tệp này. Thành phần tự import lấy, chứ để
// từng trang tự nhớ thì trang nào quên là ô chọn bung ra không còn hình hài gì —
// nhất là các trang được nạp lười, tệp CSS chỉ về khi trang đó được mở.
import '../styles/catalogs.css';

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
  /**
   * Lớp CSS gắn thêm vào danh sách xổ xuống. Danh sách được đưa ra document.body
   * nên lớp của ô chọn không với tới nó, muốn sửa riêng cho một chỗ thì phải
   * truyền vào đây.
   */
  listClassName?: string;
  /**
   * Hiện một dải nhỏ ở đáy danh sách ghi trọn nhãn của dòng đang rê chuột. Dùng
   * cho danh sách có nhãn dài bị cắt bằng ba chấm.
   *
   * Ô này nổi RIÊNG bên ngoài danh sách chứ không chèn vào trong: chèn vào trong
   * thì danh sách cao thêm mỗi lần rê chuột, mà kích thước phải giữ nguyên.
   */
  showHoveredLabel?: boolean;
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
  listClassName,
  showHoveredLabel = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const [listStyle, setListStyle] = useState<React.CSSProperties>({});

  // Nhãn đầy đủ của dòng đang rê chuột, kèm toạ độ ô nổi hiện nó.
  const [hovered, setHovered] = useState<{ label: string; style: React.CSSProperties } | null>(null);

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
    setHovered(null);
  };

  /**
   * Ô nổi ghi trọn nhãn, đặt ngay dưới đáy DANH SÁCH chứ không dưới từng dòng:
   * nằm ngoài vùng cuộn của danh sách nên không bị cắt, và không làm danh sách
   * cao thêm một pixel nào.
   */
  const showLabelOf = (label: string) => {
    if (!showHoveredLabel) return;
    const rect = listRef.current?.getBoundingClientRect();
    if (!rect) return;

    setHovered({
      label,
      style: { top: rect.bottom + 4, left: rect.left, width: rect.width },
    });
  };

  const pick = (option: SearchableSelectOption) => {
    onChange(option.value);
    close();
  };

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  // Danh sách được đưa ra document.body để không bị vùng cuộn của modal/bảng cắt mất.
  // Tọa độ vẫn bám theo ô nhập và tự mở lên trên nếu phía dưới không đủ chỗ.
  useLayoutEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;

      const viewportPadding = 8;
      const gap = 3;
      const preferredHeight = 264;
      const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
      const spaceAbove = rect.top - gap - viewportPadding;
      const openAbove = spaceBelow < Math.min(160, preferredHeight) && spaceAbove > spaceBelow;
      const availableHeight = openAbove ? spaceAbove : spaceBelow;
      const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2);
      const left = Math.max(
        viewportPadding,
        Math.min(rect.left, window.innerWidth - width - viewportPadding)
      );

      setListStyle({
        top: openAbove ? rect.top - gap : rect.bottom + gap,
        left,
        width,
        maxHeight: Math.max(72, Math.min(preferredHeight, availableHeight)),
        transform: openAbove ? 'translateY(-100%)' : undefined,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
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

      {isOpen && createPortal(
        <ul
          ref={listRef}
          id={id ? `${id}-listbox` : undefined}
          className={[
            'searchable-select__list',
            'searchable-select__list--portal',
            listClassName ?? '',
          ].filter(Boolean).join(' ')}
          role="listbox"
          style={listStyle}
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
                onMouseEnter={() => {
                  setHighlighted(index);
                  showLabelOf(option.label);
                }}
                onMouseLeave={() => setHovered(null)}
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
        </ul>,
        document.body
      )}

      {isOpen && hovered && createPortal(
        <div className="searchable-select__hovered-label" role="tooltip" style={hovered.style}>
          {hovered.label}
        </div>,
        document.body
      )}
    </div>
  );
};
