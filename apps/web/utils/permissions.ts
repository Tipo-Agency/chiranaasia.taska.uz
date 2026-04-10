import { Role, type User } from '../types';

export const FULL_ACCESS = 'system.full_access';

/** Проверка права по списку из роли (логин /auth/me). Пока permissions не загружены — не скрываем интерфейс. */
export function hasPermission(user: User | null | undefined, key: string): boolean {
  if (!user) return false;
  const p = user.permissions;
  const isAdmin = user.roleSlug === 'admin' || user.role === Role.ADMIN;
  // Роль admin с пустым permissions в БД — не блокируем весь UI (частая причина «нет доступа ко всему»)
  if (isAdmin && (p === undefined || p === null || !p.length)) {
    return true;
  }
  if (p === undefined || p === null) return true;
  if (!p.length) return false;
  if (p.includes(FULL_ACCESS)) return true;
  return p.includes(key);
}
