import { useEffect, useMemo, useState } from 'react';

export function usePaginatedItems<T>(items: readonly T[], pageSize = 20) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const visibleItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  );

  useEffect(() => {
    setPage(1);
  }, [items]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  return { page, setPage, visibleItems };
}
