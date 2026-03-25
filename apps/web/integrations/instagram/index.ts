/**
 * Точка входа Instagram / Meta: не тянем тяжёлый клиент, пока флаг выключен.
 * Включение: VITE_ENABLE_INSTAGRAM_LEADS=true
 */
export const instagramIntegrationEnabled =
  import.meta.env.VITE_ENABLE_INSTAGRAM_LEADS === 'true' ||
  import.meta.env.VITE_ENABLE_INSTAGRAM_LEADS === '1';

export async function loadInstagramService() {
  if (!instagramIntegrationEnabled) return null;
  return import('../../services/instagramService');
}
