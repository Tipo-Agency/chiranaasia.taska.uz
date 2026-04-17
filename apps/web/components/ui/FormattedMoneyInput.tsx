import React, { useEffect, useRef, useState } from 'react';
import { roundMoney, roundToWholeSumUz } from '../../utils/uzsMoney';

/** Только цифры из строки ввода → неотрицательное целое (сумы). */
export function parseDigitsToNonNegativeInteger(s: string): number {
  const d = s.replace(/\D/g, '').slice(0, 18);
  if (!d) return 0;
  const n = Number(d);
  return Number.isFinite(n) ? n : 0;
}

function formatDigitGroupsFromInt(v: number): string {
  const int = Math.trunc(Math.abs(Number(v) || 0));
  if (int === 0) return '';
  return String(int).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
}

export interface FormattedMoneyInputProps {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  /** Верхняя граница (целые сумы UZS), опционально */
  max?: number;
}

/**
 * Поле сумы UZS: при вводе показывает группы разрядов (тысячи / миллионы).
 * Хранит и отдаёт наружу округлённые целые сумы.
 */
export const FormattedMoneyInput: React.FC<FormattedMoneyInputProps> = ({
  value,
  onChange,
  disabled,
  className,
  placeholder = '0',
  max,
}) => {
  const focused = useRef(false);
  const whole = roundToWholeSumUz(roundMoney(value));
  const [text, setText] = useState(() => formatDigitGroupsFromInt(whole));

  useEffect(() => {
    if (focused.current) return;
    setText(formatDigitGroupsFromInt(roundToWholeSumUz(roundMoney(value))));
  }, [value]);

  const clamp = (n: number) => {
    let x = roundToWholeSumUz(roundMoney(n));
    if (max !== undefined && Number.isFinite(max)) {
      const cap = roundToWholeSumUz(roundMoney(max));
      if (x > cap) x = cap;
    }
    return x;
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      value={text}
      onFocus={() => {
        focused.current = true;
        const w = roundToWholeSumUz(roundMoney(value));
        setText(w > 0 ? formatDigitGroupsFromInt(w) : '');
      }}
      onChange={(e) => {
        let n = parseDigitsToNonNegativeInteger(e.target.value);
        n = clamp(n);
        setText(n > 0 ? formatDigitGroupsFromInt(n) : '');
        onChange(n);
      }}
      onBlur={() => {
        focused.current = false;
        const n = clamp(parseDigitsToNonNegativeInteger(text));
        onChange(n);
        setText(formatDigitGroupsFromInt(n));
      }}
    />
  );
};
