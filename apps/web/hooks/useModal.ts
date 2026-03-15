import { useState, useCallback } from 'react';

/**
 * Хук для управления состоянием модального окна
 * @param initialOpen - начальное состояние открытости
 * @returns объект с состоянием и методами управления
 */
export function useModal(initialOpen = false) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  return {
    isOpen,
    open,
    close,
    toggle,
    setIsOpen
  };
}

