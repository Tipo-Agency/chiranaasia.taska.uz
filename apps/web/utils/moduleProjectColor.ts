import type { CSSProperties } from 'react';
import { swatchHexForTableColorToken } from '../constants';

/** Полная строка классов статуса/лейбла, сохранённая в color (редко для модулей). */
export function isProjectLegacyFullTailwindClass(color: string | undefined): boolean {
  const c = color?.trim() ?? '';
  return c.length > 0 && c.includes('bg-') && c.includes('text-');
}

export function normalizeHex6(hexInput: string): string | null {
  let h = hexInput.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length !== 6 || !/^[0-9a-fA-F]+$/i.test(h)) return null;
  return `#${h.toLowerCase()}`;
}

/** Hex для текста иконки / inline-стилей (без динамических `text-*` в Tailwind). */
export function resolveProjectAccentHex(color: string | undefined): string {
  if (!color?.trim()) return '#6b7280';
  const t = color.trim();
  if (t.startsWith('#')) {
    return normalizeHex6(t) ?? '#6b7280';
  }
  if (isProjectLegacyFullTailwindClass(t)) return '#6b7280';
  return swatchHexForTableColorToken(t);
}

/** Бейдж модуля в таблице задач / модалке — только inline, JIT не нужен. */
export function moduleProjectPillStyle(color: string | undefined): CSSProperties | null {
  if (isProjectLegacyFullTailwindClass(color ?? '')) return null;
  const hex = resolveProjectAccentHex(color);
  const raw = hex.replace('#', '');
  if (raw.length !== 6) {
    return {
      color: hex,
      backgroundColor: 'rgba(107, 114, 128, 0.16)',
      borderColor: 'rgba(107, 114, 128, 0.32)',
    };
  }
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return {
    color: hex,
    backgroundColor: `rgba(${r},${g},${b},0.16)`,
    borderColor: `rgba(${r},${g},${b},0.32)`,
  };
}
