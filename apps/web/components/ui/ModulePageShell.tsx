import React from 'react';

/**
 * Обёртка страницы модуля: фон и колонка как в «Встречи».
 */
export const ModulePageShell: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div
    className={`h-full flex flex-col min-h-0 bg-gray-50/50 dark:bg-[#191919] ${className}`}
  >
    {children}
  </div>
);
