import React from 'react';
import { Plus } from 'lucide-react';
import { MODULE_ACCENTS, type ModuleAccentKey } from './moduleAccent';

export interface ModuleCreateIconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Цвет кнопки как у модуля (по умолчанию indigo) */
  accent?: ModuleAccentKey;
  /** aria-label / title */
  label?: string;
  /** sm — компактная кнопка для шапки */
  size?: 'md' | 'sm';
}

/**
 * Кнопка «Создать» только с плюсом — как в модуле «Встречи» (квадрат w-11 h-11 rounded-xl).
 */
export const ModuleCreateIconButton: React.FC<ModuleCreateIconButtonProps> = ({
  accent = 'indigo',
  label = 'Создать',
  className = '',
  type = 'button',
  disabled,
  size = 'sm',
  ...rest
}) => {
  const fab = MODULE_ACCENTS[accent].fab;
  const dim = size === 'sm' ? 'w-8 h-8 rounded-lg' : 'w-11 h-11 rounded-xl';
  const iconSize = size === 'sm' ? 16 : 22;
  const stroke = size === 'sm' ? 2.25 : 2.5;
  return (
    <button
      type={type}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center ${dim} shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${fab} ${className}`}
      {...rest}
    >
      <Plus size={iconSize} strokeWidth={stroke} />
    </button>
  );
};
