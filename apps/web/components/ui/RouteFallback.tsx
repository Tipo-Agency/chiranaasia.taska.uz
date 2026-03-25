import React from 'react';

/** Плейсхолдер при lazy-загрузке экрана (React.Suspense). */
export const RouteFallback: React.FC = () => (
  <div className="h-full min-h-[40vh] flex items-center justify-center bg-white dark:bg-[#191919] text-gray-500 dark:text-gray-400 text-sm">
    Загрузка…
  </div>
);
