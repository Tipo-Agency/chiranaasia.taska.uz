/**
 * Container - базовый контейнер для контента
 * 
 * Обеспечивает:
 * - Максимальную ширину
 * - Центрирование
 * - Адаптивные отступы
 * - Safe areas для мобильных
 */
import React from 'react';
import { SafeArea } from './SafeArea';

interface ContainerProps {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  padding?: boolean;
  className?: string;
  safeArea?: boolean;
}

const maxWidthClasses = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
  full: 'max-w-full',
};

export const Container: React.FC<ContainerProps> = ({
  children,
  maxWidth = 'xl',
  padding = true,
  className = '',
  safeArea = false,
}) => {
  const content = (
    <div
      className={`
        w-full mx-auto
        ${maxWidthClasses[maxWidth]}
        ${padding ? 'px-4 sm:px-6 lg:px-8' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );

  if (safeArea) {
    return <SafeArea left right>{content}</SafeArea>;
  }

  return content;
};
