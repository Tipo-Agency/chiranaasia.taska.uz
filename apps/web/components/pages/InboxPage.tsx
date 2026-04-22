import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  ChevronLeft,
  ExternalLink,
  Mail,
  MessageSquare,
  Search,
  Send,
} from 'lucide-react';
import type { ActivityLog, Deal, InboxMessage, User } from '../../types';
import { PageLayout } from '../ui/PageLayout';
import { api } from '../../backend/api';
import { useNotificationCenter } from '../../frontend/contexts/NotificationCenterContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type Channel = 'all' | 'internal' | 'telegram' | 'instagram' | 'email' | 'notifications';

interface Conversation {
  id: string;
  channel: 'internal' | 'telegram' | 'instagram' | 'email' | 'notifications';
  displayName: string;
  avatarLetters: string;
  preview: string;
  lastAt: string;
  unread: number;
  dealId?: string;
  peerId?: string;
}

interface ThreadMsg {
  id: string;
  text: string;
  isMine: boolean;
  sentAt: string;
  senderName?: string;
  mediaUrl?: string | null;
}

interface DealComment {
  id?: string;
  text?: string;
  body?: string;
  message?: string;
  direction?: 'in' | 'out' | string;
  channel?: string;
  createdAt?: string;
  senderId?: string;
  mediaUrl?: string | null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface InboxPageProps {
  activities?: ActivityLog[];
  currentUser: User;
  tasks?: unknown[];
  deals: Deal[];
  purchaseRequests?: unknown[];
  users?: User[];
  onMarkAllRead?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

function fmtTime(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
    if (daysDiff === 0) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    if (daysDiff < 7) return d.toLocaleDateString('ru-RU', { weekday: 'short' });
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

const CHANNEL_META: Record<
  Exclude<Channel, 'all'>,
  { label: string; color: string; dot: string }
> = {
  internal:      { label: 'Внутренние',  color: 'text-indigo-500',  dot: 'bg-indigo-400' },
  telegram:      { label: 'Telegram',    color: 'text-sky-500',     dot: 'bg-sky-400' },
  instagram:     { label: 'Instagram',   color: 'text-pink-500',    dot: 'bg-pink-400' },
  email:         { label: 'Email',       color: 'text-amber-500',   dot: 'bg-amber-400' },
  notifications: { label: 'Уведомления', color: 'text-violet-500',  dot: 'bg-violet-400' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export const InboxPage: React.FC<InboxPageProps> = ({
  currentUser,
  deals,
  users = [],
  onMarkAllRead,
}) => {
  const [activeChannel, setActiveChannel] = useState<Channel>('all');
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [showThread, setShowThread]       = useState(false);   // mobile: thread visible
  const [search, setSearch]               = useState('');
  const [replyText, setReplyText]         = useState('');
  const [sending, setSending]             = useState(false);
  const [inboxMsgs, setInboxMsgs]         = useState<InboxMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs]     = useState(true);

  const threadEndRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    unreadCount: notifUnread,
    markOneRead,
    markAllRead: markAllNotifRead,
  } = useNotificationCenter();

  // ── Load internal messages ─────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const msgs = await api.messages.getInbox(currentUser.id, { limit: 500 }) as InboxMessage[];
        if (alive) setInboxMsgs(Array.isArray(msgs) ? msgs : []);
      } finally {
        if (alive) setLoadingMsgs(false);
      }
    };
    void load();
    return () => { alive = false; };
  }, [currentUser.id]);

  // ── Build conversation list ────────────────────────────────────────────────
  const conversations = useMemo<Conversation[]>(() => {
    const result: Conversation[] = [];

    // INTERNAL: group by peer
    const peerMap = new Map<string, InboxMessage[]>();
    for (const m of inboxMsgs) {
      if (m.channel && m.channel !== 'internal') continue;
      const peer = m.senderId === currentUser.id ? m.recipientId : m.senderId;
      if (!peer || peer === 'system') continue;
      if (!peerMap.has(peer)) peerMap.set(peer, []);
      peerMap.get(peer)!.push(m);
    }
    for (const [peer, msgs] of peerMap) {
      const sorted = [...msgs].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const last   = sorted[sorted.length - 1];
      const unread = msgs.filter((m) => !m.isRead && m.senderId !== currentUser.id).length;
      const u      = users.find((u) => u.id === peer);
      const name   = u ? (u.name || u.email || peer) : peer;
      result.push({
        id: `int:${peer}`,
        channel: 'internal',
        displayName: name,
        avatarLetters: initials(name),
        preview: last.text || last.body || '…',
        lastAt: last.createdAt,
        unread,
        peerId: peer,
      });
    }

    // TELEGRAM deals
    for (const d of deals) {
      if (d.isArchived || d.source !== 'telegram') continue;
      const comments = (d.comments as unknown as DealComment[] | undefined) ?? [];
      const last     = comments[comments.length - 1];
      const name     = d.contactName || d.title || d.telegramUsername || `Telegram ${d.id.slice(0, 6)}`;
      result.push({
        id: `tg:${d.id}`,
        channel: 'telegram',
        displayName: name,
        avatarLetters: initials(name),
        preview: last ? (last.text || last.body || last.message || '…') : 'Нет сообщений',
        lastAt: last?.createdAt || d.createdAt || '',
        unread: 0,
        dealId: d.id,
      });
    }

    // INSTAGRAM deals
    for (const d of deals) {
      if (d.isArchived || d.source !== 'instagram') continue;
      const comments = (d.comments as unknown as DealComment[] | undefined) ?? [];
      const last     = comments[comments.length - 1];
      const name     = d.contactName || d.title || `Instagram ${d.id.slice(0, 6)}`;
      result.push({
        id: `ig:${d.id}`,
        channel: 'instagram',
        displayName: name,
        avatarLetters: initials(name),
        preview: last ? (last.text || last.body || last.message || '…') : 'Нет сообщений',
        lastAt: last?.createdAt || d.createdAt || '',
        unread: 0,
        dealId: d.id,
      });
    }

    return result.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }, [inboxMsgs, deals, currentUser.id, users]);

  // ── Filter by channel + search ─────────────────────────────────────────────
  const visibleConvs = useMemo(() => {
    let list = conversations;
    if (activeChannel !== 'all' && activeChannel !== 'notifications') {
      list = list.filter((c) => c.channel === activeChannel);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.displayName.toLowerCase().includes(q) ||
          c.preview.toLowerCase().includes(q)
      );
    }
    return list;
  }, [conversations, activeChannel, search]);

  // ── Thread messages ────────────────────────────────────────────────────────
  const selectedConv = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const threadMessages = useMemo<ThreadMsg[]>(() => {
    if (!selectedConv) return [];

    if (selectedConv.channel === 'internal' && selectedConv.peerId) {
      const peer = selectedConv.peerId;
      return inboxMsgs
        .filter(
          (m) =>
            (!m.channel || m.channel === 'internal') &&
            (m.senderId === peer || m.recipientId === peer)
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((m) => ({
          id: m.id,
          text: m.text || m.body || '',
          isMine: m.senderId === currentUser.id,
          sentAt: m.createdAt,
          mediaUrl: m.mediaUrl,
        }));
    }

    if (selectedConv.dealId) {
      const deal = deals.find((d) => d.id === selectedConv.dealId);
      const comments = (deal?.comments as unknown as DealComment[] | undefined) ?? [];
      return comments.map((c, i) => ({
        id: c.id || `comment-${i}`,
        text: c.text || c.body || c.message || '',
        isMine: c.direction === 'out',
        sentAt: c.createdAt || '',
        mediaUrl: c.mediaUrl,
        senderName: c.direction === 'out' ? currentUser.name : selectedConv.displayName,
      }));
    }

    return [];
  }, [selectedConv, inboxMsgs, deals, currentUser]);

  // Scroll to bottom when thread changes
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages.length, selectedId]);

  // Mark internal messages as read when conversation is opened
  useEffect(() => {
    if (!selectedConv || selectedConv.channel !== 'internal' || !selectedConv.peerId) return;
    const unreadIds = inboxMsgs
      .filter(
        (m) =>
          !m.isRead &&
          m.senderId === selectedConv.peerId &&
          m.recipientId === currentUser.id
      )
      .map((m) => m.id);
    if (unreadIds.length === 0) return;
    for (const id of unreadIds) {
      void api.messages.markRead(id, true);
    }
    setInboxMsgs((prev) =>
      prev.map((m) => (unreadIds.includes(m.id) ? { ...m, isRead: true, read: true } : m))
    );
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send reply ─────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!replyText.trim() || !selectedConv || sending) return;
    if (selectedConv.channel !== 'internal') return;
    setSending(true);
    try {
      const { id: newId } = await api.messages.add({
        senderId: currentUser.id,
        recipientId: selectedConv.peerId ?? undefined,
        text: replyText.trim(),
        channel: 'internal',
        direction: 'internal',
      });
      const newMsg: InboxMessage = {
        id: newId,
        senderId: currentUser.id,
        recipientId: selectedConv.peerId ?? null,
        text: replyText.trim(),
        body: replyText.trim(),
        attachments: [],
        createdAt: new Date().toISOString(),
        read: true,
        isRead: true,
        channel: 'internal',
        direction: 'internal',
      };
      setInboxMsgs((prev) => [...prev, newMsg]);
      setReplyText('');
    } finally {
      setSending(false);
    }
  }, [replyText, selectedConv, currentUser.id, sending]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      void handleSend();
    }
  };

  // ── Select conversation ────────────────────────────────────────────────────
  const selectConv = (id: string) => {
    setSelectedId(id);
    setShowThread(true);
    setReplyText('');
  };

  const handleMarkAll = () => {
    void markAllNotifRead();
    onMarkAllRead?.();
  };

  // ── Total unread badge ─────────────────────────────────────────────────────
  const totalUnread = useMemo(
    () => conversations.reduce((s, c) => s + c.unread, 0) + notifUnread,
    [conversations, notifUnread]
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  const isNotifTab = activeChannel === 'notifications';

  return (
    <PageLayout>
      <div className="flex h-full overflow-hidden">

        {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
        <div
          className={`
            flex flex-col shrink-0 border-r border-gray-200 dark:border-[#2a2a2a]
            bg-white dark:bg-[#1c1c1c]
            w-full sm:w-72 lg:w-80
            ${showThread ? 'hidden sm:flex' : 'flex'}
          `}
        >
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-[#2a2a2a]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Коммуникации</span>
                {totalUnread > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-red-500 text-white">
                    {totalUnread}
                  </span>
                )}
              </div>
              {notifUnread > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="text-[11px] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  Прочитать все
                </button>
              )}
            </div>

            {/* Channel filter tabs */}
            <div className="flex flex-wrap gap-1">
              {(['all', 'internal', 'telegram', 'instagram', 'email', 'notifications'] as Channel[]).map((ch) => {
                const active = activeChannel === ch;
                const meta   = ch === 'all' ? null : CHANNEL_META[ch as Exclude<Channel, 'all'>];
                const unr    = ch === 'notifications' ? notifUnread
                             : ch === 'all' ? totalUnread
                             : conversations.filter((c) => c.channel === ch).reduce((s, c) => s + c.unread, 0);
                return (
                  <button
                    key={ch}
                    onClick={() => { setActiveChannel(ch); setSelectedId(null); setShowThread(false); }}
                    className={`
                      inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors
                      ${active
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'
                      }
                    `}
                  >
                    {meta && <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} shrink-0`} />}
                    {ch === 'all' ? 'Все' : meta!.label}
                    {unr > 0 && (
                      <span className={`px-1 py-0 text-[9px] font-bold rounded-full ${active ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}`}>
                        {unr}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search */}
          {!isNotifTab && (
            <div className="px-3 py-2 border-b border-gray-100 dark:border-[#2a2a2a]">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск диалогов…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-[#252525] border border-transparent focus:outline-none focus:border-gray-300 dark:focus:border-[#444] text-gray-900 dark:text-white placeholder-gray-400"
                />
              </div>
            </div>
          )}

          {/* Conversation / Notification list */}
          <div className="flex-1 overflow-y-auto">

            {/* ── NOTIFICATIONS MODE ── */}
            {isNotifTab && (
              notifications.length === 0 ? (
                <EmptyState icon={<Bell size={32} />} text="Нет уведомлений" />
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-[#2a2a2a]">
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => markOneRead(n.id, true)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors ${
                        n.isRead ? '' : 'bg-blue-50/50 dark:bg-blue-900/10'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.isRead && (
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{n.title}</p>
                          {n.body && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>}
                          {n.createdAt && (
                            <p className="text-[10px] text-gray-400 mt-1">{fmtTime(n.createdAt)}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )
            )}

            {/* ── CONVERSATION LIST ── */}
            {!isNotifTab && (
              loadingMsgs && visibleConvs.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-gray-400 text-xs">Загрузка…</div>
              ) : visibleConvs.length === 0 ? (
                activeChannel === 'email' ? (
                  <EmailComingSoon />
                ) : (
                  <EmptyState icon={<MessageSquare size={32} />} text="Нет диалогов" />
                )
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-[#2a2a2a]">
                  {visibleConvs.map((conv) => {
                    const meta    = CHANNEL_META[conv.channel];
                    const active  = selectedId === conv.id;
                    return (
                      <button
                        key={conv.id}
                        type="button"
                        onClick={() => selectConv(conv.id)}
                        className={`
                          w-full text-left flex items-center gap-3 px-4 py-3 transition-colors
                          ${active
                            ? 'bg-indigo-50 dark:bg-indigo-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-[#252525]'
                          }
                        `}
                      >
                        {/* Avatar */}
                        <div className={`relative w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white ${avatarColor(conv.channel)}`}>
                          {conv.avatarLetters || '?'}
                          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#1c1c1c] ${meta.dot}`} />
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-xs font-semibold truncate ${active ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-white'}`}>
                              {conv.displayName}
                            </span>
                            <span className="text-[10px] text-gray-400 shrink-0">{fmtTime(conv.lastAt)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{conv.preview}</p>
                            {conv.unread > 0 && (
                              <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-indigo-500 text-white">
                                {conv.unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL ─────────────────────────────────────────────────── */}
        <div
          className={`
            flex-1 flex flex-col overflow-hidden
            bg-gray-50 dark:bg-[#181818]
            ${!showThread && !isNotifTab ? 'hidden sm:flex' : 'flex'}
          `}
        >
          {isNotifTab ? (
            /* Notifications — desktop spacer */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-400 dark:text-gray-600">
                <Bell size={48} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Уведомления в левой панели</p>
              </div>
            </div>
          ) : selectedConv ? (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#1c1c1c] border-b border-gray-200 dark:border-[#2a2a2a]">
                {/* Mobile back */}
                <button
                  className="sm:hidden p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2a2a2a] text-gray-500"
                  onClick={() => setShowThread(false)}
                >
                  <ChevronLeft size={18} />
                </button>

                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white ${avatarColor(selectedConv.channel)}`}>
                  {selectedConv.avatarLetters}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{selectedConv.displayName}</p>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-medium ${CHANNEL_META[selectedConv.channel].color}`}>
                      {CHANNEL_META[selectedConv.channel].label}
                    </span>
                  </div>
                </div>

                {selectedConv.dealId && (
                  <a
                    href={`#deal-${selectedConv.dealId}`}
                    className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] transition-colors"
                  >
                    <ExternalLink size={12} />
                    Сделка
                  </a>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {threadMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                    Нет сообщений
                  </div>
                ) : (
                  threadMessages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`
                          max-w-[70%] rounded-2xl px-3.5 py-2.5 text-sm
                          ${msg.isMine
                            ? 'bg-indigo-500 text-white rounded-br-sm'
                            : 'bg-white dark:bg-[#252525] text-gray-900 dark:text-white border border-gray-200 dark:border-[#333] rounded-bl-sm shadow-sm'
                          }
                        `}
                      >
                        {msg.senderName && !msg.isMine && (
                          <p className="text-[10px] font-semibold mb-1 opacity-60">{msg.senderName}</p>
                        )}
                        {msg.mediaUrl && (
                          <img
                            src={msg.mediaUrl}
                            alt=""
                            className="rounded-lg mb-2 max-w-full max-h-48 object-cover"
                          />
                        )}
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.text}</p>
                        <p className={`text-[10px] mt-1 ${msg.isMine ? 'text-white/60' : 'text-gray-400'} text-right`}>
                          {fmtTime(msg.sentAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={threadEndRef} />
              </div>

              {/* Reply input */}
              {selectedConv.channel === 'internal' ? (
                <div className="bg-white dark:bg-[#1c1c1c] border-t border-gray-200 dark:border-[#2a2a2a] px-4 py-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Напишите сообщение… (Ctrl+Enter — отправить)"
                      rows={1}
                      className="flex-1 resize-none px-3 py-2 text-sm rounded-xl bg-gray-100 dark:bg-[#252525] border border-transparent focus:outline-none focus:border-indigo-300 dark:focus:border-indigo-600 text-gray-900 dark:text-white placeholder-gray-400 max-h-32 overflow-y-auto"
                      style={{ minHeight: 36 }}
                    />
                    <button
                      onClick={() => void handleSend()}
                      disabled={!replyText.trim() || sending}
                      className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Send size={15} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-[#1c1c1c] border-t border-gray-200 dark:border-[#2a2a2a] px-4 py-3">
                  <p className="text-xs text-gray-400 text-center">
                    Ответить можно из карточки сделки
                  </p>
                </div>
              )}
            </>
          ) : (
            <EmptyState
              icon={<MessageSquare size={40} />}
              text="Выберите диалог"
              sub="Все каналы коммуникаций в одном месте"
            />
          )}
        </div>

      </div>
    </PageLayout>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ icon, text, sub }: { icon: React.ReactNode; text: string; sub?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="text-gray-300 dark:text-gray-700 mb-3">{icon}</div>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{text}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

function EmailComingSoon() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <Mail size={36} className="text-gray-300 dark:text-gray-700 mb-3" />
      <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Email — скоро</p>
      <p className="text-xs text-gray-400 dark:text-gray-600 mt-2 max-w-xs">
        Интеграция корпоративной почты (Google Workspace, Yandex 360, Microsoft 365) в разработке.
      </p>
    </div>
  );
}

function avatarColor(channel: Conversation['channel']): string {
  switch (channel) {
    case 'telegram':  return 'bg-sky-500';
    case 'instagram': return 'bg-gradient-to-br from-pink-500 to-orange-400';
    case 'email':     return 'bg-amber-500';
    case 'notifications': return 'bg-violet-500';
    default:          return 'bg-indigo-500';
  }
}
