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
  CheckSquare,
  GitBranch,
  Briefcase,
  Calendar,
  FolderOpen,
  X,
  Search,
} from 'lucide-react';
import { User, Doc } from '../../../types';
import { chatLocalService, ChatMessageLocal } from '../../../services/chatLocalService';

const TO_ALL_ID = '__all__';
const MAX_FILE_BYTES = 512 * 1024;

export interface MiniMessengerProps {
  users: User[];
  currentUser: User;
  onClose?: () => void;
  className?: string;
  /** Документы для выбора и вставки в чат */
  docs?: Doc[];
  /** Открыть документ (редактор / ссылка) */
  onOpenDocument?: (doc: Doc) => void;
  /** Перейти в модуль документов */
  onOpenDocumentsModule?: () => void;
  onCreateTask?: () => void;
  onStartProcess?: () => void;
  onOpenDeals?: () => void;
  onOpenMeetings?: () => void;
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
  onOpenDocument,
  onOpenDocumentsModule,
  onCreateTask,
  onStartProcess,
  onOpenDeals,
  onOpenMeetings,
}) => {
  const colleagues = useMemo(
    () => users.filter((u) => u.id !== currentUser.id && !u.isArchived),
    [users, currentUser.id]
  );
  const [activeId, setActiveId] = useState<string | null>(TO_ALL_ID);
  const [messages, setMessages] = useState<ChatMessageLocal[]>([]);
  const [input, setInput] = useState('');
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [docSearch, setDocSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const refresh = () => setMessages(chatLocalService.getMessagesForUser(currentUser.id));

  useEffect(() => {
    refresh();
  }, [currentUser.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeId]);

  const threadMessages = useMemo(() => {
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

  const filteredDocs = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    const list = (docs || []).filter((d) => !d.isArchived);
    if (!q) return list.slice(0, 80);
    return list.filter((d) => d.title.toLowerCase().includes(q)).slice(0, 80);
  }, [docs, docSearch]);

  const sendText = () => {
    const text = input.trim();
    if (!text || !activeId) return;
    chatLocalService.addMessage({
      fromId: currentUser.id,
      toId: activeId === TO_ALL_ID ? TO_ALL_ID : activeId,
      text,
    });
    refresh();
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const attachDoc = (doc: Doc) => {
    if (!activeId) return;
    chatLocalService.addMessage({
      fromId: currentUser.id,
      toId: activeId === TO_ALL_ID ? TO_ALL_ID : activeId,
      text: `📄 ${doc.title}`,
      entityType: 'doc',
      entityId: doc.id,
      docId: doc.id,
      docTitle: doc.title,
    });
    refresh();
    setDocPickerOpen(false);
    setDocSearch('');
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
      refresh();
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
      refresh();
    };
    reader.readAsDataURL(file);
  };

  const activeName =
    activeId === TO_ALL_ID ? 'Общий чат' : colleagues.find((u) => u.id === activeId)?.name ?? activeId;

  const openLinkedDoc = (docId: string) => {
    const doc = docs.find((d) => d.id === docId);
    if (doc && onOpenDocument) {
      onOpenDocument(doc);
      onClose?.();
    }
  };

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
                <img
                  src={u.avatar}
                  alt=""
                  className={`h-9 w-9 rounded-full object-cover shrink-0 ring-2 ${
                    activeId === u.id ? 'ring-white/40' : 'ring-gray-200 dark:ring-[#444]'
                  }`}
                />
                <span className="truncate font-medium">{u.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Лента и ввод */}
        <div className="flex-1 flex flex-col min-w-0 bg-white/40 dark:bg-[#222]/50">
          <div className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-4 py-3 space-y-3">
            {threadMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-[#333] flex items-center justify-center mb-3 text-gray-400">
                  <MessageCircle size={28} />
                </div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Нет сообщений</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
                  Напишите коллегам, прикрепите файл или документ из системы — панель действий под полем ввода.
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
                  />
                </React.Fragment>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Панель действий */}
          <div className="border-t border-gray-200/80 dark:border-[#333] bg-white/90 dark:bg-[#252525]/95 px-2 sm:px-3 pt-2 pb-3 shrink-0">
            <div className="flex flex-wrap items-center gap-1 mb-2">
              <ToolbarBtn
                title="Прикрепить файл"
                onClick={() => fileInputRef.current?.click()}
                icon={<Paperclip size={18} />}
              />
              <ToolbarBtn
                title="Документ из модуля"
                onClick={() => setDocPickerOpen((v) => !v)}
                icon={<FileText size={18} />}
                active={docPickerOpen}
              />
              {onOpenDocumentsModule && (
                <ToolbarBtn
                  title="Открыть модуль «Документы»"
                  onClick={() => onOpenDocumentsModule()}
                  icon={<FolderOpen size={18} />}
                />
              )}
              {onCreateTask && (
                <ToolbarBtn title="Создать задачу" onClick={() => onCreateTask()} icon={<CheckSquare size={18} />} />
              )}
              {onStartProcess && (
                <ToolbarBtn title="Запустить бизнес-процесс" onClick={() => onStartProcess()} icon={<GitBranch size={18} />} />
              )}
              {onOpenDeals && (
                <ToolbarBtn title="Сделки / CRM" onClick={() => onOpenDeals()} icon={<Briefcase size={18} />} />
              )}
              {onOpenMeetings && (
                <ToolbarBtn title="Встречи" onClick={() => onOpenMeetings()} icon={<Calendar size={18} />} />
              )}
            </div>

            <input ref={fileInputRef} type="file" className="hidden" onChange={onFileSelected} />

            {docPickerOpen && (
              <div className="mb-2 rounded-xl border border-gray-200 dark:border-[#444] bg-white dark:bg-[#1e1e1e] shadow-lg overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-[#333]">
                  <Search size={16} className="text-gray-400 shrink-0" />
                  <input
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    placeholder="Поиск документа…"
                    className="flex-1 min-w-0 bg-transparent text-sm text-gray-900 dark:text-gray-100 outline-none placeholder:text-gray-400"
                  />
                  <button
                    type="button"
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#333]"
                    onClick={() => setDocPickerOpen(false)}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                  {filteredDocs.length === 0 ? (
                    <p className="text-xs text-gray-500 px-3 py-4 text-center">Нет документов</p>
                  ) : (
                    filteredDocs.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => attachDoc(d)}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-800 dark:text-gray-100 hover:bg-[#3337AD]/10 flex items-center gap-2"
                      >
                        <FileText size={16} className="text-[#3337AD] shrink-0" />
                        <span className="truncate">{d.title}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

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
          </div>
        </div>
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

function MessageBubble({
  m,
  users,
  currentUser,
  onOpenDocument,
  openLinkedDoc,
}: {
  m: ChatMessageLocal;
  users: User[];
  currentUser: User;
  onOpenDocument?: (doc: Doc) => void;
  openLinkedDoc: (id: string) => void;
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
      </div>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 px-0.5">
        {new Date(m.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  );
}
