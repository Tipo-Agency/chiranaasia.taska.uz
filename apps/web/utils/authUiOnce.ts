/**
 * Одноразовые UI-флаги в рамках вкладки (без sessionStorage).
 * Не для токенов — только подсказки вроде «смените пароль».
 */
const mustChangePasswordPromptShown = new Set<string>();

export function resetMustChangePasswordPromptFlag(userId: string): void {
  mustChangePasswordPromptShown.delete(userId);
}

/** Первый вызов для userId в этой вкладке — true; дальнейшие — false. */
export function takeMustChangePasswordPromptSlot(userId: string): boolean {
  if (mustChangePasswordPromptShown.has(userId)) {
    return false;
  }
  mustChangePasswordPromptShown.add(userId);
  return true;
}
