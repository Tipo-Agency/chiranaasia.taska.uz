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
} from 'lucide-react';
import { User, Doc, Task, Deal, Meeting, BusinessProcess } from '../../../types';
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
  tasks?: Task[];
  deals?: Deal[];
  meetings?: Meeting[];
  /** Открыть документ (редактор / ссылка) */
  onOpenDocument?: (doc: Doc) => void;
  /** Перейти в модуль документов */
  onOpenDocumentsModule?: () => void;
  onOpenDeals?: () => void;
  onOpenMeetings?: () => void;
  onCreateEntity?: (type: 'task' | 'deal' | 'meeting' | 'doc', title: string) => Promise<{ id: string; label: string } | null> | { id: string; label: string } | null;
  onUpdateEntity?: (
    type: 'task' | 'deal' | 'meeting' | 'doc',
    id: string,
    patch: Record<string, unknown>
  ) => Promise<boolean> | boolean;
  processTemplates?: BusinessProcess[];
  onStartProcessTemplate?: (processId: string) => Promise<{ id: string; label: string } | null> | { id: string; label: string } | null;
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
  onCreateEntity,
  onUpdateEntity,
  processTemplates = [],
  onStartProcessTemplate,
}) => {
  const colleagues = useMemo(
    () => users.filter((u) => u.id !== currentUser.id && !u.isArchived),
    [users, currentUser.id]
  );
  const [activeId, setActiveId] = useState<string | null>(TO_ALL_ID);
  const [messages, setMessages] = useState<ChatMessageLocal[]>([]);
  const [input, setInput] = useState('');
  const [activePanel, setActivePanel] = useState<null | 'entity' | 'create' | 'process'>(null);
  const [entityType, setEntityType] = useState<'task' | 'deal' | 'meeting' | 'doc'>('task');
  const [entitySearch, setEntitySearch] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<{ type: 'task' | 'deal' | 'meeting' | 'doc'; id: string } | null>(null);
  const [createEntityType, setCreateEntityType] = useState<'task' | 'deal' | 'meeting' | 'doc'>('task');
  const [createEntityTitle, setCreateEntityTitle] = useState('');
  const [processSearch, setProcessSearch] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSecondaryA, setEditSecondaryA] = useState('');
  const [editSecondaryB, setEditSecondaryB] = useState('');
  const [editMeetingDate, setEditMeetingDate] = useState('');
  const [editMeetingTime, setEditMeetingTime] = useState('');
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

  useEffect(() => {
    if (!editModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editModalOpen]);

  const canSaveEdit = useMemo(() => {
    if (!selectedEntity) return false;
    const titleOk = editTitle.trim().length > 0;
    if (!titleOk) return false;
    if (selectedEntity.type === 'meeting') {
      return editMeetingDate.trim().length > 0 && editMeetingTime.trim().length > 0;
    }
    if (selectedEntity.type === 'task') return editSecondaryA.trim().length > 0;
    if (selectedEntity.type === 'deal') return editSecondaryA.trim().length > 0;
    if (selectedEntity.type === 'doc') return editSecondaryA.trim().length > 0;
    return true;
  }, [selectedEntity, editTitle, editSecondaryA, editSecondaryB, editMeetingDate, editMeetingTime]);

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
    const list = (processTemplates || []).filter((p) => !p.isArchived);
    if (!q) return list.slice(0, 80);
    return list.filter((p) => (p.title || '').toLowerCase().includes(q)).slice(0, 80);
  }, [processTemplates, processSearch]);

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

  const attachEntity = (id: string, label: string) => {
    if (!activeId) return;
    chatLocalService.addMessage({
      fromId: currentUser.id,
      toId: activeId === TO_ALL_ID ? TO_ALL_ID : activeId,
      text: `🔗 ${label}`,
      entityType,
      entityId: id,
    });
    refresh();
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
    refresh();
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
    refresh();
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
                    onSelectEntity={(type, id) => setSelectedEntity({ type, id })}
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

            {activePanel === 'entity' && (
              <div className="mb-2 rounded-xl border border-gray-200 dark:border-[#444] bg-white dark:bg-[#1e1e1e] shadow-lg overflow-hidden">
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
                  <button
                    type="button"
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#333]"
                    onClick={() => setActivePanel(null)}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="max-h-52 overflow-y-auto custom-scrollbar p-1">
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
              </div>
            )}

            {activePanel === 'create' && (
              <div className="mb-2 rounded-xl border border-gray-200 dark:border-[#444] bg-white dark:bg-[#1e1e1e] shadow-lg overflow-hidden p-3">
                <div className="flex items-center gap-2 mb-2">
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
                  <button
                    type="button"
                    className="ml-auto p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#333]"
                    onClick={() => setActivePanel(null)}
                  >
                    <X size={16} />
                  </button>
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
            )}

            {activePanel === 'process' && (
              <div className="mb-2 rounded-xl border border-gray-200 dark:border-[#444] bg-white dark:bg-[#1e1e1e] shadow-lg overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-[#333]">
                  <Search size={16} className="text-gray-400 shrink-0" />
                  <input
                    value={processSearch}
                    onChange={(e) => setProcessSearch(e.target.value)}
                    placeholder="Поиск шаблона процесса…"
                    className="flex-1 min-w-0 bg-transparent text-sm text-gray-900 dark:text-gray-100 outline-none placeholder:text-gray-400"
                  />
                  <button
                    type="button"
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#333]"
                    onClick={() => setActivePanel(null)}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="max-h-52 overflow-y-auto custom-scrollbar p-1">
                  {filteredProcessTemplates.length === 0 ? (
                    <p className="text-xs text-gray-500 px-3 py-4 text-center">Нет шаблонов</p>
                  ) : (
                    filteredProcessTemplates.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => startFromTemplate(p.id, p.title)}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-800 dark:text-gray-100 hover:bg-[#3337AD]/10"
                      >
                        <div className="truncate">{p.title}</div>
                        {p.description ? <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{p.description}</div> : null}
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
                  {onUpdateEntity && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedEntity) return;
                        if (selectedEntity.type === 'task') {
                          const t = tasks.find((x) => x.id === selectedEntity.id);
                          setEditTitle(t?.title || '');
                          setEditSecondaryA((t as any)?.status || '');
                          setEditSecondaryB((t as any)?.description || '');
                          setEditMeetingDate('');
                          setEditMeetingTime('');
                        } else if (selectedEntity.type === 'deal') {
                          const d = deals.find((x) => x.id === selectedEntity.id);
                          setEditTitle(d?.title || '');
                          setEditSecondaryA((d as any)?.stage || '');
                          setEditSecondaryB(String((d as any)?.amount || ''));
                          setEditMeetingDate('');
                          setEditMeetingTime('');
                        } else if (selectedEntity.type === 'meeting') {
                          const m = meetings.find((x) => x.id === selectedEntity.id);
                          setEditTitle(m?.title || '');
                          setEditMeetingDate(m?.date || '');
                          setEditMeetingTime(m?.time || '');
                          setEditSecondaryA('');
                          setEditSecondaryB((m as any)?.summary || '');
                        } else {
                          const d = docs.find((x) => x.id === selectedEntity.id);
                          setEditTitle(d?.title || '');
                          setEditSecondaryA((d as any)?.type || 'internal');
                          setEditSecondaryB((d as any)?.content || '');
                          setEditMeetingDate('');
                          setEditMeetingTime('');
                        }
                        setEditModalOpen(true);
                      }}
                      className="block text-xs text-[#3337AD] hover:underline mt-1"
                    >
                      Открыть модалку редактирования
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
      {editModalOpen && selectedEntity && onUpdateEntity && (
        <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditModalOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] p-4" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Редактирование сущности</h4>
            <div className="space-y-2">
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Название" className="w-full rounded-lg border border-gray-300 dark:border-[#444] bg-transparent px-3 py-2 text-sm" />
              {selectedEntity.type === 'task' && (
                <>
                  <input value={editSecondaryA} onChange={(e) => setEditSecondaryA(e.target.value)} placeholder="Статус" className="w-full rounded-lg border border-gray-300 dark:border-[#444] bg-transparent px-3 py-2 text-sm" />
                  <textarea value={editSecondaryB} onChange={(e) => setEditSecondaryB(e.target.value)} placeholder="Описание" className="w-full rounded-lg border border-gray-300 dark:border-[#444] bg-transparent px-3 py-2 text-sm min-h-[84px]" />
                </>
              )}

              {selectedEntity.type === 'deal' && (
                <>
                  <input value={editSecondaryA} onChange={(e) => setEditSecondaryA(e.target.value)} placeholder="Этап" className="w-full rounded-lg border border-gray-300 dark:border-[#444] bg-transparent px-3 py-2 text-sm" />
                  <input
                    value={editSecondaryB}
                    onChange={(e) => setEditSecondaryB(e.target.value)}
                    type="number"
                    step="1"
                    placeholder="Сумма"
                    className="w-full rounded-lg border border-gray-300 dark:border-[#444] bg-transparent px-3 py-2 text-sm"
                  />
                </>
              )}

              {selectedEntity.type === 'meeting' && (
                <>
                  <div className="flex gap-2">
                    <input
                      value={editMeetingDate}
                      onChange={(e) => setEditMeetingDate(e.target.value)}
                      type="date"
                      className="flex-1 rounded-lg border border-gray-300 dark:border-[#444] bg-transparent px-3 py-2 text-sm"
                    />
                    <input
                      value={editMeetingTime}
                      onChange={(e) => setEditMeetingTime(e.target.value)}
                      type="time"
                      step={60}
                      className="flex-1 rounded-lg border border-gray-300 dark:border-[#444] bg-transparent px-3 py-2 text-sm"
                    />
                  </div>
                  <textarea value={editSecondaryB} onChange={(e) => setEditSecondaryB(e.target.value)} placeholder="Описание встречи" className="w-full rounded-lg border border-gray-300 dark:border-[#444] bg-transparent px-3 py-2 text-sm min-h-[84px]" />
                </>
              )}

              {selectedEntity.type === 'doc' && (
                <>
                  <input value={editSecondaryA} onChange={(e) => setEditSecondaryA(e.target.value)} placeholder="Тип (internal/link)" className="w-full rounded-lg border border-gray-300 dark:border-[#444] bg-transparent px-3 py-2 text-sm" />
                  <textarea value={editSecondaryB} onChange={(e) => setEditSecondaryB(e.target.value)} placeholder="Content (для internal)" className="w-full rounded-lg border border-gray-300 dark:border-[#444] bg-transparent px-3 py-2 text-sm min-h-[84px]" />
                </>
              )}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setEditModalOpen(false)} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-[#444] text-sm">Отмена</button>
              <button
                type="button"
                onClick={async () => {
                  const patch: Record<string, unknown> = { title: editTitle };
                  if (selectedEntity.type === 'task') {
                    patch.status = editSecondaryA;
                    patch.description = editSecondaryB;
                  } else if (selectedEntity.type === 'deal') {
                    patch.stage = editSecondaryA;
                    patch.amount = Number(editSecondaryB || '0') || 0;
                  } else if (selectedEntity.type === 'meeting') {
                    patch.date = editMeetingDate;
                    patch.time = editMeetingTime;
                    patch.summary = editSecondaryB;
                  } else {
                    patch.type = editSecondaryA || 'internal';
                    if (editSecondaryB) patch.content = editSecondaryB;
                  }
                  await onUpdateEntity(selectedEntity.type, selectedEntity.id, patch);
                  setEditModalOpen(false);
                }}
                disabled={!canSaveEdit}
                className={`px-3 py-2 rounded-lg bg-[#3337AD] text-white text-sm ${!canSaveEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
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
