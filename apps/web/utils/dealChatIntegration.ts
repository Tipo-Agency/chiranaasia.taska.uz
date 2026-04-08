import type { Client, Deal } from '../types';

/** @username из карточки клиента (без ведущего @) */
export function linkedClientTelegram(clients: Client[], deal: Deal): string {
  if (!deal.clientId) return '';
  const c = clients.find((x) => x.id === deal.clientId);
  const t = (c?.telegram || '').trim();
  if (!t || t.startsWith('ig:')) return '';
  return t.replace(/^@+/u, '');
}

/** Можно отправить во внешний канал (Instagram Direct или Telegram бот/личный). */
export function canSendExternalTelegram(
  deal: Deal | undefined,
  clients: Client[],
  tgPersonalConnected: boolean
): boolean {
  if (!deal) return false;
  if (deal.source === 'instagram') return Boolean(deal.telegramChatId?.startsWith('ig:'));
  if (deal.source === 'telegram') {
    const id = String(deal.telegramChatId || '').trim();
    const un = String(deal.telegramUsername || '').trim();
    const fromClient = linkedClientTelegram(clients, deal);
    const peerOk =
      (id.length > 0 && /^-?\d+$/.test(id)) ||
      (un.length > 0 && !un.startsWith('ig:')) ||
      (fromClient.length > 0 && !fromClient.startsWith('ig:'));
    if (tgPersonalConnected && peerOk) return true;
    return id.length > 0 && /^-?\d+$/.test(id);
  }
  return false;
}

/** Есть clientId и непустой Telegram в карточке клиента (ещё без проверки личного аккаунта). Не для IG/TG-лида. */
export function hasLinkedClientTelegramPeer(deal: Deal | undefined, clients: Client[]): boolean {
  if (!deal?.clientId) return false;
  if (deal.source === 'instagram' || deal.source === 'site' || deal.source === 'telegram') return false;
  return Boolean(linkedClientTelegram(clients, deal));
}

/** Личный Telegram + @username в карточке клиента (сделка не из канала Telegram). */
export function canSendTelegramFromClientCard(
  deal: Deal | undefined,
  clients: Client[],
  tgPersonalConnected: boolean
): boolean {
  if (!deal || !tgPersonalConnected || !deal.clientId) return false;
  if (deal.source === 'instagram' || deal.source === 'site') return false;
  if (deal.source === 'telegram') return false;
  return Boolean(linkedClientTelegram(clients, deal));
}

export function shouldSyncTelegramDealMessages(
  deal: Deal | undefined,
  clients: Client[],
  tgPersonalConnected: boolean
): boolean {
  if (!deal || !tgPersonalConnected) return false;
  return deal.source === 'telegram' || canSendTelegramFromClientCard(deal, clients, tgPersonalConnected);
}

export function dealChatInputPlaceholder(
  deal: Deal | undefined,
  clients: Client[],
  tgPersonalConnected: boolean,
  tgApiConfigured?: boolean
): string {
  if (!deal) return '';
  if (deal.source === 'instagram') return 'Написать в Instagram…';
  if (deal.source === 'telegram') return 'Написать в Telegram…';
  if (hasLinkedClientTelegramPeer(deal, clients)) {
    if (tgApiConfigured === false) return 'На сервере не настроен Telegram API (TELEGRAM_API_ID)…';
    if (!tgPersonalConnected) return 'Подключите личный Telegram в профиле, чтобы писать клиенту…';
    if (canSendTelegramFromClientCard(deal, clients, tgPersonalConnected)) return 'Написать в Telegram…';
  }
  if (canSendTelegramFromClientCard(deal, clients, tgPersonalConnected)) return 'Написать в Telegram…';
  if (deal.source === 'site') return 'Внутренняя заметка (клиент с сайта не видит)…';
  return 'Внутренняя заметка по сделке…';
}
