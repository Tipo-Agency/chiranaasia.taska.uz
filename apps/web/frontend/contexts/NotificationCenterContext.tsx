/**
 * Единый источник: список in-app уведомлений + WebSocket + счётчик непрочитанных.
 * Один WS на пользователя — без дублей в App и InboxPage.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../../backend/api';
import { chatLocalService } from '../../services/chatLocalService';

export interface SystemNotificationItem {
  id: string;
  title: string;
  body: string;
  isRead?: boolean;
  createdAt?: string;
}

interface NotificationCenterValue {
  notifications: SystemNotificationItem[];
  unreadCount: number;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markOneRead: (id: string, isRead?: boolean) => Promise<void>;
}

const NotificationCenterContext = createContext<NotificationCenterValue | null>(null);

/** Backoff переподключения: 1s → 2s → 4s → далее не чаще чем раз в 30s */
function notificationsWsReconnectDelayMs(attemptIndex: number): number {
  const stepsSec = [1, 2, 4, 30];
  const sec = stepsSec[Math.min(attemptIndex, stepsSec.length - 1)];
  return sec * 1000;
}

const WS_MAX_FAILS_BEFORE_SESSION_DISABLE = 20;

function isUnreadCountPollAuthStop(e: unknown): boolean {
  const s = e instanceof Error ? e.message : String(e);
  if (/\b401\b|\b403\b/.test(s)) return true;
  return /not authenticated|session expired|session invalidated|invalid or expired token|forbidden|permission denied|admin access required/i.test(
    s
  );
}

export function NotificationCenterProvider({
  userId,
  children,
}: {
  userId: string | undefined;
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState<SystemNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const list = await api.notifications.list(userId, false, 100);
      const typed = (list || []) as SystemNotificationItem[];
      setNotifications(typed);
      setUnreadCount(typed.filter((n) => !n.isRead).length);
      // Дублируем в локальную ленту «Система» с тем же id, что и при WS — без повторов
      for (const n of typed) {
        if (!n?.id) continue;
        chatLocalService.addSystemFeedMessage({
          id: `notif-${n.id}`,
          targetUserId: userId,
          text: `${n.title}: ${n.body}`,
          createdAt: n.createdAt,
        });
      }
    } catch {
      /* ignore */
    }
    try {
      const res = await api.notifications.unreadCount(userId);
      setUnreadCount(res.unreadCount || 0);
    } catch {
      /* ignore */
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    let intentionalClose = false;
    let reconnectTimer: number | null = null;
    let reconnectAttempt = 0;
    let activeWs: WebSocket | null = null;

    refresh();

    const wsDisableKey = `notifications_ws_disabled:${userId}`;
    const WS: typeof WebSocket | undefined = (globalThis as any).WebSocket;

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const detachWs = (socket: WebSocket | null) => {
      if (!socket) return;
      try {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
      } catch {
        /* ignore */
      }
    };

    const scheduleReconnect = () => {
      clearReconnectTimer();
      if (!mounted || intentionalClose) return;
      try {
        if (sessionStorage.getItem(wsDisableKey) === '1') return;
      } catch {
        /* ignore */
      }
      if (reconnectAttempt >= WS_MAX_FAILS_BEFORE_SESSION_DISABLE) {
        try {
          sessionStorage.setItem(wsDisableKey, '1');
        } catch {
          /* ignore */
        }
        return;
      }
      const delay = notificationsWsReconnectDelayMs(reconnectAttempt);
      reconnectAttempt += 1;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connectSocket();
      }, delay);
    };

    const connectSocket = () => {
      clearReconnectTimer();
      if (!mounted || intentionalClose) return;
      try {
        if (sessionStorage.getItem(wsDisableKey) === '1') return;
      } catch {
        /* ignore */
      }

      if (
        typeof WS !== 'function' ||
        !WS.prototype ||
        typeof WS.prototype.send !== 'function' ||
        typeof WS.prototype.close !== 'function'
      ) {
        scheduleReconnect();
        return;
      }

      let socket: WebSocket;
      try {
        socket = new WS(api.notifications.wsUrl(userId));
      } catch {
        scheduleReconnect();
        return;
      }

      activeWs = socket;

      socket.onopen = () => {
        if (!mounted) return;
        reconnectAttempt = 0;
        void refresh();
      };

      socket.onmessage = (evt: MessageEvent) => {
        try {
          const data = JSON.parse(evt.data);
          if (data?.type === 'notification.created' && data.notification && mounted) {
            setNotifications((prev) => [
              {
                id: data.notification.id,
                title: data.notification.title,
                body: data.notification.body,
                isRead: false,
                createdAt:
                  (typeof data.notification.createdAt === 'string' && data.notification.createdAt) ||
                  new Date().toISOString(),
              },
              ...prev,
            ]);
            setUnreadCount((prev) => prev + 1);
            chatLocalService.addSystemFeedMessage({
              id: `notif-${data.notification.id}`,
              targetUserId: userId,
              text: `${data.notification.title}: ${data.notification.body}`,
            });
          }
        } catch {
          /* malformed */
        }
      };

      socket.onerror = () => {
        /* onclose выполнит один переподключение с backoff — не дублируем и не отключаем WS с первой ошибки */
      };

      socket.onclose = () => {
        activeWs = null;
        if (!mounted || intentionalClose) return;
        scheduleReconnect();
      };
    };

    connectSocket();

    const pollId = window.setInterval(() => {
      void api.notifications
        .unreadCount(userId)
        .then((res) => {
          if (!mounted) return;
          setUnreadCount(res.unreadCount || 0);
        })
        .catch((err) => {
          if (isUnreadCountPollAuthStop(err)) window.clearInterval(pollId);
        });
    }, 30000);

    return () => {
      mounted = false;
      intentionalClose = true;
      window.clearInterval(pollId);
      clearReconnectTimer();
      const s = activeWs;
      activeWs = null;
      detachWs(s);
      try {
        if (s && (s.readyState === WebSocket.OPEN || s.readyState === WebSocket.CONNECTING)) {
          s.close();
        }
      } catch {
        /* ignore */
      }
    };
  }, [userId, refresh]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    try {
      const list = (await api.notifications.list(userId, true, 200)) as SystemNotificationItem[];
      await Promise.all((list || []).map((n) => api.notifications.markRead(n.id, true).catch(() => {})));
    } catch {
      const unread = notifications.filter((n) => !n.isRead);
      await Promise.all(unread.map((n) => api.notifications.markRead(n.id, true).catch(() => {})));
    }
    await refresh();
  }, [userId, notifications, refresh]);

  const markOneRead = useCallback(async (id: string, isRead = true) => {
    await api.notifications.markRead(id, isRead).catch(() => {});
    setNotifications((prev) => {
      const cur = prev.find((x) => x.id === id);
      const wasUnread = cur && !cur.isRead;
      if (isRead && wasUnread) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      return prev.map((n) => (n.id === id ? { ...n, isRead } : n));
    });
  }, []);

  const value = useMemo<NotificationCenterValue>(
    () => ({
      notifications,
      unreadCount,
      refresh,
      markAllRead,
      markOneRead,
    }),
    [notifications, unreadCount, refresh, markAllRead, markOneRead]
  );

  return (
    <NotificationCenterContext.Provider value={value}>{children}</NotificationCenterContext.Provider>
  );
}

export function useNotificationCenter(): NotificationCenterValue {
  const ctx = useContext(NotificationCenterContext);
  if (!ctx) {
    throw new Error('useNotificationCenter must be used within NotificationCenterProvider');
  }
  return ctx;
}

/** Для экранов вне провайдера (не должно случаться) */
export function useNotificationCenterOptional(): NotificationCenterValue | null {
  return useContext(NotificationCenterContext);
}
