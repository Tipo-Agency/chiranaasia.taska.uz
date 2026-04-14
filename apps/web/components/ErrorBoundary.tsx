import React from 'react';
import { Button } from './ui';

type ErrorBoundaryProps = { children: React.ReactNode };

type ErrorBoundaryState = { hasError: boolean; error?: unknown };

/**
 * Ловит ошибки рендера дочернего дерева; показывает запасной UI вместо белого экрана.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare readonly props: Readonly<ErrorBoundaryProps>;
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    console.error('App crashed:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-white dark:bg-[#121212] flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] p-6">
          <div className="text-lg font-bold text-gray-900 dark:text-white">Ошибка приложения</div>
          <div className="text-sm text-gray-600 dark:text-gray-300 mt-2">
            Похоже, приложение упало при рендере. Обновите страницу. Если повторяется — пришлите скрин консоли.
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Обновить
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
