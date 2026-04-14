/**
 * Единая точка входа провайдеров верхнего уровня.
 * Сейчас основная оболочка авторизованного UI — {@link AppShellProviders} внутри {@link MainApp}.
 */
import React from 'react';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
