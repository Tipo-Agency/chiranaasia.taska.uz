export type ChatEntityType = 'task' | 'deal' | 'request' | 'doc' | 'file' | 'meeting' | 'client';

export interface ChatMessageLocal {
  id: string;
  fromId: string;
  toId: string;
  text: string;
  createdAt: string;
  /** For backend-synced messages: read flag for recipient */
  read?: boolean;
  isSystem?: boolean;
  entityType?: ChatEntityType;
  entityId?: string;
  /** Ссылка на документ из модуля «Документы» */
  docId?: string;
  docTitle?: string;
  /** Прикреплённый файл */
  fileName?: string;
  fileSize?: number;
  fileMime?: string;
  /** Для небольших изображений / превью */
  fileDataUrl?: string;
}

const STORAGE_KEY = 'local_chat_messages_v1';

/** Системный отправитель: лента «Система» в мессенджере */
export const SYSTEM_CHAT_SENDER_ID = '__system__';

function readAll(): ChatMessageLocal[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(messages: ChatMessageLocal[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  window.dispatchEvent(new CustomEvent('taska:chat-messages-changed'));
}

export const chatLocalService = {
  upsertMessages(next: ChatMessageLocal[]): void {
    const all = readAll();
    const byId = new Map<string, ChatMessageLocal>();
    for (const m of all) byId.set(m.id, m);
    for (const m of next) {
      const prev = byId.get(m.id);
      byId.set(m.id, prev ? { ...prev, ...m } : m);
    }
    writeAll(Array.from(byId.values()));
  },

  getMessagesForUser(userId: string): ChatMessageLocal[] {
    return readAll().filter(
      (m) =>
        m.fromId === userId ||
        m.toId === userId ||
        m.toId === '__all__' ||
        (m.fromId === SYSTEM_CHAT_SENDER_ID && m.toId === userId)
    );
  },

  addMessage(input: {
    id?: string;
    fromId: string;
    toId: string;
    text: string;
    createdAt?: string;
    read?: boolean;
    isSystem?: boolean;
    entityType?: ChatEntityType;
    entityId?: string;
    docId?: string;
    docTitle?: string;
    fileName?: string;
    fileSize?: number;
    fileMime?: string;
    fileDataUrl?: string;
  }): ChatMessageLocal {
    const all = readAll();
    const msg: ChatMessageLocal = {
      id: input.id || `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: input.createdAt || new Date().toISOString(),
      ...input,
    };
    if (input.id) {
      const idx = all.findIndex((m) => m.id === input.id);
      if (idx >= 0) {
        all[idx] = { ...all[idx], ...msg };
        writeAll(all);
        return all[idx];
      }
    }
    all.push(msg);
    writeAll(all);
    return msg;
  },

  addSystemMessageForEntity(opts: {
    actorId: string;
    targetUserId: string;
    text: string;
    entityType?: ChatEntityType;
    entityId?: string;
  }) {
    return chatLocalService.addMessage({
      fromId: opts.actorId,
      toId: opts.targetUserId,
      text: opts.text,
      isSystem: true,
      entityType: opts.entityType,
      entityId: opts.entityId,
    });
  },

  /** Лента «Система»: уведомления о задачах, сделках и т.д. с прикреплённой сущностью */
  addSystemFeedMessage(opts: {
    /** Стабильный id (например notif-uuid) — чтобы не дублировать с WS и при refresh */
    id?: string;
    targetUserId: string;
    text: string;
    createdAt?: string;
    entityType?: ChatEntityType;
    entityId?: string;
  }) {
    return chatLocalService.addMessage({
      id: opts.id,
      fromId: SYSTEM_CHAT_SENDER_ID,
      toId: opts.targetUserId,
      text: opts.text,
      createdAt: opts.createdAt,
      isSystem: true,
      entityType: opts.entityType,
      entityId: opts.entityId,
    });
  },
};
