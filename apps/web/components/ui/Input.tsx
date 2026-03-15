import React from 'react';
import { LucideIcon } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon: Icon,
  iconPosition = 'left',
  fullWidth = true,
  className = '',
  ...props
}) => {
  const baseClasses = 'border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder-gray-400 dark:placeholder-gray-500';
  
  const iconPadding = Icon ? (iconPosition === 'left' ? 'pl-9' : 'pr-9') : '';
  
  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && iconPosition === 'left' && (
          <Icon 
            size={16} 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" 
          />
        )}
        <input
          {...props}
          className={`
            ${baseClasses}
            ${iconPadding}
            ${error ? 'border-red-500 focus:ring-red-500' : ''}
            ${className}
          `}
        />
        {Icon && iconPosition === 'right' && (
          <Icon 
            size={16} 
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" 
          />
        )}
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
};

