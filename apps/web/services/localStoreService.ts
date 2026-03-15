/**
 * Локальное хранилище (localStorage) — замена облачной БД для демо.
 * API совместимо с прежним firestoreService: getAll, getById, save, delete.
 */

const STORAGE_PREFIX = 'local_db_';

function getKey(collectionName: string): string {
  return `${STORAGE_PREFIX}${collectionName}`;
}

function readCollection(collectionName: string): any[] {
  try {
    const raw = localStorage.getItem(getKey(collectionName));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCollection(collectionName: string, items: any[]): void {
  localStorage.setItem(getKey(collectionName), JSON.stringify(items));
}

export const localStoreService = {
  getAll: async (collectionName: string): Promise<any[]> => {
    return readCollection(collectionName);
  },

  getById: async (collectionName: string, id: string): Promise<any | null> => {
    const items = readCollection(collectionName);
    return items.find((item: any) => item.id === id) ?? null;
  },

  save: async (collectionName: string, data: any): Promise<boolean> => {
    if (!data || !data.id) return false;
    const items = readCollection(collectionName);
    const index = items.findIndex((item: any) => item.id === data.id);
    const next = [...items];
    if (index >= 0) next[index] = data;
    else next.push(data);
    writeCollection(collectionName, next);
    return true;
  },

  delete: async (collectionName: string, id: string): Promise<boolean> => {
    const items = readCollection(collectionName).filter((item: any) => item.id !== id);
    writeCollection(collectionName, items);
    return true;
  },

  /** Записать весь массив в коллекцию (для сида мок-данных) */
  setAll: (collectionName: string, items: any[]): void => {
    writeCollection(collectionName, items);
  },
};
