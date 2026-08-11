import React from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  width?: string;
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
  emptyMessage?: string;
  keyExtractor: (item: T) => string;
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
  addNewLabel = '+ Thêm Mới',
  emptyMessage = 'Chưa có dữ liệu trong danh mục này.',
  keyExtractor,
}: DataTableProps<T>) {
  return (
    <div className="card">
      <div className="table-toolbar">
        {onSearchChange ? (
          <div className="search-box">
            <span>🔍</span>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        ) : (
          <div />
        )}

        <div className="filter-group">
          {filterOptions && onFilterChange && (
            <select
              className="filter-select"
              value={currentFilter}
              onChange={(e) => onFilterChange(e.target.value)}
            >
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {onAddNew && (
            <button className="btn btn-primary btn-sm" onClick={onAddNew}>
              {addNewLabel}
            </button>
          )}
        </div>
      </div>

      <div className="table-container">
        <table className="vmu-table">
          <thead>
            <tr>
              <th style={{ width: '48px', textAlign: 'center' }}>STT</th>
              {columns.map((col) => (
                <th key={col.key} style={{ width: col.width }}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr key={keyExtractor(item)}>
                  <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    {index + 1}
                  </td>
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.render
                        ? col.render(item)
                        : (item as Record<string, any>)[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <div>
          Hiển thị <strong>{data.length}</strong> kết quả trong danh mục
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="btn btn-secondary btn-sm" disabled>
            &laquo; Trở lại
          </button>
          <button className="btn btn-secondary btn-sm" disabled>
            Tiếp &raquo;
          </button>
        </div>
      </div>
    </div>
  );
}
