import React from 'react';
import type { User } from '../types';

type AuthGuardProps = {
  user: User | null | undefined;
  /** Если задано — все перечисленные права должны быть у пользователя. */
  requirePermissions?: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

/**
 * Обёртка для защищённых участков UI (view-based SPA без react-router).
 * До входа в сессию основной экран — {@link LoginView} в {@link MainApp}; здесь — доп. проверки по правам.
 */
export function AuthGuard({ user, requirePermissions, children, fallback = null }: AuthGuardProps) {
  if (!user) {
    return <>{fallback}</>;
  }
  if (requirePermissions?.length) {
    const perms = new Set(user.permissions ?? []);
    if (!requirePermissions.every((p) => perms.has(p))) {
      return <>{fallback}</>;
    }
  }
  return <>{children}</>;
}
