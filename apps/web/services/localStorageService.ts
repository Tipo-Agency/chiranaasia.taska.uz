/**
 * Локальное хранилище файлов для демо (вместо облачного Storage).
 * Файлы сохраняются как data URL в localStorage по ключу path.
 */

const FILES_PREFIX = 'local_files_';

function storageKey(path: string): string {
  return `${FILES_PREFIX}${path.replace(/\//g, '_')}`;
}

export interface UploadResult {
  url: string;
  path: string;
}

export const uploadFile = async (
  file: File,
  path: string = "uploads/",
  fileName?: string
): Promise<UploadResult> => {
  return new Promise((resolve, reject) => {
    const name = fileName || `${Date.now()}_${file.name}`;
    const storagePath = `${path}${name}`;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      try {
        localStorage.setItem(storageKey(storagePath), dataUrl);
        resolve({ url: dataUrl, path: storagePath });
      } catch (e) {
        reject(new Error('Недостаточно места в localStorage'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
};

export const uploadFiles = async (
  files: File[],
  path: string = "uploads/"
): Promise<UploadResult[]> => {
  return Promise.all(files.map(file => uploadFile(file, path)));
};

export const deleteFile = async (path: string): Promise<void> => {
  localStorage.removeItem(storageKey(path));
};

export const getFileUrl = async (path: string): Promise<string> => {
  const data = localStorage.getItem(storageKey(path));
  if (!data) throw new Error('Файл не найден');
  return data;
};

export const listFiles = async (_path: string): Promise<{ name: string }[]> => {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(FILES_PREFIX)) keys.push(key);
  }
  const prefix = storageKey(_path);
  return keys
    .filter(k => k.startsWith(prefix))
    .map(k => ({ name: k.replace(prefix, '').replace(/^_/, '') }));
};

export const uploadTaskAttachment = async (file: File, taskId: string): Promise<UploadResult> => {
  return uploadFile(file, `tasks/${taskId}/attachments/`);
};

export const uploadDocument = async (file: File, docId?: string): Promise<UploadResult> => {
  const path = docId ? `documents/${docId}/` : "documents/";
  return uploadFile(file, path);
};

export const uploadAvatar = async (file: File, userId: string): Promise<UploadResult> => {
  const fileName = `avatar_${userId}.${file.name.split('.').pop()}`;
  return uploadFile(file, "avatars/", fileName);
};
