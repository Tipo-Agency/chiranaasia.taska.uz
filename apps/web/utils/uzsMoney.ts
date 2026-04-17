/**
 * Узбекский сум: 1 сум = 100 тийин. Минимальная денежная единица в расчётах — 1 тийин.
 * Доли суммируются без «хвостов» от float: распределение в целых тийинах.
 */

export const TIYIN_PER_SUM = 100;

export function moneyToTiyin(amount: number): number {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * TIYIN_PER_SUM);
}

export function tiyinToMoney(tiyin: number): number {
  return Math.round(tiyin) / TIYIN_PER_SUM;
}

/** Нормализация суммы к ближайшему тийину (для ввода и отображения). */
export function roundMoney(amount: number): number {
  return tiyinToMoney(moneyToTiyin(amount));
}

/** Сложение сумм в тийинах без накопления float-ошибок. */
export function sumMoney(amounts: readonly number[]): number {
  let t = 0;
  for (const a of amounts) {
    t += moneyToTiyin(a);
  }
  return tiyinToMoney(t);
}

/** Вычитание одной или нескольких сумм от total (все в тийинах). */
export function subtractMoney(total: number, ...deductions: readonly number[]): number {
  let t = moneyToTiyin(total);
  for (const d of deductions) {
    t -= moneyToTiyin(d);
  }
  return tiyinToMoney(t);
}

/** Процент от суммы с округлением до тийина (как в налоговых/бух. расчётах по UZS). */
export function mulPercentMoney(amount: number, percent: number): number {
  const p = Number(percent) || 0;
  return tiyinToMoney(Math.round((moneyToTiyin(amount) * p) / 100));
}

/**
 * Разбить totalTiyin пропорционально неотрицательным весам; сумма частей строго равна totalTiyin.
 * На каждом шаге: floor(remaining * w_i / sum(w_i…w_{n-1})) — стандартная схема без потерь тийинов.
 */
export function splitTiyinProportionally(totalTiyin: number, weights: readonly number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const w = weights.map((x) => Math.max(0, Number(x) || 0));
  const target = Math.round(totalTiyin);
  let remainingW = w.reduce((a, b) => a + b, 0);
  if (remainingW <= 0) {
    const out = new Array<number>(n).fill(0);
    if (n > 0) out[n - 1] = target;
    return out;
  }
  let remainingT = target;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === n - 1) {
      out.push(remainingT);
      break;
    }
    const wi = w[i];
    const part = Math.floor((remainingT * wi) / remainingW);
    out.push(part);
    remainingT -= part;
    remainingW -= wi;
  }
  return out;
}
