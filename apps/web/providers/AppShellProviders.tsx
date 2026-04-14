import React from 'react';
import { NotificationCenterProvider } from '../frontend/contexts/NotificationCenterContext';
import { AppToolbarProvider } from '../contexts/AppToolbarContext';

/** Оболочка авторизованного UI: уведомления + тулбар (контексты вне разметки страницы). */
export function AppShellProviders({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  return (
    <NotificationCenterProvider userId={userId}>
      <AppToolbarProvider>{children}</AppToolbarProvider>
    </NotificationCenterProvider>
  );
}
