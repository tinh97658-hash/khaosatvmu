import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Inbox, Plus, Search } from 'lucide-react';
import '../styles/catalogs.css';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  sortValue?: (item: T) => string | number | null | undefined;
  width?: string;
}

export type DataTableSortDirection = 'asc' | 'desc';

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
  sortKey?: string;
  sortDirection?: DataTableSortDirection;
  onSortChange?: (key?: string, direction?: DataTableSortDirection) => void;
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
  sortKey,
  sortDirection = 'asc',
  onSortChange,
}: DataTableProps<T>) {
  const hasQuery = Boolean(searchValue.trim() || currentFilter);
  const resolvedAddLabel = addNewLabel.replace(/^\+\s*/, '');

  const [page, setPage] = useState(1);
  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    const column = columns.find((item) => item.key === sortKey && item.sortValue);
    if (!column?.sortValue) return data;
    const direction = sortDirection === 'asc' ? 1 : -1;
    return [...data].sort((leftItem, rightItem) => {
      const left = column.sortValue?.(leftItem);
      const right = column.sortValue?.(rightItem);
      if (left === right) return 0;
      if (left === null || left === undefined) return 1;
      if (right === null || right === undefined) return -1;
      const result = typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right), 'vi', { numeric: true, sensitivity: 'base' });
      return result * direction;
    });
  }, [columns, data, sortDirection, sortKey]);

  const totalPages = pageSize ? Math.max(1, Math.ceil(sortedData.length / pageSize)) : 1;

  // Lọc hoặc xóa bớt dòng có thể làm trang hiện tại vượt quá số trang còn lại.
  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setPage(1);
  }, [sortDirection, sortKey]);

  const firstIndex = pageSize ? (page - 1) * pageSize : 0;
  const visibleRows = pageSize ? sortedData.slice(firstIndex, firstIndex + pageSize) : sortedData;

  const changeSort = (column: Column<T>) => {
    if (!column.sortValue || !onSortChange) return;
    if (sortKey !== column.key) {
      onSortChange(column.key, 'asc');
    } else if (sortDirection === 'asc') {
      onSortChange(column.key, 'desc');
    } else {
      onSortChange(undefined, undefined);
    }
  };

  const nextSortAction = (column: Column<T>): string => {
    if (sortKey !== column.key) return 'tăng dần';
    return sortDirection === 'asc' ? 'giảm dần' : 'bỏ sắp xếp';
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
            {data.length} kết quả
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
                  {column.sortValue && onSortChange ? (
                    <button
                      type="button"
                      className="catalog-sort-button"
                      onClick={() => changeSort(column)}
                      aria-label={`Sắp xếp ${column.header}: ${nextSortAction(column)}`}
                    >
                      {column.header}
                      {sortKey !== column.key
                        ? <ArrowUpDown aria-hidden="true" />
                        : sortDirection === 'asc'
                          ? <ArrowUp aria-hidden="true" />
                          : <ArrowDown aria-hidden="true" />}
                    </button>
                  ) : column.header}
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
          {pageSize && data.length > 0 ? (
            <>
              Hiển thị <strong>{firstIndex + 1}</strong>–
              <strong>{Math.min(firstIndex + pageSize, data.length)}</strong> trên{' '}
              <strong>{data.length}</strong> kết quả
            </>
          ) : (
            <>
              Hiển thị <strong>{data.length}</strong> kết quả
            </>
          )}
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
