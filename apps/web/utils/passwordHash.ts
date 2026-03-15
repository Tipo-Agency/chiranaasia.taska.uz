// Утилита для безопасного хеширования паролей
import bcrypt from 'bcryptjs';

/**
 * Хеширует пароль перед сохранением в базу данных
 * @param password Пароль в открытом виде
 * @returns Хеш пароля (строка)
 */
export const hashPassword = async (password: string): Promise<string> => {
  if (!password || password.trim() === '') {
    throw new Error('Пароль не может быть пустым');
  }
  
  // Используем 10 раундов хеширования (баланс между безопасностью и производительностью)
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password.trim(), saltRounds);
  return hashedPassword;
};

/**
 * Синхронная версия хеширования (для случаев, когда async недоступен)
 * @param password Пароль в открытом виде
 * @returns Хеш пароля (строка)
 */
export const hashPasswordSync = (password: string): string => {
  if (!password || password.trim() === '') {
    throw new Error('Пароль не может быть пустым');
  }
  
  const saltRounds = 10;
  const hashedPassword = bcrypt.hashSync(password.trim(), saltRounds);
  return hashedPassword;
};

/**
 * Проверяет, соответствует ли введенный пароль хешу из базы данных
 * @param password Пароль в открытом виде (введенный пользователем)
 * @param hash Хеш пароля из базы данных
 * @returns true, если пароль верный, false - если неверный
 */
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  if (!password || !hash) {
    return false;
  }
  
  try {
    // Убеждаемся, что хеш не содержит лишних пробелов
    const cleanHash = hash.trim();
    const cleanPassword = password.trim();
    
    const isMatch = await bcrypt.compare(cleanPassword, cleanHash);
    return isMatch;
  } catch (error) {
    console.error('Ошибка при сравнении пароля:', error);
    return false;
  }
};

/**
 * Синхронная версия проверки пароля
 * @param password Пароль в открытом виде (введенный пользователем)
 * @param hash Хеш пароля из базы данных
 * @returns true, если пароль верный, false - если неверный
 */
export const comparePasswordSync = (password: string, hash: string): boolean => {
  if (!password || !hash) {
    return false;
  }
  
  try {
    const isMatch = bcrypt.compareSync(password.trim(), hash);
    return isMatch;
  } catch (error) {
    console.error('Ошибка при сравнении пароля:', error);
    return false;
  }
};

/**
 * Проверяет, является ли строка хешем пароля (для миграции старых паролей)
 * @param value Строка для проверки
 * @returns true, если это похоже на bcrypt хеш
 */
export const isHashedPassword = (value: string): boolean => {
  if (!value || typeof value !== 'string') {
    return false;
  }
  
  // Убираем пробелы в начале и конце
  const trimmed = value.trim();
  
  // Bcrypt хеш всегда начинается с $2a$, $2b$, $2x$ или $2y$ и имеет длину 60 символов
  const bcryptPattern = /^\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}$/;
  return bcryptPattern.test(trimmed);
};

