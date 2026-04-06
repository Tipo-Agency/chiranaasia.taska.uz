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
  priority?: string;
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
    refresh();

    let ws: WebSocket | null = null;
    const wsDisableKey = `notifications_ws_disabled:${userId}`;
    try {
      const WS: any = (globalThis as any).WebSocket;
      try {
        if (sessionStorage.getItem(wsDisableKey) === '1') {
          ws = null;
        }
      } catch {
        // ignore
      }
      // In some environments (CSP/sandbox/old embedded webviews) WebSocket constructor may throw.
      if (
        typeof WS === 'function' &&
        WS.prototype &&
        typeof WS.prototype.send === 'function' &&
        typeof WS.prototype.close === 'function'
      ) {
        ws = new WS(api.notifications.wsUrl(userId));
        ws.onerror = () => {
          // If WS is not supported by server/proxy (common in prod without upgrade headers),
          // disable reconnect attempts for this session to avoid console spam.
          try {
            sessionStorage.setItem(wsDisableKey, '1');
          } catch {
            // ignore
          }
          try {
            // readyState: 1 === OPEN
            if (ws && (ws as any).readyState === 1) ws.close();
          } catch {
            // ignore
          }
        };
        ws.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data);
            if (data?.type === 'notification.created' && data.notification && mounted) {
              setNotifications((prev) => [
                {
                  id: data.notification.id,
                  title: data.notification.title,
                  body: data.notification.body,
                  priority: data.notification.priority,
                  isRead: false,
                  createdAt: new Date().toISOString(),
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
      }
    } catch {
      ws = null;
    }

    const pollId = window.setInterval(() => {
      api.notifications
        .unreadCount(userId)
        .then((res) => {
          if (!mounted) return;
          setUnreadCount(res.unreadCount || 0);
        })
        .catch(() => {});
    }, 30000);

    return () => {
      mounted = false;
      window.clearInterval(pollId);
      try {
        // In React StrictMode dev cycle cleanup can run while CONNECTING.
        // Avoid explicit close in CONNECTING state to prevent noisy browser warning.
        // readyState: 1 === OPEN
        if (ws && (ws as any).readyState === 1) ws.close();
      } catch {
        /* ignore */
      }
    };
  }, [userId, refresh]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const unread = notifications.filter((n) => !n.isRead);
    await Promise.all(unread.map((n) => api.notifications.markRead(n.id, true).catch(() => {})));
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, [userId, notifications]);

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
