import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className = '',
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startItem = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, total);

  const goPrev = () => safePage > 1 && onPageChange(safePage - 1);
  const goNext = () => safePage < totalPages && onPageChange(safePage + 1);

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 bg-white border-t border-gray-200 ${className}`}>
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>表示数</span>
        <div className="relative">
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 rotate-90 pointer-events-none" />
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span className="whitespace-nowrap">
          {total}件中 <span className="font-medium text-gray-900">{startItem}〜{endItem}</span>件を表示
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goPrev}
            disabled={safePage <= 1}
            className="p-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
            aria-label="前のページ"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 text-sm text-gray-700 tabular-nums">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={safePage >= totalPages}
            className="p-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
            aria-label="次のページ"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function usePagination(defaultPageSize = 25) {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(defaultPageSize);

  const handlePageSizeChange = React.useCallback((size) => {
    setPageSize(size);
    setPage(1);
  }, []);

  const reset = React.useCallback(() => setPage(1), []);

  const paginate = React.useCallback((items) => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [page, pageSize]);

  return { page, pageSize, setPage, setPageSize: handlePageSizeChange, paginate, reset };
}
