/**
 * Touchable - обертка для touch-friendly элементов
 * 
 * Зачем отдельно:
 * - Обеспечивает минимальный размер 44x44px для мобильных
 * - Добавляет визуальную обратную связь
 * - Переиспользуется везде где нужны кликабельные элементы
 */
import React from 'react';

interface TouchableProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  as?: 'button' | 'div' | 'a';
  href?: string;
  target?: string;
}

export const Touchable: React.FC<TouchableProps> = ({
  children,
  onClick,
  className = '',
  disabled = false,
  as = 'button',
  href,
  target,
}) => {
  const baseClasses = `
    min-h-[44px] min-w-[44px]
    flex items-center justify-center
    transition-all duration-150
    active:scale-95
    disabled:opacity-50 disabled:cursor-not-allowed
    ${className}
  `;

  if (as === 'a') {
    return (
      <a
        href={href}
        target={target}
        className={baseClasses}
        onClick={onClick}
      >
        {children}
      </a>
    );
  }

  if (as === 'div') {
    return (
      <div
        className={`${baseClasses} cursor-pointer`}
        onClick={disabled ? undefined : onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick && !disabled ? 0 : undefined}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && onClick && !disabled) {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={baseClasses}
    >
      {children}
    </button>
  );
};
