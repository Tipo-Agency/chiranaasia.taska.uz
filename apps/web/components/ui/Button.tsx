import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  disabled = false,
  type = 'button',
  className = '',
  fullWidth = false
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary:
      'bg-[var(--brand-primary)] text-white shadow-sm hover:brightness-[0.96] active:brightness-[0.9] focus:ring-[color:var(--brand-primary)]',
    secondary: 'bg-gray-100 dark:bg-[#252525] hover:bg-gray-200 dark:hover:bg-[#303030] text-gray-900 dark:text-white focus:ring-gray-500',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
    ghost: 'hover:bg-gray-100 dark:hover:bg-[#252525] text-gray-700 dark:text-gray-300 focus:ring-gray-500',
    outline: 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-[#252525] text-gray-700 dark:text-gray-300 focus:ring-gray-500'
  };
  
      const sizeClasses = {
        sm: 'px-3 py-2 text-sm gap-1.5 min-h-[44px]', // min-h-[44px] для touch-friendly
        md: 'px-4 py-2.5 text-sm gap-2 min-h-[44px]', // min-h-[44px] для touch-friendly
        lg: 'px-6 py-3 text-base gap-2 min-h-[48px]' // min-h-[48px] для больших кнопок
      };
  
  const iconSize = {
    sm: 14,
    md: 16,
    lg: 18
  };
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {Icon && iconPosition === 'left' && <Icon size={iconSize[size]} />}
      {children}
      {Icon && iconPosition === 'right' && <Icon size={iconSize[size]} />}
    </button>
  );
};

