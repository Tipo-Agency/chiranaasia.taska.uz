/**
 * Утилиты для работы с файлами
 */

/**
 * Проверяет, является ли файл изображением
 * @param url - URL файла
 * @param type - MIME тип файла
 * @returns true если файл является изображением
 */
export function isImageFile(url: string, type: string): boolean {
  return type.includes('image') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
}

/**
 * Проверяет, является ли файл PDF
 * @param url - URL файла
 * @param type - MIME тип файла
 * @returns true если файл является PDF
 */
export function isPdfFile(url: string, type: string): boolean {
  return type.includes('pdf') || /\.pdf$/i.test(url);
}

/**
 * Получает расширение файла из имени или URL
 * @param filename - имя файла или URL
 * @returns расширение файла (без точки) или пустая строка
 */
export function getFileExtension(filename: string): string {
  const match = filename.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Форматирует размер файла в читаемый формат
 * @param bytes - размер в байтах
 * @returns отформатированная строка (например, "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

