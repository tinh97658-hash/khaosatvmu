import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Inbox, Plus, Search } from 'lucide-react';
import { ColumnFilterMenu, type SortDirection } from './ColumnFilterMenu';
import '../styles/catalogs.css';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  width?: string;
  /**
   * Giá trị dùng cho menu lọc và sắp xếp của cột. Cột nào không khai báo thì
   * không có nút lọc — dùng cho cột thao tác, hoặc cột mà mỗi dòng một giá trị
   * riêng nên lọc không gom nhóm được gì.
   */
  filterValue?: (item: T) => string;
  /** Đặt true cho cột số để sắp xếp theo trị số thay vì theo chuỗi. */
  numeric?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  filterOptions?: { label: string; value: string }[];
  currentFilter?: string;
  onFilterChange?: (val: string) => void;
  onAddNew?: () => void;
  addNewLabel?: string;
  toolbarActions?: ReactNode;
  emptyMessage?: string;
  keyExtractor: (item: T) => string;
  /** Số dòng mỗi trang. Bỏ trống thì hiển thị toàn bộ, không phân trang. */
  pageSize?: number;
}

export function DataTable<T>({
  columns,
  data,
  searchPlaceholder = 'Tìm kiếm danh mục...',
  searchValue = '',
  onSearchChange,
  filterOptions,
  currentFilter = '',
  onFilterChange,
  onAddNew,
  addNewLabel = 'Thêm mới',
  toolbarActions,
  emptyMessage = 'Chưa có dữ liệu trong danh mục này.',
  keyExtractor,
  pageSize,
}: DataTableProps<T>) {
  const resolvedAddLabel = addNewLabel.replace(/^\+\s*/, '');

  const [page, setPage] = useState(1);
  /** Không có khóa nghĩa là cột đó chưa lọc. */
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(null);

  const filterableColumns = useMemo(
    () => columns.filter((column) => column.filterValue),
    [columns]
  );

  /** Dòng có qua bộ lọc không, bỏ qua cột `except` để dựng danh sách cho chính cột đó. */
  const passesFilters = (item: T, except?: string) =>
    filterableColumns.every((column) => {
      if (column.key === except) return true;
      const allowed = columnFilters[column.key];
      return !allowed || allowed.includes(column.filterValue!(item));
    });

  const rows = useMemo(() => {
    const filtered = data.filter((item) => passesFilters(item));
    if (!sort) return filtered;
    const column = columns.find((item) => item.key === sort.key);
    if (!column?.filterValue) return filtered;

    return [...filtered].sort((left, right) => {
      const leftValue = column.filterValue!(left);
      const rightValue = column.filterValue!(right);
      const compared = column.numeric
        ? Number(leftValue) - Number(rightValue)
        : leftValue.localeCompare(rightValue, 'vi');
      return sort.direction === 'asc' ? compared : -compared;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, columns, columnFilters, sort]);

  const hasQuery = Boolean(
    searchValue.trim() || currentFilter || Object.keys(columnFilters).length > 0
  );
  const totalPages = pageSize ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;

  // Lọc hoặc xóa bớt dòng có thể làm trang hiện tại vượt quá số trang còn lại.
  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const firstIndex = pageSize ? (page - 1) * pageSize : 0;
  const visibleRows = pageSize ? rows.slice(firstIndex, firstIndex + pageSize) : rows;

  /** Giá trị cho menu của một cột, đã trừ các dòng bị cột khác lọc mất. */
  const valuesFor = (column: Column<T>) =>
    [...new Set(
      data.filter((item) => passesFilters(item, column.key)).map((item) => column.filterValue!(item))
    )].sort((left, right) =>
      column.numeric ? Number(left) - Number(right) : left.localeCompare(right, 'vi')
    );

  const applyColumnFilter = (key: string, selected: string[] | null) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (selected === null) delete next[key];
      else next[key] = selected;
      return next;
    });
    // Lọc xong mà vẫn đứng ở trang cuối thì bảng trông như rỗng.
    setPage(1);
  };

  return (
    <section className="catalog-table-shell" aria-label="Danh sách danh mục">
      <div className="catalog-toolbar">
        <div className="catalog-toolbar__search">
          {onSearchChange && (
            <label className="catalog-search">
              <span className="catalog-sr-only">Tìm kiếm</span>
              <Search aria-hidden="true" size={16} />
              <input
                type="search"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </label>
          )}
          <span className="catalog-result-count" aria-live="polite">
            {rows.length} kết quả
          </span>
        </div>

        <div className="catalog-toolbar__actions">
          {filterOptions && onFilterChange && (
            <label className="catalog-filter">
              <span className="catalog-sr-only">Lọc danh mục</span>
              <select
                value={currentFilter}
                onChange={(event) => onFilterChange(event.target.value)}
                aria-label="Lọc danh mục"
              >
                {filterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {onAddNew && (
            <button className="btn btn-primary btn-sm catalog-add-button" onClick={onAddNew}>
              <Plus aria-hidden="true" size={16} />
              <span>{resolvedAddLabel}</span>
            </button>
          )}

          {toolbarActions}
        </div>
      </div>

      <div className="catalog-table-scroll" tabIndex={0} aria-label="Bảng dữ liệu, có thể cuộn ngang">
        <table className="catalog-table">
          <thead>
            <tr>
              <th className="catalog-table__index" scope="col">STT</th>
              {columns.map((column) => (
                <th key={column.key} scope="col" style={{ width: column.width }}>
                  {column.filterValue ? (
                    <span className="catalog-th-filterable">
                      <span className="catalog-th-label">{column.header}</span>
                      <ColumnFilterMenu
                        label={column.header}
                        values={valuesFor(column)}
                        selected={columnFilters[column.key] ?? null}
                        sortDirection={sort?.key === column.key ? sort.direction : null}
                        onApply={(selected) => applyColumnFilter(column.key, selected)}
                        onSort={(direction) => setSort({ key: column.key, direction })}
                      />
                    </span>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td className="catalog-empty" colSpan={columns.length + 1}>
                  <Inbox aria-hidden="true" size={24} />
                  <strong>{hasQuery ? 'Không tìm thấy kết quả phù hợp' : emptyMessage}</strong>
                  {hasQuery && <span>Thử thay đổi từ khóa hoặc bộ lọc hiện tại.</span>}
                </td>
              </tr>
            ) : (
              visibleRows.map((item, index) => (
                <tr key={keyExtractor(item)}>
                  <td className="catalog-table__index">{firstIndex + index + 1}</td>
                  {columns.map((column) => (
                    <td key={column.key}>
                      {column.render
                        ? column.render(item)
                        : (item as Record<string, unknown>)[column.key] as ReactNode}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <footer className="catalog-pagination">
        <span>
          {pageSize && rows.length > 0 ? (
            <>
              Hiển thị <strong>{firstIndex + 1}</strong>–
              <strong>{Math.min(firstIndex + pageSize, rows.length)}</strong> trên{' '}
              <strong>{rows.length}</strong> kết quả
            </>
          ) : (
            <>
              Hiển thị <strong>{rows.length}</strong> kết quả
            </>
          )}
          {rows.length !== data.length && ` (lọc từ ${data.length})`}
        </span>
        <div className="catalog-pagination__controls" aria-label="Phân trang">
          <button
            type="button"
            className="catalog-page-button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            aria-label="Trang trước"
            title="Trang trước"
          >
            <ChevronLeft aria-hidden="true" size={16} />
          </button>
          <span className="catalog-page-number" aria-current="page">{page}</span>
          {pageSize && totalPages > 1 && (
            <span className="catalog-page-total">/ {totalPages}</span>
          )}
          <button
            type="button"
            className="catalog-page-button"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            aria-label="Trang sau"
            title="Trang sau"
          >
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </div>
      </footer>
    </section>
  );
}
