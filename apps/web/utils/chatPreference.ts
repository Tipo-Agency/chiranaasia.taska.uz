export type ChatMainTab = 'team' | 'clients';

const KEY_PREFIX = 'chat_default_tab:';

export function getChatDefaultTab(userId: string): ChatMainTab {
  if (typeof window === 'undefined') return 'team';
  try {
    const v = window.localStorage.getItem(`${KEY_PREFIX}${userId}`) || '';
    return v === 'clients' ? 'clients' : 'team';
  } catch {
    return 'team';
  }
}

export function setChatDefaultTab(userId: string, tab: ChatMainTab) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${KEY_PREFIX}${userId}`, tab);
  } catch {
    // ignore
  }
}

