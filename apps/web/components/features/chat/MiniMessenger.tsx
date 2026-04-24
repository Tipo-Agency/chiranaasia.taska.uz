/**
 * Мессенджер: диалоги с коллегами, вложения, ссылки на сущности системы.
 */
import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  Send,
  Users,
  Paperclip,
  FileText,
  Link2,
  Plus,
  GitBranch,
  Briefcase,
  Calendar,
  FolderOpen,
  X,
  Search,
  Info,
  Sparkles,
} from 'lucide-react';
import { User, Doc, Task, Deal, Meeting, BusinessProcess } from '../../../types';
import { chatLocalService, ChatMessageLocal, SYSTEM_CHAT_SENDER_ID } from '../../../services/chatLocalService';
import { api } from '../../../backend/api';

const TO_ALL_ID = '__all__';
/** Виртуальный диалог: системные уведомления */
const SYSTEM_FEED_UI = '__system_feed__';
const MAX_FILE_BYTES = 512 * 1024;

export interface MiniMessengerProps {
  users: User[];
  currentUser: User;
  onClose?: () => void;
  className?: string;
  /** Документы для выбора и вставки в чат */
  docs?: Doc[];
  tasks?: Task[];
  deals?: Deal[];
  meetings?: Meeting[];
  /** Открыть документ (редактор / ссылка) */
  onOpenDocument?: (doc: Doc) => void;
  /** Перейти в модуль документов */
  onOpenDocumentsModule?: () => void;
  onOpenDeals?: () => void;
  onOpenMeetings?: () => void;
  onOpenTask?: (task: Task) => void;
  onOpenDeal?: (deal: Deal) => void;
  onOpenMeeting?: (meeting: Meeting) => void;
  onCreateEntity?: (type: 'task' | 'deal' | 'meeting' | 'doc', title: string) => Promise<{ id: string; label: string } | null> | { id: string; label: string } | null;
  onUpdateEntity?: (
    type: 'task' | 'deal' | 'meeting' | 'doc',
    id: string,
    patch: Record<string, unknown>
  ) => Promise<boolean> | boolean;
  processTemplates?: BusinessProcess[];
  onStartProcessTemplate?: (processId: string) => Promise<{ id: string; label: string } | null> | { id: string; label: string } | null;
  /** Открыть ленту «Система» при монтировании (из колокольчика) */
  initialOpenSystemFeed?: boolean;
  onConsumedInitialSystemFeed?: () => void;
}

function formatDayLabel(d: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Сегодня';
  if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export const MiniMessenger: React.FC<MiniMessengerProps> = ({
  users,
  currentUser,
  onClose,
  className = '',
  docs = [],
  tasks = [],
  deals = [],
  meetings = [],
  onOpenDocument,
  onOpenDocumentsModule,
  onOpenDeals,
  onOpenMeetings,
  onOpenTask,
  onOpenDeal,
  onOpenMeeting,
  onCreateEntity,
  onUpdateEntity,
  processTemplates = [],
  onStartProcessTemplate,
  initialOpenSystemFeed = false,
  onConsumedInitialSystemFeed,
}) => {
  const colleagues = useMemo(
    () => users.filter((u) => u.id !== currentUser.id && !u.isArchived),
    [users, currentUser.id]
  );
  const [activeId, setActiveId] = useState<string | null>(SYSTEM_FEED_UI);
  const [messages, setMessages] = useState<ChatMessageLocal[]>([]);
  const [input, setInput] = useState('');
  const [activePanel, setActivePanel] = useState<null | 'entity' | 'create' | 'process'>(null);
  const [entityType, setEntityType] = useState<'task' | 'deal' | 'meeting' | 'doc'>('task');
  const [entitySearch, setEntitySearch] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<{ type: 'task' | 'deal' | 'meeting' | 'doc'; id: string } | null>(null);
  const [createEntityType, setCreateEntityType] = useState<'task' | 'deal' | 'meeting' | 'doc'>('task');
  const [createEntityTitle, setCreateEntityTitle] = useState('');
  const [processSearch, setProcessSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const refreshLocal = () => setMessages(chatLocalService.getMessagesForUser(currentUser.id));

  const syncFromBackend = async () => {
    try {
      const [inbox, outbox] = await Promise.all([
        api.messages.getInbox(currentUser.id),
        api.messages.getOutbox(currentUser.id),
      ]);

      /** Форма сообщения как приходит из API — все поля unknown до маппинга */
      interface RawChatMessage {
        id?: unknown;
        senderId?: unknown;
        recipientId?: unknown;
        text?: unknown;
        createdAt?: unknown;
        read?: unknown;
      }

      const mapped: ChatMessageLocal[] = [
        ...(inbox as RawChatMessage[]),
        ...(outbox as RawChatMessage[]),
      ]
        .filter(Boolean)
        .map((m) => {
          const toId = m.recipientId == null ? TO_ALL_ID : String(m.recipientId);
          const rawSender = String(m.senderId || '');
          // API кладёт системные уведомления как sender "system", лента «Система» — __system__
          const fromId =
            rawSender === 'system' ? SYSTEM_CHAT_SENDER_ID : rawSender;
          return {
            id: String(m.id),
            fromId,
            toId,
            text: String(m.text || ''),
            createdAt: String(m.createdAt || new Date().toISOString()),
            read: typeof m.read === 'boolean' ? m.read : undefined,
            isSystem: rawSender === 'system' || fromId === SYSTEM_CHAT_SENDER_ID,
          };
        });

      chatLocalService.upsertMessages(mapped);
    } catch {
      // ignore network/backend issues; local chat still works
    } finally {
      refreshLocal();
    }
  };

  useEffect(() => {
    void syncFromBackend();
  }, [currentUser.id]);

  useEffect(() => {
    const t = window.setInterval(() => {
      void syncFromBackend();
    }, 5000);
    return () => window.clearInterval(t);
  }, [currentUser.id]);

  const markThreadRead = async (threadUserId: string) => {
    const all = chatLocalService.getMessagesForUser(currentUser.id);
    const incomingUnread = all.filter(
      (m) =>
        m.fromId === threadUserId &&
        m.toId === currentUser.id &&
        m.read === false
    );
    if (!incomingUnread.length) return;
    await Promise.all(
      incomingUnread.map((m) => api.messages.markRead(m.id, true).catch(() => {}))
    );
    chatLocalService.upsertMessages(incomingUnread.map((m) => ({ ...m, read: true })));
    refreshLocal();
  };

  const markSystemFeedRead = async () => {
    const all = chatLocalService.getMessagesForUser(currentUser.id);
    const incomingUnread = all.filter(
      (m) =>
        m.fromId === SYSTEM_CHAT_SENDER_ID &&
        m.toId === currentUser.id &&
        m.read === false
    );
    if (!incomingUnread.length) return;
    await Promise.all(
      incomingUnread.map((m) => api.messages.markRead(m.id, true).catch(() => {}))
    );
    chatLocalService.upsertMessages(incomingUnread.map((m) => ({ ...m, read: true })));
    refreshLocal();
  };

  const markBroadcastRead = async () => {
    const all = chatLocalService.getMessagesForUser(currentUser.id);
    const incomingUnread = all.filter(
      (m) =>
        m.toId === TO_ALL_ID &&
        m.fromId !== currentUser.id &&
        m.read === false
    );
    if (!incomingUnread.length) return;
    await Promise.all(
      incomingUnread.map((m) => api.messages.markRead(m.id, true).catch(() => {}))
    );
    chatLocalService.upsertMessages(incomingUnread.map((m) => ({ ...m, read: true })));
    refreshLocal();
  };

  useEffect(() => {
    if (!activeId) return;
    if (activeId === SYSTEM_FEED_UI) {
      void markSystemFeedRead();
      return;
    }
    if (activeId === TO_ALL_ID) {
      void markBroadcastRead();
      return;
    }
    void markThreadRead(activeId);
  }, [activeId, currentUser.id]);

  useEffect(() => {
    if (initialOpenSystemFeed) {
      setActiveId(SYSTEM_FEED_UI);
      onConsumedInitialSystemFeed?.();
    }
  }, [initialOpenSystemFeed, onConsumedInitialSystemFeed]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, activeId]);

  const threadMessages = useMemo(() => {
    if (activeId === SYSTEM_FEED_UI) {
      return messages
        .filter((m) => m.fromId === SYSTEM_CHAT_SENDER_ID && m.toId === currentUser.id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    if (activeId === TO_ALL_ID) {
      return messages
        .filter((m) => m.toId === TO_ALL_ID)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return messages
      .filter(
        (m) =>
          (m.fromId === currentUser.id && m.toId === activeId) ||
          (m.toId === currentUser.id && m.fromId === activeId)
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages, activeId, currentUser.id]);

  const filteredEntities = useMemo(() => {
    const q = entitySearch.trim().toLowerCase();
    if (entityType === 'task') {
      const list = (tasks || []).filter((t) => !t.isArchived && t.entityType !== 'idea' && t.entityType !== 'feature');
      return list
        .filter((t) => !q || (t.title || '').toLowerCase().includes(q))
        .slice(0, 80)
        .map((t) => ({ id: t.id, label: t.title || 'Задача', subtitle: t.status || '' }));
    }
    if (entityType === 'deal') {
      const list = (deals || []).filter((d) => !d.isArchived);
      return list
        .filter((d) => !q || (d.title || '').toLowerCase().includes(q))
        .slice(0, 80)
        .map((d) => ({ id: d.id, label: d.title || 'Сделка', subtitle: d.stage || '' }));
    }
    if (entityType === 'doc') {
      const list = (docs || []).filter((d) => !d.isArchived);
      return list
        .filter((d) => !q || (d.title || '').toLowerCase().includes(q))
        .slice(0, 80)
        .map((d) => ({ id: d.id, label: d.title || 'Документ', subtitle: d.type === 'link' ? 'Ссылка' : 'Внутренний документ' }));
    }
    const list = (meetings || []).filter((m) => !m.isArchived);
    return list
      .filter((m) => !q || (m.title || '').toLowerCase().includes(q))
      .slice(0, 80)
      .map((m) => ({ id: m.id, label: m.title || 'Встреча', subtitle: `${m.date || ''} ${m.time || ''}`.trim() }));
  }, [entityType, entitySearch, tasks, deals, meetings, docs]);

  const filteredProcessTemplates = useMemo(() => {
    const q = processSearch.trim().toLowerCase();
    const latestById = new Map<string, BusinessProcess>();
    for (const p of processTemplates || []) {
      if (p.isArchived || !(p.steps?.length)) continue;
      const prev = latestById.get(p.id);
      if (!prev || (p.version || 1) > (prev.version || 1)) {
        latestById.set(p.id, p);
      }
    }
    const list = [...latestById.values()];
    if (!q) return list.slice(0, 80);
    return list
      .filter((p) => (p.title || '').toLowerCase().includes(q))
      .slice(0, 80);
  }, [processTemplates, processSearch]);

  const sendText = () => {
    const text = input.trim();
    if (!text || !activeId || activeId === SYSTEM_FEED_UI) return;
    const toId = activeId === TO_ALL_ID ? TO_ALL_ID : activeId;
    const localMsg = chatLocalService.addMessage({
      fromId: currentUser.id,
      toId,
      text,
      read: true,
    });
    // Persist to backend so Telegram bot can mirror messages.
    // "__all__" becomes recipientId=null (broadcast); otherwise recipientId=userId.
    api.messages
      .add({
        id: localMsg.id,
        createdAt: localMsg.createdAt,
        senderId: currentUser.id,
        recipientId: toId === TO_ALL_ID ? null : toId,
        text,
      })
      .catch(() => {});
    refreshLocal();
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const unreadByUserId = useMemo(() => {
    const m = new Map<string, number>();
    for (const msg of messages) {
      if (msg.toId !== currentUser.id) continue;
      if (msg.read !== false) continue;
      if (!msg.fromId) continue;
      m.set(msg.fromId, (m.get(msg.fromId) || 0) + 1);
    }
    return m;
  }, [messages, currentUser.id]);

  const attachEntity = (id: string, label: string) => {
    if (!activeId) return;
    chatLocalService.addMessage({
      fromId: currentUser.id,
      toId: activeId === TO_ALL_ID ? TO_ALL_ID : activeId,
      text: `🔗 ${label}`,
      entityType,
      entityId: id,
    });
    refreshLocal();
    setActivePanel(null);
    setEntitySearch('');
  };

  const createAndAttachEntity = async () => {
    const title = createEntityTitle.trim();
    if (!title || !activeId) return;
    let created: { id: string; label: string } | null = null;
    if (onCreateEntity) {
      created = await onCreateEntity(createEntityType, title);
    }
    const entityId = created?.id || `local-${createEntityType}-${Date.now()}`;
    const entityLabel = created?.label || title;
    chatLocalService.addMessage({
      fromId: currentUser.id,
      toId: activeId === TO_ALL_ID ? TO_ALL_ID : activeId,
      text: `🆕 ${entityLabel}`,
      entityType: createEntityType,
      entityId,
    });
    refreshLocal();
    setActivePanel(null);
    setCreateEntityTitle('');
  };

  const startFromTemplate = async (processId: string, title: string) => {
    if (!activeId) return;
    const started = onStartProcessTemplate ? await onStartProcessTemplate(processId) : null;
    chatLocalService.addMessage({
      fromId: currentUser.id,
      toId: activeId === TO_ALL_ID ? TO_ALL_ID : activeId,
      text: `🚀 ${started?.label || title}`,
      entityType: 'task',
      entityId: started?.id || `proc-${processId}-${Date.now()}`,
    });
    refreshLocal();
    setActivePanel(null);
    setProcessSearch('');
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeId) return;

    if (file.size > MAX_FILE_BYTES) {
      chatLocalService.addMessage({
        fromId: currentUser.id,
        toId: activeId === TO_ALL_ID ? TO_ALL_ID : activeId,
        text: `📎 ${file.name} — файл слишком большой для чата (макс. ${Math.round(MAX_FILE_BYTES / 1024)} КБ). Загрузите в «Документы».`,
        entityType: 'file',
      });
      refreshLocal();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : undefined;
      chatLocalService.addMessage({
        fromId: currentUser.id,
        toId: activeId === TO_ALL_ID ? TO_ALL_ID : activeId,
        text: `📎 ${file.name}`,
        entityType: 'file',
        fileName: file.name,
        fileSize: file.size,
        fileMime: file.type || undefined,
        fileDataUrl: dataUrl,
      });
      refreshLocal();
    };
    reader.readAsDataURL(file);
  };

  const activeName =
    activeId === SYSTEM_FEED_UI
      ? 'Системные уведомления'
      : activeId === TO_ALL_ID
        ? 'Общий чат'
        : colleagues.find((u) => u.id === activeId)?.name ?? activeId;

  const openLinkedDoc = (docId: string) => {
    const doc = docs.find((d) => d.id === docId);
    if (doc && onOpenDocument) {
      onOpenDocument(doc);
      onClose?.();
    }
  };

  const selectedEntityInfo = useMemo(() => {
    if (!selectedEntity) return null;
    if (selectedEntity.type === 'task') {
      const t = tasks.find((x) => x.id === selectedEntity.id);
      if (!t) return null;
      return {
        title: t.title || 'Задача',
        subtitle: t.status || 'Без статуса',
        body: t.description || 'Описание не заполнено',
      };
    }
    if (selectedEntity.type === 'deal') {
      const d = deals.find((x) => x.id === selectedEntity.id);
      if (!d) return null;
      return {
        title: d.title || 'Сделка',
        subtitle: d.stage || 'Без этапа',
        body: `${(d.amount || 0).toLocaleString('ru-RU')} ${d.currency || ''}`.trim(),
      };
    }
    if (selectedEntity.type === 'meeting') {
      const m = meetings.find((x) => x.id === selectedEntity.id);
      if (!m) return null;
      return {
        title: m.title || 'Встреча',
        subtitle: `${m.date || ''} ${m.time || ''}`.trim(),
        body: m.summary || 'Описание встречи отсутствует',
      };
    }
    const doc = docs.find((x) => x.id === selectedEntity.id);
    if (!doc) return null;
    return {
      title: doc.title || 'Документ',
      subtitle: doc.type === 'link' ? 'Ссылка' : 'Внутренний документ',
      body: doc.tags?.length ? `Теги: ${doc.tags.join(', ')}` : 'Без тегов',
    };
  }, [selectedEntity, tasks, deals, meetings, docs]);

  /** Группировка по дням для разделителей */
  const messagesWithDays: { key: string; label?: string; msg: ChatMessageLocal }[] = [];
  let lastDay = '';
  threadMessages.forEach((m) => {
    const day = new Date(m.createdAt).toDateString();
    if (day !== lastDay) {
      lastDay = day;
      messagesWithDays.push({
        key: `d-${m.id}`,
        label: formatDayLabel(new Date(m.createdAt)),
        msg: m,
      });
    } else {
      messagesWithDays.push({ key: m.id, msg: m });
    }
  });

  return (
    <div
      className={`flex flex-col h-full min-h-0 bg-gradient-to-b from-gray-50/95 to-white dark:from-[#1c1c1c] dark:to-[#252525] rounded-xl border border-gray-200/90 dark:border-[#333] shadow-sm overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200/80 dark:border-[#333] shrink-0 bg-white/70 dark:bg-[#252525]/90 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3337AD]/12 text-[#3337AD]">
            <MessageCircle size={20} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate leading-tight">Чат</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{activeName}</p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-[#333] transition-colors"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Список собеседников */}
        <div className="w-52 sm:w-56 border-r border-gray-200/80 dark:border-[#333] flex flex-col bg-white/50 dark:bg-[#1f1f1f]/80 shrink-0">
          <div className="p-2 border-b border-gray-100 dark:border-[#333]">
            <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Диалоги</p>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5">
            <button
              type="button"
              onClick={() => setActiveId(SYSTEM_FEED_UI)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-colors ${
                activeId === SYSTEM_FEED_UI
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  activeId === SYSTEM_FEED_UI ? 'bg-white/20' : 'bg-violet-500/15 text-violet-600 dark:text-violet-300'
                }`}
              >
                <Sparkles size={18} />
              </div>
              <span className="font-medium truncate">Система</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveId(TO_ALL_ID)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-colors ${
                activeId === TO_ALL_ID
                  ? 'bg-[#3337AD] text-white shadow-md'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  activeId === TO_ALL_ID ? 'bg-white/20' : 'bg-[#3337AD]/10 text-[#3337AD]'
                }`}
              >
                <Users size={18} />
              </div>
              <span className="font-medium truncate">Всем</span>
            </button>
            {colleagues.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setActiveId(u.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-colors ${
                  activeId === u.id
                    ? 'bg-[#3337AD] text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'
                }`}
              >
                {u.avatar ? (
                  <img
                    src={u.avatar}
                    alt=""
                    className={`h-9 w-9 rounded-full object-cover shrink-0 ring-2 ${
                      activeId === u.id ? 'ring-white/40' : 'ring-gray-200 dark:ring-[#444]'
                    }`}
                  />
                ) : (
                  <div
                    className={`h-9 w-9 rounded-full shrink-0 ring-2 flex items-center justify-center text-xs font-semibold ${
                      activeId === u.id
                        ? 'ring-white/40 bg-white/20 text-white'
                        : 'ring-gray-200 dark:ring-[#444] bg-[#3337AD]/10 text-[#3337AD]'
                    }`}
                  >
                    {(u.name || '?').trim().charAt(0).toUpperCase() || '?'}
                  </div>
                )}
                <span className="truncate font-medium flex-1 min-w-0">{u.name}</span>
                {(() => {
                  const cnt = unreadByUserId.get(u.id) || 0;
                  if (!cnt) return null;
                  return (
                    <span
                      className={`ml-auto shrink-0 min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${
                        activeId === u.id ? 'bg-white/20 text-white' : 'bg-[#3337AD] text-white'
                      }`}
                      aria-label={`Новых сообщений: ${cnt}`}
                      title={`Новых сообщений: ${cnt}`}
                    >
                      {cnt > 99 ? '99+' : cnt}
                    </span>
                  );
                })()}
              </button>
            ))}
          </div>
        </div>

        {/* Лента и ввод */}
        <div className="flex-1 flex flex-col min-w-0 bg-white/40 dark:bg-[#222]/50">
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-4 py-3 space-y-3">
            {threadMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${
                    activeId === SYSTEM_FEED_UI
                      ? 'bg-violet-100 dark:bg-violet-950/50 text-violet-500'
                      : 'bg-gray-100 dark:bg-[#333] text-gray-400'
                  }`}
                >
                  {activeId === SYSTEM_FEED_UI ? <Sparkles size={28} /> : <MessageCircle size={28} />}
                </div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {activeId === SYSTEM_FEED_UI ? 'Пока тихо' : 'Нет сообщений'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
                  {activeId === SYSTEM_FEED_UI
                    ? 'Здесь появятся назначения задач, события по сделкам и другие системные уведомления.'
                    : 'Напишите коллегам, прикрепите файл или документ из системы — панель действий под полем ввода.'}
                </p>
              </div>
            ) : (
              messagesWithDays.map(({ key, label, msg: m }) => (
                <React.Fragment key={key}>
                  {label && (
                    <div className="flex justify-center py-2">
                      <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 bg-gray-100/90 dark:bg-[#333] px-3 py-1 rounded-full">
                        {label}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    m={m}
                    users={users}
                    currentUser={currentUser}
                    onOpenDocument={onOpenDocument}
                    openLinkedDoc={openLinkedDoc}
                    onSelectEntity={(type, id) => setSelectedEntity({ type, id })}
                  />
                </React.Fragment>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Панель действий */}
          <div className="border-t border-gray-200/80 dark:border-[#333] bg-white/90 dark:bg-[#252525]/95 px-2 sm:px-3 pt-2 pb-3 shrink-0">
            {activeId === SYSTEM_FEED_UI ? (
              <p className="text-xs text-center text-gray-500 dark:text-gray-400 py-3 px-2 leading-relaxed">
                Системная лента только для просмотра. Нажмите на блок с задачей или сделкой в сообщении, чтобы открыть карточку.
              </p>
            ) : (
              <>
            <div className="flex flex-wrap items-center gap-1 mb-2">
              <ToolbarBtn
                title="Прикрепить файл"
                onClick={() => fileInputRef.current?.click()}
                icon={<Paperclip size={18} />}
              />
              <ToolbarBtn
                title="Привязать сущность"
                onClick={() => setActivePanel((v) => (v === 'entity' ? null : 'entity'))}
                icon={<Link2 size={18} />}
                active={activePanel === 'entity'}
              />
              <ToolbarBtn
                title="Создать сущность"
                onClick={() => setActivePanel((v) => (v === 'create' ? null : 'create'))}
                icon={<Plus size={18} />}
                active={activePanel === 'create'}
              />
              <ToolbarBtn
                title="Запустить бизнес-процесс"
                onClick={() => setActivePanel((v) => (v === 'process' ? null : 'process'))}
                icon={<GitBranch size={18} />}
                active={activePanel === 'process'}
              />
              {onOpenDocumentsModule && (
                <ToolbarBtn
                  title="Открыть модуль «Документы»"
                  onClick={() => onOpenDocumentsModule()}
                  icon={<FolderOpen size={18} />}
                />
              )}
            </div>

            <input ref={fileInputRef} type="file" className="hidden" onChange={onFileSelected} />

            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendText();
                  }
                }}
                placeholder="Сообщение…"
                rows={1}
                className="flex-1 min-w-0 min-h-[44px] max-h-[120px] resize-none px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#444] bg-white dark:bg-[#191919] text-gray-900 dark:text-gray-100 text-sm leading-relaxed shadow-inner focus:ring-2 focus:ring-[#3337AD]/30 focus:border-[#3337AD]/50 outline-none"
              />
              <button
                type="button"
                onClick={sendText}
                className="shrink-0 h-11 w-11 rounded-xl bg-[#3337AD] text-white hover:bg-[#292b8a] flex items-center justify-center shadow-md transition-colors"
                title="Отправить"
              >
                <Send size={18} />
              </button>
            </div>
              </>
            )}
          </div>
        </div>

        {activeId !== SYSTEM_FEED_UI && activePanel === 'entity' && (
          <ChatActionModal title="Привязать сущность" onClose={() => setActivePanel(null)}>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-[#333]">
              <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-[#444] overflow-hidden text-xs">
                {(['task', 'deal', 'meeting', 'doc'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEntityType(t)}
                    className={`px-2.5 py-1.5 ${entityType === t ? 'bg-[#3337AD] text-white' : 'bg-transparent text-gray-600 dark:text-gray-300'}`}
                  >
                    {t === 'task' ? 'Задачи' : t === 'deal' ? 'Сделки' : t === 'meeting' ? 'Встречи' : 'Документы'}
                  </button>
                ))}
              </div>
              <Search size={16} className="text-gray-400 shrink-0" />
              <input
                value={entitySearch}
                onChange={(e) => setEntitySearch(e.target.value)}
                placeholder="Поиск сущности…"
                className="flex-1 min-w-0 bg-transparent text-sm text-gray-900 dark:text-gray-100 outline-none placeholder:text-gray-400"
              />
            </div>
            <div className="max-h-72 overflow-y-auto custom-scrollbar p-1">
              {filteredEntities.length === 0 ? (
                <p className="text-xs text-gray-500 px-3 py-4 text-center">Ничего не найдено</p>
              ) : (
                filteredEntities.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => attachEntity(item.id, item.label)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-800 dark:text-gray-100 hover:bg-[#3337AD]/10"
                  >
                    <div className="truncate">{item.label}</div>
                    {item.subtitle ? <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.subtitle}</div> : null}
                  </button>
                ))
              )}
            </div>
          </ChatActionModal>
        )}

        {activeId !== SYSTEM_FEED_UI && activePanel === 'create' && (
          <ChatActionModal title="Создать и прикрепить" onClose={() => setActivePanel(null)}>
            <div className="p-3 space-y-3">
              <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-[#444] overflow-hidden text-xs">
                {(['task', 'deal', 'meeting', 'doc'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setCreateEntityType(t)}
                    className={`px-2.5 py-1.5 ${createEntityType === t ? 'bg-[#3337AD] text-white' : 'bg-transparent text-gray-600 dark:text-gray-300'}`}
                  >
                    {t === 'task' ? 'Задача' : t === 'deal' ? 'Сделка' : t === 'meeting' ? 'Встреча' : 'Документ'}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={createEntityTitle}
                  onChange={(e) => setCreateEntityTitle(e.target.value)}
                  placeholder="Название"
                  className="flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-[#444] bg-transparent px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={createAndAttachEntity}
                  className="px-3 py-2 rounded-lg bg-[#3337AD] text-white text-sm"
                >
                  Создать и прикрепить
                </button>
              </div>
            </div>
          </ChatActionModal>
        )}

        {activeId !== SYSTEM_FEED_UI && activePanel === 'process' && (
          <ChatActionModal title="Запуск бизнес-процесса" onClose={() => setActivePanel(null)}>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-[#333]">
              <Search size={16} className="text-gray-400 shrink-0" />
              <input
                value={processSearch}
                onChange={(e) => setProcessSearch(e.target.value)}
                placeholder="Поиск шаблона процесса…"
                className="flex-1 min-w-0 bg-transparent text-sm text-gray-900 dark:text-gray-100 outline-none placeholder:text-gray-400"
              />
            </div>
            <div className="max-h-72 overflow-y-auto custom-scrollbar p-1">
              {filteredProcessTemplates.length === 0 ? (
                <p className="text-xs text-gray-500 px-3 py-4 text-center">Нет шаблонов</p>
              ) : (
                filteredProcessTemplates.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => startFromTemplate(p.id, p.title || p.name || 'Бизнес-процесс')}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-800 dark:text-gray-100 hover:bg-[#3337AD]/10"
                  >
                    <div className="truncate">{p.title || p.name || 'Без названия'}</div>
                    {p.description ? <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{p.description}</div> : null}
                  </button>
                ))
              )}
            </div>
          </ChatActionModal>
        )}

        {selectedEntity && (
          <div className="hidden lg:flex w-72 border-l border-gray-200/80 dark:border-[#333] bg-white/70 dark:bg-[#1f1f1f]/85 p-3">
          <div className="w-full rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] p-3">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200 mb-2">
              <Info size={16} />
              <h4 className="font-semibold text-sm">Контекст</h4>
            </div>
            {selectedEntityInfo ? (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  {selectedEntity.type}
                </p>
                <h5 className="font-semibold text-sm text-gray-900 dark:text-white break-words">
                  {selectedEntityInfo.title}
                </h5>
                <p className="text-xs text-gray-500 dark:text-gray-400 break-words">
                  {selectedEntityInfo.subtitle}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 break-words">
                  {selectedEntityInfo.body}
                </p>
                <div className="pt-1">
                  {selectedEntity.type === 'deal' && onOpenDeals && (
                    <button
                      type="button"
                      onClick={onOpenDeals}
                      className="text-xs text-[#3337AD] hover:underline"
                    >
                      Открыть раздел сделок
                    </button>
                  )}
                  {selectedEntity.type === 'meeting' && onOpenMeetings && (
                    <button
                      type="button"
                      onClick={onOpenMeetings}
                      className="text-xs text-[#3337AD] hover:underline"
                    >
                      Открыть раздел встреч
                    </button>
                  )}
                  {(onOpenTask || onOpenDeal || onOpenMeeting || onOpenDocument || onOpenDeals || onOpenMeetings) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedEntity) return;
                        if (selectedEntity.type === 'task') {
                          const t = tasks.find((x) => x.id === selectedEntity.id);
                          if (t && onOpenTask) {
                            onOpenTask(t);
                            return;
                          }
                        } else if (selectedEntity.type === 'deal') {
                          const d = deals.find((x) => x.id === selectedEntity.id);
                          if (d && onOpenDeal) {
                            onOpenDeal(d);
                            return;
                          }
                          onOpenDeals?.();
                          return;
                        } else if (selectedEntity.type === 'meeting') {
                          const m = meetings.find((x) => x.id === selectedEntity.id);
                          if (m && onOpenMeeting) {
                            onOpenMeeting(m);
                            return;
                          }
                          onOpenMeetings?.();
                          return;
                        } else {
                          const d = docs.find((x) => x.id === selectedEntity.id);
                          if (d && onOpenDocument) {
                            onOpenDocument(d);
                            return;
                          }
                        }
                      }}
                      className="block text-xs text-[#3337AD] hover:underline mt-1"
                    >
                      Открыть карточку
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">Сущность не найдена (возможно, удалена).</p>
            )}
          </div>
          </div>
        )}
      </div>
    </div>
  );
};

function ToolbarBtn({
  title,
  onClick,
  icon,
  active,
}: {
  title: string;
  onClick: () => void;
  icon: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-2 rounded-lg transition-colors ${
        active
          ? 'bg-[#3337AD]/15 text-[#3337AD] dark:text-[#a8abf0]'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#333]'
      }`}
    >
      {icon}
    </button>
  );
}

function ChatActionModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[140] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1e1e1e] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-[#333]">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h4>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-[#333]"
            aria-label="Закрыть"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MessageBubble({
  m,
  users,
  currentUser,
  onOpenDocument,
  openLinkedDoc,
  onSelectEntity,
}: {
  m: ChatMessageLocal;
  users: User[];
  currentUser: User;
  onOpenDocument?: (doc: Doc) => void;
  openLinkedDoc: (id: string) => void;
  onSelectEntity: (type: 'task' | 'deal' | 'meeting' | 'doc', id: string) => void;
}) {
  const isMe = m.fromId === currentUser.id;
  const senderName = m.isSystem
    ? 'Система'
    : isMe
      ? 'Вы'
      : users.find((u) => u.id === m.fromId)?.name ?? m.fromId;

  return (
    <div className={`flex flex-col max-w-[92%] sm:max-w-[85%] ${isMe && !m.isSystem ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1 px-0.5">{senderName}</p>
      <div
        className={`rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
          m.isSystem
            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 border border-amber-200/60 dark:border-amber-800/50'
            : isMe
              ? 'bg-[#3337AD] text-white rounded-br-md'
              : 'bg-gray-100 dark:bg-[#333] text-gray-900 dark:text-gray-100 rounded-bl-md'
        }`}
      >
        {m.docId && m.docTitle && (
          <button
            type="button"
            onClick={() => m.docId && openLinkedDoc(m.docId)}
            disabled={!onOpenDocument}
            className={`mb-2 w-full text-left flex items-start gap-2 p-2 rounded-lg border disabled:opacity-60 ${
              isMe && !m.isSystem
                ? 'bg-white/15 border-white/25 hover:bg-white/20'
                : 'bg-white/60 dark:bg-[#2a2a2a] border-gray-200 dark:border-[#444] hover:bg-white dark:hover:bg-[#333]'
            }`}
          >
            <FileText size={18} className="shrink-0 mt-0.5 opacity-90" />
            <span>
              <span className="block text-xs font-semibold opacity-90">Документ</span>
              <span className="break-words">{m.docTitle}</span>
            </span>
          </button>
        )}
        {m.fileName && (
          <div className="mb-2">
            {m.fileDataUrl && m.fileMime?.startsWith('image/') ? (
              <img src={m.fileDataUrl} alt="" className="max-w-full max-h-48 rounded-lg border border-white/20" />
            ) : (
              <div
                className={`flex items-center gap-2 p-2 rounded-lg border ${
                  isMe && !m.isSystem
                    ? 'bg-white/15 border-white/25'
                    : 'bg-white/60 dark:bg-[#2a2a2a] border-gray-200 dark:border-[#444]'
                }`}
              >
                <Paperclip size={18} className="shrink-0 opacity-80" />
                <div className="min-w-0">
                  <div className="font-medium truncate">{m.fileName}</div>
                  {m.fileSize != null && (
                    <div className="text-[11px] opacity-80">{Math.round(m.fileSize / 1024)} КБ</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {m.text ? <p className="whitespace-pre-wrap break-words leading-relaxed">{m.text}</p> : null}
        {!m.docId && !m.fileName && m.entityType && m.entityId && (
          <button
            type="button"
            onClick={() => {
              if (m.entityType === 'task' || m.entityType === 'deal' || m.entityType === 'meeting' || m.entityType === 'doc') {
                onSelectEntity(m.entityType, m.entityId);
              }
            }}
            className={`mt-2 rounded-lg border px-2 py-1 text-xs ${
              isMe && !m.isSystem
                ? 'border-white/30 bg-white/15 hover:bg-white/20'
                : 'border-gray-200 dark:border-[#444] bg-white/60 dark:bg-[#2a2a2a] hover:bg-gray-50 dark:hover:bg-[#333]'
            }`}
          >
            {m.entityType.toUpperCase()} · открыть контекст
          </button>
        )}
      </div>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 px-0.5">
        {new Date(m.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  );
}
