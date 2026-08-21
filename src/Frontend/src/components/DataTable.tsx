import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Inbox, Plus, Search } from 'lucide-react';
import { ColumnFilterMenu } from './ColumnFilterMenu';
import { TablePagination } from './TablePagination';
import '../styles/catalogs.css';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  sortValue?: (item: T) => string | number | null | undefined;
  /**
   * Giá trị dùng cho menu lọc kiểu Excel. Cột nào không khai báo thì không có
   * nút lọc — dùng cho cột thao tác, hoặc cột mà mỗi dòng một giá trị riêng
   * nên lọc không gom nhóm được gì.
   */
  filterValue?: (item: T) => string;
  /** Đặt true cho cột số để sắp xếp danh sách giá trị theo trị số. */
  numeric?: boolean;
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
  /** Số dòng mỗi trang. Mặc định 20 để các trang mới không vô tình hiển thị toàn bộ dữ liệu. */
  pageSize?: number;
  sortKey?: string;
  sortDirection?: DataTableSortDirection;
  onSortChange?: (key?: string, direction?: DataTableSortDirection) => void;
  /** Giá trị nhỏ hơn luôn được ghim lên trước, kể cả khi người dùng sắp xếp cột. */
  rowPriority?: (item: T) => number;
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
  pageSize = 20,
  sortKey,
  sortDirection = 'asc',
  onSortChange,
  rowPriority,
}: DataTableProps<T>) {
  const resolvedAddLabel = addNewLabel.replace(/^\+\s*/, '');

  const [page, setPage] = useState(1);
  /** Không có khóa nghĩa là cột đó chưa lọc. */
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  /**
   * Sắp xếp nội bộ, dùng khi trang không truyền onSortChange. Các trang danh mục
   * đều không truyền, nếu chỉ dựa vào prop thì nút sắp xếp trong menu lọc sẽ chết.
   */
  const [innerSort, setInnerSort] = useState<{
    key: string;
    direction: DataTableSortDirection;
  } | null>(null);

  const isControlledSort = Boolean(onSortChange);
  const activeSortKey = isControlledSort ? sortKey : innerSort?.key;
  const activeSortDirection = isControlledSort ? sortDirection : (innerSort?.direction ?? 'asc');

  const changeSortTo = (key: string | undefined, direction?: DataTableSortDirection) => {
    if (isControlledSort) {
      onSortChange?.(key, direction);
      return;
    }
    setInnerSort(key ? { key, direction: direction ?? 'asc' } : null);
  };

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

  const filteredData = useMemo(
    () => data.filter((item) => passesFilters(item)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, filterableColumns, columnFilters]
  );

  const hasQuery = Boolean(
    searchValue.trim() || currentFilter || Object.keys(columnFilters).length > 0
  );

  const sortedData = useMemo(() => {
    const priorityOf = rowPriority ?? (() => 0);
    if (!activeSortKey) {
      return rowPriority
        ? [...filteredData].sort((left, right) => priorityOf(left) - priorityOf(right))
        : filteredData;
    }
    const column = columns.find(
      (item) => item.key === activeSortKey && (item.sortValue || item.filterValue)
    );
    if (!column) return filteredData;
    // Cột chỉ khai báo filterValue vẫn sắp xếp được: dùng luôn giá trị đó, đổi
    // sang số khi cột đánh dấu numeric.
    const valueOf = column.sortValue
      ? column.sortValue
      : (item: T) => (column.numeric ? Number(column.filterValue!(item)) : column.filterValue!(item));
    const direction = activeSortDirection === 'asc' ? 1 : -1;
    return [...filteredData].sort((leftItem, rightItem) => {
      const priorityResult = priorityOf(leftItem) - priorityOf(rightItem);
      if (priorityResult !== 0) return priorityResult;
      const left = valueOf(leftItem);
      const right = valueOf(rightItem);
      if (left === right) return 0;
      if (left === null || left === undefined) return 1;
      if (right === null || right === undefined) return -1;
      const result = typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right), 'vi', { numeric: true, sensitivity: 'base' });
      return result * direction;
    });
  }, [columns, filteredData, activeSortDirection, activeSortKey, rowPriority]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));

  // Lọc hoặc xóa bớt dòng có thể làm trang hiện tại vượt quá số trang còn lại.
  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setPage(1);
  }, [activeSortDirection, activeSortKey]);

  useEffect(() => {
    setPage(1);
  }, [currentFilter, searchValue]);

  const firstIndex = (page - 1) * pageSize;
  const visibleRows = sortedData.slice(firstIndex, firstIndex + pageSize);

  const changeSort = (column: Column<T>) => {
    if (!column.sortValue) return;
    if (activeSortKey !== column.key) {
      changeSortTo(column.key, 'asc');
    } else if (activeSortDirection === 'asc') {
      changeSortTo(column.key, 'desc');
    } else {
      changeSortTo(undefined, undefined);
    }
  };

  const nextSortAction = (column: Column<T>): string => {
    if (activeSortKey !== column.key) return 'tăng dần';
    return activeSortDirection === 'asc' ? 'giảm dần' : 'bỏ sắp xếp';
  };

  /** Giá trị cho menu của một cột, đã trừ các dòng bị cột khác lọc mất. */
  const valuesFor = (column: Column<T>) =>
    [...new Set(
      data.filter((item) => passesFilters(item, column.key)).map((item) => column.filterValue!(item))
    )].sort((left, right) =>
      column.numeric ? Number(left) - Number(right) : left.localeCompare(right, 'vi')
    );

  const applyColumnFilter = (key: string, selected: string[] | null) => {
    setPage(1);
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (selected === null) delete next[key];
      else next[key] = selected;
      return next;
    });
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
            {sortedData.length} kết quả
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
                  <span className={column.filterValue ? 'catalog-th-filterable' : undefined}>
                    {column.sortValue ? (
                      <button
                        type="button"
                        className="catalog-sort-button catalog-th-label"
                        onClick={() => changeSort(column)}
                        aria-label={`Sắp xếp ${column.header}: ${nextSortAction(column)}`}
                      >
                        {column.header}
                        {activeSortKey !== column.key
                          ? <ArrowUpDown aria-hidden="true" />
                          : activeSortDirection === 'asc'
                            ? <ArrowUp aria-hidden="true" />
                            : <ArrowDown aria-hidden="true" />}
                      </button>
                    ) : (
                      <span className="catalog-th-label">{column.header}</span>
                    )}
                    {column.filterValue && (
                      <ColumnFilterMenu
                        label={column.header}
                        values={valuesFor(column)}
                        selected={columnFilters[column.key] ?? null}
                        // Sắp xếp vẫn đi qua một đường duy nhất của bảng, dù là
                        // sắp xếp nội bộ hay do trang điều khiển.
                        sortDirection={activeSortKey === column.key ? activeSortDirection : null}
                        onSort={(direction) => changeSortTo(column.key, direction)}
                        onApply={(selected) => applyColumnFilter(column.key, selected)}
                      />
                    )}
                  </span>
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

      <TablePagination
        page={page}
        pageSize={pageSize}
        totalItems={sortedData.length}
        onPageChange={setPage}
      />
    </section>
  );
}
