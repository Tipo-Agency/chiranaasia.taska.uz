/**
 * Select - компонент выпадающего списка
 */
import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  fullWidth?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  options,
  placeholder,
  fullWidth = true,
  className = '',
  ...props
}) => {
  const baseClasses = `
    appearance-none border border-gray-300 dark:border-gray-600 
    rounded-lg px-3 py-2 pr-10 text-sm 
    bg-white dark:bg-[#252525] 
    text-gray-900 dark:text-gray-100 
    focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
    outline-none transition-all
    ${error ? 'border-red-500 focus:ring-red-500' : ''}
    ${fullWidth ? 'w-full' : ''}
    ${className}
  `;

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          {...props}
          className={baseClasses}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
};
