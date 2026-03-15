/**
 * PageLayout - базовый layout для страниц
 * 
 * Обеспечивает:
 * - Safe areas для мобильных
 * - Адаптивную структуру
 * - Правильные отступы
 */
import React from 'react';
import { SafeAreaAll } from './SafeArea';

interface PageLayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export const PageLayout: React.FC<PageLayoutProps> = ({
  children,
  header,
  footer,
  className = '',
  contentClassName = '',
}) => {
  return (
    <SafeAreaAll className={`flex flex-col h-screen w-full ${className}`}>
      {header && (
        <header className="shrink-0">
          {header}
        </header>
      )}
      
      <main className={`flex-1 overflow-auto ${contentClassName}`}>
        {children}
      </main>
      
      {footer && (
        <footer className="shrink-0">
          {footer}
        </footer>
      )}
    </SafeAreaAll>
  );
};
