/** Публичные URL без монтирования полного приложения (избегаем лишних хуков на лендингах). */

export function getPublicContentPlanIdFromPath(): string | null {
  if (typeof window === 'undefined') return null;
  const m = window.location.pathname.match(/^\/content-plan\/(.+)$/);
  return m ? decodeURIComponent(m[1].trim()) : null;
}
