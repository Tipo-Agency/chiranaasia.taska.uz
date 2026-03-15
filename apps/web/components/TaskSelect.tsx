import React from 'react';
import { ChevronDown } from 'lucide-react';

interface TaskSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
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
  disabled = false
}) => {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`
          w-full 
          px-3 
          pr-10 
          py-2.5 
          text-sm 
          bg-white 
          dark:bg-[#252525] 
          border 
          border-gray-300 
          dark:border-gray-600 
          rounded-lg 
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
        size={16} 
        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500" 
      />
    </div>
  );
};

