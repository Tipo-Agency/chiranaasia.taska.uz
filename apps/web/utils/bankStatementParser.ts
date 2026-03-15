/**
 * Парсер Excel-выписок для раздела «Выписки и сверка».
 * Зависимость: xlsx (добавить в package.json при реализации загрузки файлов).
 * Пока — заглушка; при добавлении загрузки Excel сюда перенести разбор строк выписки.
 */
import type { BankStatementLineApi } from '../services/apiClient';

export interface ParsedStatement {
  name?: string;
  period?: string;
  lines: BankStatementLineApi[];
}

/**
 * Парсит файл Excel (ArrayBuffer или File) в список строк выписки.
 * TODO: реализовать с использованием библиотеки xlsx.
 */
export function parseBankStatementFile(_file: ArrayBuffer | File): Promise<ParsedStatement> {
  return Promise.resolve({ lines: [] });
}
