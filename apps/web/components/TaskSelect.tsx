import React from 'react';
import { ChevronDown } from 'lucide-react';

interface TaskSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Компактная высота — для плотных форм (модалка задачи и т.п.) */
  size?: 'default' | 'compact';
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
}) => {
  const sizeClass =
    size === 'compact'
      ? 'px-2.5 pr-8 py-1.5 min-h-[32px] text-sm leading-tight rounded-md'
      : 'px-3 pr-10 py-2.5 text-sm rounded-lg';
  const chevronRight = size === 'compact' ? 'right-2' : 'right-3';
  const chevronSize = size === 'compact' ? 14 : 16;

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`
          w-full 
          ${sizeClass}
          bg-white 
          dark:bg-[#252525] 
          border 
          border-gray-300 
          dark:border-gray-600 
          text-gray-900 
          dark:text-gray-100 
          appearance-none 
          focus:ring-2 
          focus:ring-blue-500/50 
          focus:border-blue-500 
          outline-none 
          transition-all
          disabled:opacity-50 
          disabled:cursor-not-allowed
          ${className}
        `.trim()}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown 
        size={chevronSize} 
        className={`absolute ${chevronRight} top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500`} 
      />
    </div>
  );
};

