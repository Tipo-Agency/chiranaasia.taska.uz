import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  const el = document.documentElement;
  const obs = new MutationObserver(() => callback());
  obs.observe(el, { attributes: true, attributeFilter: ['class'] });
  return () => obs.disconnect();
}

function getSnapshot() {
  return document.documentElement.classList.contains('dark');
}

function getServerSnapshot() {
  return false;
}

/** Синхронизация с классом `dark` на `<html>` (Tailwind dark mode). */
export function useDarkClass(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
