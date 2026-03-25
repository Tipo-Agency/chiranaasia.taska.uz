/**
 * Утилиты для CRUD операций
 * Устраняет дублирование кода в логике сохранения/удаления
 */
import type { Dispatch, SetStateAction } from 'react';

export interface CrudItem {
  id: string;
  updatedAt?: string;
  createdAt?: string;
}

/**
 * Сохраняет или обновляет элемент в массиве
 * @param items - массив элементов
 * @param item - элемент для сохранения
 * @returns новый массив с обновленным/добавленным элементом
 */
export function saveItem<T extends CrudItem>(items: T[], item: T): T[] {
  const existingIndex = items.findIndex(x => x.id === item.id);
  if (existingIndex >= 0) {
    return items.map((x, index) => index === existingIndex ? item : x);
  }
  return [...items, item];
}

/**
 * Удаляет элемент из массива по ID
 * @param items - массив элементов
 * @param id - ID элемента для удаления
 * @returns новый массив без удаленного элемента
 */
export function deleteItem<T extends CrudItem>(items: T[], id: string): T[] {
  return items.filter(item => item.id !== id);
}

/**
 * Находит элемент в массиве по ID
 * @param items - массив элементов
 * @param id - ID элемента
 * @returns найденный элемент или undefined
 */
export function findItemById<T extends CrudItem>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id);
}

/**
 * Создает функцию сохранения элемента с уведомлением и синхронизацией
 * @param setter - функция для обновления состояния
 * @param apiUpdate - функция для обновления через API
 * @param notification - функция для показа уведомления
 * @param successMessage - сообщение об успехе
 * @returns функция сохранения
 */
export function createSaveHandler<T extends CrudItem>(
  setter: Dispatch<SetStateAction<T[]>>,
  apiUpdate: (items: T[]) => void | Promise<unknown>,
  notification: (msg: string) => void,
  successMessage: string,
  errorMessage: string = 'Ошибка сохранения. Проверьте подключение и повторите.'
) {
  return (item: T) => {
    setter(prevItems => {
      const now = new Date().toISOString();
      const itemWithTimestamp: T = {
        ...item,
        updatedAt: now,
        createdAt: item.createdAt || (prevItems.find(x => x.id === item.id) ? undefined : now)
      } as T;
      const updated = saveItem(prevItems, itemWithTimestamp);
      Promise.resolve(apiUpdate(updated))
        .catch(() => notification(errorMessage));
      notification(successMessage);
      return updated;
    });
  };
}

/**
 * Создает функцию удаления элемента с уведомлением и синхронизацией
 * Использует мягкое удаление (isArchived: true) вместо физического удаления
 * @param setter - функция для обновления состояния
 * @param apiUpdate - функция для обновления через API
 * @param notification - функция для показа уведомления
 * @param successMessage - сообщение об успехе
 * @returns функция удаления
 */
export function createDeleteHandler<T extends CrudItem & { isArchived?: boolean }>(
  setter: Dispatch<SetStateAction<T[]>>,
  apiUpdate: (items: T[]) => void | Promise<unknown>,
  notification: (msg: string) => void,
  successMessage: string
) {
  return async (id: string) => {
    const now = new Date().toISOString();
    // Мягкое удаление: помечаем элемент как архивный вместо физического удаления
    // Архивные элементы не возвращаются из хранилища
    setter(prevItems => {
      const updated = prevItems.map(item => {
        if (item.id === id) {
          return { ...item, isArchived: true, updatedAt: now } as T;
        }
        return { ...item, updatedAt: item.updatedAt || now } as T;
      });
      Promise.resolve(apiUpdate(updated)).catch(err => {
        console.error('Ошибка сохранения:', err);
        notification('Ошибка удаления. Проверьте подключение и повторите.');
      });
      return updated;
    });
    notification(successMessage);
  };
}

