/** Только development: в production консоль не засоряется. */
export const IS_DEV = import.meta.env.DEV;

export function devLog(...args: unknown[]): void {
  if (IS_DEV) console.log(...args);
}

export function devWarn(...args: unknown[]): void {
  if (IS_DEV) console.warn(...args);
}
