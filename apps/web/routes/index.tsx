/**
 * Корень «роутинга»: SPA без react-router — переключение экранов внутри {@link MainApp} / {@link AppRouter}.
 * Публичные страницы обрабатываются в `App.tsx` до монтирования `useAppLogic`.
 * {@link ErrorBoundary} вокруг основного UI — внутри {@link MainApp}.
 *
 * Модули экранов (фаза 4 ТЗ): `AuthGuard`, `AuthRoutes`, `DashboardRoutes`, `TaskRoutes`, `ChatRoutes`,
 * `InboxRoutes`, `CrmRoutes`, `FinanceRoutes`, `HrRoutes`, `AdminRoutes`, `DocumentsRoutes`,
 * `ProductionRoutes`, `InventoryRoutes` — подключаются из {@link AppRouter}.
 */
import React from 'react';
import { MainApp } from '../frontend/MainApp';

export function AppAuthenticatedRoot() {
  return <MainApp />;
}
