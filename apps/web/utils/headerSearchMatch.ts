/** Нормализованное вхождение подстроки для строки поиска в шапке. */
export function normalizeHeaderSearchQuery(raw: string): string {
  return raw.trim().toLowerCase();
}

export function textMatchesHeaderSearch(haystack: string | undefined | null, qNorm: string): boolean {
  if (!qNorm) return true;
  if (haystack == null || haystack === '') return false;
  return String(haystack).toLowerCase().includes(qNorm);
}

export function rowMatchesHeaderSearch(qNorm: string, parts: Array<string | undefined | null>): boolean {
  if (!qNorm) return true;
  const blob = parts
    .filter((x) => x != null && String(x).trim() !== '')
    .map((x) => String(x).toLowerCase())
    .join(' ');
  return blob.includes(qNorm);
}
