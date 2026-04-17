import { chatLocalService } from '../services/chatLocalService';

const BROADCAST_TO_ALL_ID = '__all__';

/** Личный входящий + системная лента + общий канал «Всем». */
export function countIncomingChatUnread(currentUserId: string): number {
  let n = 0;
  for (const msg of chatLocalService.getMessagesForUser(currentUserId)) {
    if (msg.read !== false) continue;
    if (!msg.fromId || msg.fromId === currentUserId) continue;
    if (msg.toId === currentUserId) {
      n += 1;
      continue;
    }
    if (msg.toId === BROADCAST_TO_ALL_ID) {
      n += 1;
    }
  }
  return n;
}
