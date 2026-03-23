import React from 'react';
import { Plus } from 'lucide-react';
import { MODULE_ACCENTS, type ModuleAccentKey } from './moduleAccent';

export interface ModuleCreateIconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Цвет кнопки как у модуля (по умолчанию indigo) */
  accent?: ModuleAccentKey;
  /** aria-label / title */
  label?: string;
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
  ...rest
}) => {
  const fab = MODULE_ACCENTS[accent].fab;
  return (
    <button
      type={type}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`order-first inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${fab} ${className}`}
      {...rest}
    >
      <Plus size={22} strokeWidth={2.5} />
    </button>
  );
};
