/**
 * Пресеты цветов статусов/приоритетов: храним как badge:INDEX — рендер через inline hex,
 * чтобы не зависеть от Tailwind JIT и динамических классов.
 */
export type TaskBadgePalette = {
  label: string;
  light: { bg: string; text: string; border: string };
  dark: { bg: string; text: string; border: string };
  /** Точка на канбане / свотч */
  dot: { light: string; dark: string };
};

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(1, s));
  const light = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/** Название оттенка по углу hue (0–360), чтобы подпись совпадала с цветом кружка. */
export function labelForHue(h: number): string {
  const x = ((h % 360) + 360) % 360;
  if (x < 11 || x >= 349) return 'Красный';
  if (x < 25) return 'Алый';
  if (x < 40) return 'Оранжево-красный';
  if (x < 55) return 'Оранжевый';
  if (x < 70) return 'Золотистый';
  if (x < 85) return 'Жёлтый';
  if (x < 100) return 'Лайм';
  if (x < 120) return 'Салатовый';
  if (x < 140) return 'Зелёный';
  if (x < 160) return 'Мятный';
  if (x < 175) return 'Бирюзовый';
  if (x < 190) return 'Циан';
  if (x < 210) return 'Светло-синий';
  if (x < 230) return 'Синий';
  if (x < 250) return 'Индиго';
  if (x < 270) return 'Фиолетовый';
  if (x < 290) return 'Пурпур';
  if (x < 310) return 'Пурпурно-розовый';
  if (x < 330) return 'Розовый';
  if (x < 345) return 'Розово-красный';
  return 'Красный';
}

/** 40 гармоничных оттенков (полный круг по hue). */
export const TASK_BADGE_PRESETS: TaskBadgePalette[] = (() => {
  const out: TaskBadgePalette[] = [];
  for (let i = 0; i < 40; i++) {
    const hue = Math.round((i / 40) * 360);
    const [lr, lg, lb] = hslToRgb(hue, 0.32, 0.94);
    const [dr, dg, db] = hslToRgb(hue, 0.35, 0.22);
    const [ltr, ltg, ltb] = hslToRgb(hue, 0.45, 0.28);
    const [dtr, dtg, dtb] = hslToRgb(hue, 0.25, 0.88);
    const [lbr, lbg, lbb] = hslToRgb(hue, 0.2, 0.82);
    const [dbr, dbg, dbb] = hslToRgb(hue, 0.25, 0.35);
    const [dotLr, dotLg, dotLb] = hslToRgb(hue, 0.55, 0.55);
    const [dotDr, dotDg, dotDb] = hslToRgb(hue, 0.45, 0.5);
    out.push({
      label: labelForHue(hue),
      light: {
        bg: toHex(lr, lg, lb),
        text: toHex(ltr, ltg, ltb),
        border: toHex(lbr, lbg, lbb),
      },
      dark: {
        bg: toHex(dr, dg, db),
        text: toHex(dtr, dtg, dtb),
        border: toHex(dbr, dbg, dbb),
      },
      dot: {
        light: toHex(dotLr, dotLg, dotLb),
        dark: toHex(dotDr, dotDg, dotDb),
      },
    });
  }
  return out;
})();

export const TASK_BADGE_PRESET_COUNT = TASK_BADGE_PRESETS.length;

/** Дефолт для нового приоритета — «Зелёный» (индекс в labels) */
export const DEFAULT_PRIORITY_BADGE_INDEX = 16;

export function parseBadgeIndex(color: string | undefined): number | null {
  const m = /^badge:(\d+)$/.exec((color || '').trim());
  if (!m) return null;
  const idx = parseInt(m[1], 10);
  if (idx < 0 || idx >= TASK_BADGE_PRESETS.length) return null;
  return idx;
}
