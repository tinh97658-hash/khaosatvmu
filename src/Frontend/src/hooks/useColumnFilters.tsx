import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { ColumnFilterMenu, type SortDirection } from '../components/ColumnFilterMenu';

/** Khai báo một cột lọc được của bảng dựng tay (không đi qua DataTable). */
export interface FilterableColumn<T> {
  key: string;
  /** Giá trị hiển thị trong menu lọc. Trả chuỗi rỗng thì dòng vẫn lọc được theo "". */
  value: (row: T) => string;
  /** Đặt true cho cột số để danh sách giá trị sắp theo trị số. */
  numeric?: boolean;
  /**
   * Khóa sắp xếp riêng, dùng cho cột mà giá trị hiển thị không sắp được — ví dụ
   * cột Z-Score có dấu cộng ở đầu và "—" khi thiếu dữ liệu.
   */
  sortValue?: (row: T) => number | string | null;
  /**
   * Cột mà MỘT DÒNG mang nhiều giá trị cùng lúc — ví dụ một tài khoản có cả vai
   * trò trưởng bộ môn lẫn giảng viên. Chọn "Trưởng bộ môn" thì mọi tài khoản có
   * vai trò đó đều hiện, không cần trùng khít cả bộ.
   *
   * Có trường này thì `value` chỉ còn dùng để hiển thị và sắp xếp.
   */
  values?: (row: T) => string[];
  /**
   * Danh sách giá trị CỐ ĐỊNH của menu lọc, giữ nguyên thứ tự khai báo. Bỏ trống
   * thì menu tự dựng từ dữ liệu đang có.
   */
  options?: string[];
}

/**
 * Bộ lọc kiểu Excel cho các bảng dựng tay: cùng một menu, cùng cách hành xử với
 * DataTable — giá trị của một cột chỉ liệt kê những gì còn thấy sau bộ lọc của
 * các cột khác, và sắp xếp nằm ngay trong menu nên tiêu đề không cần nút mũi tên.
 */
export function useColumnFilters<T>(rows: readonly T[], columns: FilterableColumn<T>[]) {
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(null);

  const columnByKey = useMemo(
    () => new Map(columns.map((column) => [column.key, column])),
    [columns]
  );

  /** Dòng có qua bộ lọc không, bỏ qua cột `except` để dựng danh sách cho chính cột đó. */
  const passes = (row: T, except?: string) =>
    columns.every((column) => {
      if (column.key === except) return true;
      const allowed = filters[column.key];
      if (!allowed) return true;
      if (!column.values) return allowed.includes(column.value(row));

      const owned = column.values(row);
      // Dòng không mang giá trị nào thì lọc theo nhãn hiển thị của chính nó, ví dụ
      // tài khoản chưa được cấp hồ sơ nào.
      return owned.length === 0
        ? allowed.includes(column.value(row))
        : owned.some((item) => allowed.includes(item));
    });

  const filtered = useMemo(
    () => rows.filter((row) => passes(row)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, columns, filters]
  );

  const visibleRows = useMemo(() => {
    if (!sort) return filtered;
    const column = columnByKey.get(sort.key);
    if (!column) return filtered;
    const direction = sort.direction === 'asc' ? 1 : -1;
    const valueOf = column.sortValue
      ? column.sortValue
      : (row: T) => (column.numeric ? Number(column.value(row)) : column.value(row));

    return [...filtered].sort((left, right) => {
      const leftValue = valueOf(left);
      const rightValue = valueOf(right);
      // Ô thiếu dữ liệu luôn xuống cuối, bất kể đang sắp tăng hay giảm.
      if (leftValue === null) return 1;
      if (rightValue === null) return -1;
      const result = typeof leftValue === 'number' && typeof rightValue === 'number'
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue), 'vi', {
          numeric: true,
          sensitivity: 'base',
        });
      return result * direction;
    });
  }, [columnByKey, filtered, sort]);

  const applyFilter = (key: string, selected: string[] | null) => {
    setFilters((previous) => {
      const next = { ...previous };
      if (selected === null) delete next[key];
      else next[key] = selected;
      return next;
    });
  };

  /** Đặt vào trong `<th>`: nhãn cột kèm nút lọc và dấu chỉ hướng đang sắp xếp. */
  const filterHeader = (key: string, label: string) => {
    const column = columnByKey.get(key);
    if (!column) return label;

    const values = column.options ?? [...new Set(
      rows
        .filter((row) => passes(row, key))
        .flatMap((row) => (column.values ? column.values(row) : [column.value(row)]))
    )].sort(
      (left, right) =>
        column.numeric ? Number(left) - Number(right) : left.localeCompare(right, 'vi')
    );

    return (
      <span className="catalog-th-filterable">
        <span className="catalog-th-label">
          {label}
          {sort?.key === key && (
            sort.direction === 'asc'
              ? <ArrowUp aria-hidden="true" />
              : <ArrowDown aria-hidden="true" />
          )}
        </span>
        <ColumnFilterMenu
          label={label}
          values={values}
          selected={filters[key] ?? null}
          sortDirection={sort?.key === key ? sort.direction : null}
          onSort={(direction) => setSort({ key, direction })}
          onApply={(selected) => applyFilter(key, selected)}
        />
      </span>
    );
  };

  return { visibleRows, filterHeader, isFiltered: Object.keys(filters).length > 0 };
}
