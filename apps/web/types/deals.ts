import type { Client } from './clients';

export type DealKind = 'funnel' | 'contract';

/** Вложения сделки (PDF и др.) — хранятся в API в custom_fields._deal_attachments */
export interface DealAttachment {
  id: string;
  dealId: string;
  name: string;
  url: string;
  type: string;
  uploadedAt: string;
  attachmentType?: 'file' | 'doc';
  storagePath?: string;
  docId?: string;
}

export interface Deal {
  id: string;
  dealKind?: DealKind;
  title?: string;
  stage?: string;
  assigneeId?: string;
  contactName?: string;
  source?: 'instagram' | 'telegram' | 'site' | 'manual' | 'recommendation' | 'vk';
  telegramChatId?: string;
  telegramUsername?: string;
  projectId?: string;
  comments?: Comment[];
  clientId?: string;
  /** Основной CRM-контакт (контактное лицо компании), FK crm_contacts. */
  contactId?: string;
  client?: Client;
  recurring?: boolean;
  number?: string;
  status?: 'pending' | 'paid' | 'overdue' | 'active' | 'completed' | string;
  description?: string;
  amount: number;
  currency: string;
  funnelId?: string;
  notes?: string;
  isArchived?: boolean;
  createdAt?: string;
  updatedAt?: string;
  /** Optimistic locking для PATCH /deals/{id}. */
  version?: number;
  date?: string;
  dueDate?: string;
  paidAmount?: number;
  paidDate?: string;
  startDate?: string;
  endDate?: string;
  paymentDay?: number;
  /** Произвольные поля с сервера (без служебного ключа _deal_attachments — он в attachments) */
  customFields?: Record<string, unknown>;
  tags?: string[];
  lostReason?: string;
  /** Файлы сделки (см. custom_fields._deal_attachments на бэкенде) */
  attachments?: DealAttachment[];
}

export type Contract = Deal;
export type OneTimeDeal = Deal;

export type AccountsReceivableStatus = 'pending' | 'partial' | 'paid' | 'overdue';

export interface AccountsReceivable {
  id: string;
  clientId: string;
  dealId: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: AccountsReceivableStatus;
  description: string;
  paidAmount?: number;
  paidDate?: string;
  createdAt: string;
  updatedAt?: string;
  isArchived?: boolean;
}

export interface Comment {
  id: string;
  text: string;
  authorId: string;
  createdAt: string;
  type?: 'internal' | 'telegram_in' | 'telegram_out' | 'instagram_in' | 'instagram_out';
  metaMid?: string;
  attachments?: {
    type?: string;
    kind?: string;
    url?: string;
    title?: string;
    mime?: string;
    fileName?: string;
    durationSec?: number;
    size?: number;
    tgMessageId?: number;
  }[];
  tgMessageId?: number;
}
