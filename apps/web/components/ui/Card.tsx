import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  hover = false,
  onClick,
  padding = 'md'
}) => {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4 md:p-6',
    lg: 'p-6 md:p-8'
  };
  
  const baseClasses = 'bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl';
  const hoverClasses = hover ? 'hover:shadow-md transition-shadow cursor-pointer' : '';
  const clickableClasses = onClick ? 'cursor-pointer' : '';
  
  return (
    <div
      onClick={onClick}
      className={`
        ${baseClasses}
        ${paddingClasses[padding]}
        ${hoverClasses}
        ${clickableClasses}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

