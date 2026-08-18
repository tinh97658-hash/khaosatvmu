import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ChartPaginationProps {
  page: number;
  pageCount: number;
  pageSize: number;
  totalItems: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
}

/** Phân trang gọn bên trong thẻ biểu đồ để số đơn vị lớn không kéo dài toàn trang. */
export const ChartPagination: React.FC<ChartPaginationProps> = ({
  page,
  pageCount,
  pageSize,
  totalItems,
  itemLabel,
  onPageChange,
}) => {
  if (pageCount <= 1) return null;

  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, totalItems);

  return (
    <div className="reports-pagination reports-chart-pagination" aria-label={`Phân trang biểu đồ ${itemLabel}`}>
      <span>{firstItem}–{lastItem} / {totalItems} {itemLabel}</span>
      <div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          aria-label="Trang biểu đồ trước"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <strong>Trang {page} / {pageCount}</strong>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          disabled={page === pageCount}
          aria-label="Trang biểu đồ sau"
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
