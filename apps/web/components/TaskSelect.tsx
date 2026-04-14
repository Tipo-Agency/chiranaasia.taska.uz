import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export type TaskSelectOption = { value: string; label: string; /** Для searchable: доп. поля (компания, телефон и т.д.) */ searchText?: string };

interface TaskSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: TaskSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Компактная высота — для плотных форм (модалка задачи и т.п.) */
  size?: 'default' | 'compact';
  /** Поле поиска в выпадающем списке (фильтр по label и searchText) */
  searchable?: boolean;
  /** Подпись поля поиска */
  searchPlaceholder?: string;
}

/**
 * Универсальный компонент select в стиле TaskModal
 * Стрелка ChevronDown справа, вертикально по центру
 */
export const TaskSelect: React.FC<TaskSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Выберите...',
  className = '',
  disabled = false,
  size = 'default',
  searchable = false,
  searchPlaceholder = 'Поиск…',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const sizeClass =
    size === 'compact'
      ? 'h-8 min-h-8 px-2.5 text-sm leading-tight rounded-md'
      : 'min-h-[42px] px-3 py-2.5 text-sm rounded-lg';
  const chevronSize = size === 'compact' ? 14 : 16;
  const selectedOption = useMemo(() => options.find((opt) => opt.value === value), [options, value]);
  const displayLabel = selectedOption?.label || placeholder;

  const filteredOptions = useMemo(() => {
    if (!searchable) return options;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      if (o.value === '') return true;
      const hay = (o.searchText ?? o.label).toLowerCase();
      return hay.includes(q);
    });
  }, [options, searchQuery, searchable]);

  useEffect(() => {
    if (isOpen && searchable) {
      setSearchQuery('');
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [isOpen, searchable]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  const handlePick = (nextValue: string) => {
    onChange(nextValue);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`
          w-full
          text-left
          inline-flex items-center justify-between gap-2
          ${sizeClass}
          bg-white
          dark:bg-[#252525]
          border
          border-gray-300
          dark:border-gray-600
          text-gray-900
          dark:text-gray-100
          focus:ring-2
          focus:ring-blue-500/50
          focus:border-blue-500
          outline-none
          transition-all
          disabled:opacity-50
          disabled:cursor-not-allowed
          ${!selectedOption ? 'text-gray-400 dark:text-gray-500' : ''}
          ${className}
        `.trim()}
      >
        <span className="truncate flex-1 min-w-0">{displayLabel}</span>
        <ChevronDown
          size={chevronSize}
          className={`shrink-0 text-gray-400 dark:text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {isOpen && !disabled && (
        <div className="absolute z-[220] top-full left-0 mt-1 w-full min-w-[12rem] rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] shadow-xl overflow-hidden flex flex-col">
          {searchable && (
            <div className="shrink-0 p-2 border-b border-gray-100 dark:border-[#333]">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none"
                  aria-hidden
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setIsOpen(false);
                    }
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-2 py-1.5 text-sm rounded-md border border-gray-200 dark:border-[#444] bg-gray-50 dark:bg-[#1e1e1e] text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:ring-2 focus:ring-[#3337AD]/30 focus:border-[#3337AD] outline-none"
                  aria-label={searchPlaceholder}
                />
              </div>
            </div>
          )}
          <div className="max-h-64 overflow-y-auto custom-scrollbar p-1">
            {filteredOptions.length === 0 ? (
              <div className="px-2.5 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">Ничего не найдено</div>
            ) : (
              filteredOptions.map((option) => {
                const active = option.value === value;
                return (
                  <button
                    key={option.value === '' ? '__empty__' : option.value}
                    type="button"
                    onClick={() => handlePick(option.value)}
                    className={`w-full text-left px-2.5 py-2 rounded-md text-sm transition-colors ${
                      active
                        ? 'bg-[#3337AD]/10 text-[#3337AD] dark:text-[#a8abf0]'
                        : 'text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#303030]'
                    }`}
                  >
                    <span className="truncate block">{option.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

