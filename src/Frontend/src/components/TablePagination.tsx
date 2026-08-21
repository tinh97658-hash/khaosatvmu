import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import '../styles/catalogs.css';

interface TablePaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
}

/** Thanh phân trang dùng chung cho các bảng chuẩn và các bảng báo cáo viết tay. */
export const TablePagination: React.FC<TablePaginationProps> = ({
  page,
  pageSize,
  totalItems,
  itemLabel = 'kết quả',
  onPageChange,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const firstItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, totalItems);

  return (
    <footer className="catalog-pagination">
      <span>
        Hiển thị <strong>{firstItem}</strong>–<strong>{lastItem}</strong> trên{' '}
        <strong>{totalItems}</strong> {itemLabel}
      </span>
      <div className="catalog-pagination__controls" aria-label="Phân trang">
        <button
          type="button"
          className="catalog-page-button"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          aria-label="Trang trước"
          title="Trang trước"
        >
          <ChevronLeft aria-hidden="true" size={16} />
        </button>
        <span className="catalog-page-number" aria-current="page">{page}</span>
        {totalPages > 1 && <span className="catalog-page-total">/ {totalPages}</span>}
        <button
          type="button"
          className="catalog-page-button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          aria-label="Trang sau"
          title="Trang sau"
        >
          <ChevronRight aria-hidden="true" size={16} />
        </button>
      </div>
    </footer>
  );
};
