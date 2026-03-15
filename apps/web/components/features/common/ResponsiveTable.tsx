/**
 * ResponsiveTable - адаптивная таблица
 * 
 * Зачем отдельно:
 * - На десктопе показывает таблицу
 * - На мобильных показывает карточки
 * - Единый интерфейс для всех таблиц
 */
import React from 'react';
import { Card } from '../../ui/Card';

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  mobileLabel?: string;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
}

export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = 'Нет данных',
  className = '',
}: ResponsiveTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 dark:text-gray-400 ${className}`}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className={`hidden md:block overflow-x-auto ${className}`}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-[#333]">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase ${column.className || ''}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                className={`
                  border-b border-gray-100 dark:border-[#333]
                  ${onRowClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors' : ''}
                `}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-4 py-3 text-sm text-gray-900 dark:text-white ${column.className || ''}`}
                  >
                    {column.render ? column.render(item) : (item as any)[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className={`md:hidden space-y-2 ${className}`}>
        {data.map((item) => (
          <Card
            key={keyExtractor(item)}
            onClick={onRowClick ? () => onRowClick(item) : undefined}
            className={onRowClick ? 'cursor-pointer' : ''}
          >
            <div className="p-4 space-y-2">
              {columns.map((column) => (
                <div key={column.key} className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    {column.mobileLabel || column.label}
                  </span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {column.render ? column.render(item) : (item as any)[column.key]}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
