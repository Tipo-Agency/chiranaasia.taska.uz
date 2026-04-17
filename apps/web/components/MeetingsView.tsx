
import React, { useState, useMemo, useCallback, useLayoutEffect } from 'react';
import { Meeting, User, TableCollection, Client, Deal, Project, NotificationPreferences, ShootPlan, ContentPost, ShootPlanItem } from '../types';
import {
  Camera,
  X,
  Check,
  Briefcase,
  Building2,
  Clapperboard,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import {
  normalizeDateForInput,
  compareDates,
  getTodayLocalDate,
  normalizeWallClockTimeForApi,
  isWallClockStartInPastBeforeNow,
  wallClockStartKey,
} from '../utils/dateUtils';
import { ModulePageShell, MODULE_PAGE_GUTTER, SystemConfirmDialog, APP_TOOLBAR_MODULE_CLUSTER, EntitySearchSelect } from './ui';
import { ModuleCreateDropdown } from './ui/ModuleCreateDropdown';
import { ModuleSelectDropdown } from './ui/ModuleSelectDropdown';
import { useAppToolbar } from '../contexts/AppToolbarContext';
import { DateInput } from './ui/DateInput';
import { ShootPlanModal, type ShootPostFormatFilter } from './ShootPlanModal';
import { getPostIdsReservedInOtherShootPlans } from '../utils/shootPlanUtils';

interface MeetingsViewProps {
  meetings: Meeting[];
  users: User[];
  projects?: Project[];
  clients?: Client[];
  deals?: Deal[];
  tableId: string;
  showAll?: boolean; // Aggregator mode
  tables?: TableCollection[];
  onSaveMeeting: (meeting: Meeting) => void;
  onDeleteMeeting?: (meetingId: string) => void;
  onUpdateSummary: (meetingId: string, summary: string) => void;
  /** Цвета карточек из настроек уведомлений */
  notificationPrefs?: NotificationPreferences;
  shootPlans?: ShootPlan[];
  contentPosts?: ContentPost[];
  onSaveShootPlan?: (plan: ShootPlan) => void;
  /** Вкладка рабочего стола — без второго gutter и без вложенного скролла */
  embedInWorkdesk?: boolean;
}

const DEFAULT_CAL_COLORS = {
  // спокойные оттенки (используются в бордере слева, не как заливка)
  client: '#38bdf8',
  work: '#a78bfa',
  project: '#34d399',
  shoot: '#fb923c',
};

/** Как на бэкенде в shoot_plans: встречи общего календаря, CRM, чата, съёмок. */
const GLOBAL_MEETINGS_TABLE_ID = 'meetings-system';

function meetingVisibleForCalendarPage(m: Meeting, pageTableId: string, showAll: boolean): boolean {
  if (showAll) return true;
  if (m.tableId === pageTableId) return true;
  if (!m.tableId || m.tableId === GLOBAL_MEETINGS_TABLE_ID) return true;
  return false;
}

function meetingTypeKey(m: Meeting): 'client' | 'work' | 'project' | 'shoot' {
  if (m.shootPlanId || m.type === 'shoot') return 'shoot';
  if (m.projectId) return 'project';
  if (m.type === 'client') return 'client';
  return 'work';
}

const MeetingsView: React.FC<MeetingsViewProps> = ({
  meetings = [],
  users,
  projects = [],
  clients = [],
  deals = [],
  tableId,
  showAll = false,
  tables = [],
  onSaveMeeting,
  onDeleteMeeting,
  onUpdateSummary,
  notificationPrefs,
  shootPlans = [],
  contentPosts = [],
  onSaveShootPlan,
  embedInWorkdesk = false,
}) => {
  const { setModule } = useAppToolbar();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [meetingTypeLocked, setMeetingTypeLocked] = useState(false);
  const [meetingTypeFilter, setMeetingTypeFilter] = useState<'all' | 'client' | 'work' | 'project' | 'shoot'>('all');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const t = new Date();
    return { month: t.getMonth(), year: t.getFullYear() };
  });
  const [meetingDeleteConfirmOpen, setMeetingDeleteConfirmOpen] = useState(false);
  
  // Form State
  const [meetingType, setMeetingType] = useState<'client' | 'work' | 'project'>('work'); // shoot только из планов съёмок
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(getTodayLocalDate());
  const [time, setTime] = useState('10:00');
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [selectedDealId, setSelectedDealId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  const emptyShootItem = useCallback((): ShootPlanItem => ({
    postId: '',
    brief: '',
    referenceUrl: '',
    referenceImages: [],
  }), []);

  const [shootModalDraft, setShootModalDraft] = useState<ShootPlan | null>(null);
  const [shootPostFormatFilter, setShootPostFormatFilter] = useState<ShootPostFormatFilter>('all');
  const [pickEventKindOpen, setPickEventKindOpen] = useState(false);
  const [pickEventKindDate, setPickEventKindDate] = useState('');

  // DnD State
  const [draggedMeetingId, setDraggedMeetingId] = useState<string | null>(null);

  React.useEffect(() => {
    const handleOpenMeetingById = (event: Event) => {
      const custom = event as CustomEvent<{ meetingId?: string }>;
      const meetingId = custom.detail?.meetingId;
      if (!meetingId) return;
      const target = meetings.find((m) => m.id === meetingId && !m.isArchived);
      if (!target) return;
      handleOpenEdit(target);
    };
    window.addEventListener('openMeetingFromChat', handleOpenMeetingById as EventListener);
    return () => window.removeEventListener('openMeetingFromChat', handleOpenMeetingById as EventListener);
  }, [meetings]);

  const calColors = useMemo(() => {
    const c = notificationPrefs?.calendarColors || {};
    return { ...DEFAULT_CAL_COLORS, ...c };
  }, [notificationPrefs]);

  const getTypeColor = (m: Meeting) => calColors[meetingTypeKey(m)];

  const filteredMeetings = useMemo(() => {
    let filtered = (meetings || [])
      .filter(m => !m.isArchived) // Исключаем архивные встречи
      .filter((m) => meetingVisibleForCalendarPage(m, tableId, !!showAll))
      .map((m) => {
        let inferred: Meeting['type'];
        if (m.shootPlanId || m.type === 'shoot') inferred = 'shoot';
        else if (m.projectId) inferred = 'project';
        else inferred = (m.type || 'work') as Meeting['type'];
        return { ...m, type: inferred };
      });
    
    if (meetingTypeFilter !== 'all') {
      filtered = filtered.filter(m => m.type === meetingTypeFilter);
    }
    
    return filtered.sort((a, b) => {
      const ak = normalizeDateForInput(a.date);
      const bk = normalizeDateForInput(b.date);
      if (!ak && !bk) return 0;
      if (!ak) return 1;
      if (!bk) return -1;
      const dc = compareDates(ak, bk);
      if (dc !== 0) return -dc;
      return (a.time || '00:00').localeCompare(b.time || '00:00');
    });
  }, [meetings, tableId, showAll, meetingTypeFilter]);

  const contentPlanTables = useMemo(
    () => tables.filter((t) => t.type === 'content-plan' && !t.isArchived),
    [tables]
  );

  const contentPlanOptions = useMemo(
    () => contentPlanTables.map((t) => ({ id: t.id, name: t.name })),
    [contentPlanTables]
  );

  const defaultShootTableId = useMemo(() => {
    const activeIsCp = tables.find((t) => t.id === tableId)?.type === 'content-plan';
    if (!showAll && activeIsCp) return tableId;
    if (contentPlanTables.length === 1) return contentPlanTables[0].id;
    return contentPlanTables[0]?.id || '';
  }, [showAll, tableId, tables, contentPlanTables]);

  const reservedForShootModal = useMemo(
    () =>
      shootModalDraft
        ? getPostIdsReservedInOtherShootPlans(shootPlans, shootModalDraft.tableId, shootModalDraft.id)
        : new Set<string>(),
    [shootPlans, shootModalDraft]
  );

  const openMeetingCreate = useCallback((type: 'client' | 'work' | 'project', presetDate?: string) => {
    setEditingMeeting(null);
    setMeetingType(type);
    setMeetingTypeLocked(true);
    setTitle('');
    setDate(presetDate || getTodayLocalDate());
    setTime('10:00');
    setRecurrence('none');
    setSelectedDealId('');
    setSelectedProjectId('');
    setSelectedParticipants([]);
    setIsModalOpen(true);
  }, []);

  const openNewShootPlan = useCallback(
    (presetDate: string) => {
      if (!onSaveShootPlan) {
        alert('Сохранение плана съёмки недоступно.');
        return;
      }
      const tid = defaultShootTableId;
      if (!tid) {
        alert('Нет контент-плана. Создайте страницу «Контент-план» в пространстве проекта.');
        return;
      }
      const id = `sp-${Date.now()}`;
      setShootModalDraft({
        id,
        tableId: tid,
        title: 'Съёмка',
        date: presetDate,
        time: '10:00',
        participantIds: [],
        items: [emptyShootItem()],
      });
      setShootPostFormatFilter('all');
    },
    [onSaveShootPlan, defaultShootTableId, emptyShootItem]
  );

  React.useEffect(() => {
    const handleOpenCreateMeeting = (event: Event) => {
      const custom = event as CustomEvent<{ type?: 'client' | 'work' | 'project'; date?: string }>;
      openMeetingCreate(custom.detail?.type || 'work', custom.detail?.date || getTodayLocalDate());
    };
    window.addEventListener('openCreateMeetingModal', handleOpenCreateMeeting as EventListener);
    return () => window.removeEventListener('openCreateMeetingModal', handleOpenCreateMeeting as EventListener);
  }, [openMeetingCreate]);

  /** С рабочего стола: сначала выбор типа события (команда / клиент / проект / съёмка) */
  React.useEffect(() => {
    const handleOpenKindPicker = (event: Event) => {
      const custom = event as CustomEvent<{ date?: string }>;
      setPickEventKindDate(custom.detail?.date || getTodayLocalDate());
      setPickEventKindOpen(true);
    };
    window.addEventListener('openMeetingKindPickerModal', handleOpenKindPicker as EventListener);
    return () => window.removeEventListener('openMeetingKindPickerModal', handleOpenKindPicker as EventListener);
  }, []);

  const saveShootFromCalendar = () => {
    if (!shootModalDraft || !onSaveShootPlan) return;
    if (!shootModalDraft.title.trim()) {
      alert('Укажите название плана');
      return;
    }
    const cleaned: ShootPlan = {
      ...shootModalDraft,
      items: (shootModalDraft.items || [])
        .filter((it) => it.postId)
        .map((it) => ({
          ...it,
          referenceImages: (it.referenceImages || []).filter(Boolean),
        })),
    };
    if (cleaned.items.length === 0) {
      alert('Добавьте хотя бы один пост из контент-плана');
      return;
    }
    onSaveShootPlan(cleaned);
    setShootModalDraft(null);
  };

  const closeMeetingModal = () => {
    setIsModalOpen(false);
    setMeetingDeleteConfirmOpen(false);
    setEditingMeeting(null);
    setMeetingTypeLocked(false);
    setTitle('');
    setSelectedParticipants([]);
    setSelectedDealId('');
    setSelectedProjectId('');
    setRecurrence('none');
    setMeetingType('work');
  };

  const openCreateFlowForDate = (dateStr: string) => {
    setPickEventKindDate(dateStr);
    setPickEventKindOpen(true);
  };

  const handleOpenEdit = (meeting: Meeting) => {
      if (meetingTypeKey(meeting) === 'shoot' || meeting.shootPlanId) {
        const sid = meeting.shootPlanId || '';
        const plan = sid ? shootPlans.find((p) => p.id === sid && !p.isArchived) : undefined;
        if (!plan) {
          alert('План съёмки не найден.');
          return;
        }
        if (!onSaveShootPlan) {
          alert('Редактирование плана съёмки недоступно.');
          return;
        }
        setShootModalDraft({
          ...plan,
          items: plan.items?.length ? [...plan.items] : [emptyShootItem()],
        });
        setShootPostFormatFilter('all');
        return;
      }
      setEditingMeeting(meeting);
      const inferred: Meeting['type'] = meeting.projectId ? 'project' : (meeting.type || 'work');
      setMeetingType(inferred);
      setTitle(meeting.title);
      setDate(normalizeDateForInput(meeting.date) || getTodayLocalDate());
      setTime(meeting.time);
      setRecurrence(meeting.recurrence || 'none');
      setSelectedDealId(meeting.dealId || '');
      setSelectedProjectId(meeting.projectId || '');
      setSelectedParticipants(meeting.participantIds || []);
      setMeetingTypeLocked(false);
      setIsModalOpen(true);
  };

  const handleCreate = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      // Закрываем нативные popover (date/time picker), чтобы они не блокировали submit.
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      
      // Валидация для встреч с клиентами
      if (meetingType === 'client' && !selectedDealId) {
          alert('Выберите сделку для встречи');
          return;
      }
      if (meetingType === 'project' && !selectedProjectId) {
          alert('Выберите проект');
          return;
      }
      
      // Получаем clientId из сделки, если выбрана сделка
      const selectedDeal = deals.find(d => d.id === selectedDealId);
      const clientIdFromDeal = selectedDeal?.clientId;
      
      const dateNorm = normalizeDateForInput(date) || date || getTodayLocalDate();
      const dateFinal = /^\d{4}-\d{2}-\d{2}$/.test(dateNorm) ? dateNorm : getTodayLocalDate();
      const timeFinal = normalizeWallClockTimeForApi(time);

      const prevKey = editingMeeting
        ? wallClockStartKey(
            normalizeDateForInput(editingMeeting.date) || editingMeeting.date || '',
            editingMeeting.time
          )
        : null;
      const nextKey = wallClockStartKey(dateFinal, timeFinal);
      if (
        isWallClockStartInPastBeforeNow(dateFinal, timeFinal) &&
        (!editingMeeting || prevKey !== nextKey)
      ) {
        alert('Время начала встречи не может быть в прошлом');
        return;
      }

      if (editingMeeting) {
          // Редактирование существующей встречи
          onSaveMeeting({
              ...editingMeeting,
              type: meetingType,
              title,
              date: dateFinal,
              time: timeFinal,
              recurrence: meetingType === 'work' ? recurrence : 'none', // Повторение только для рабочих встреч
              dealId: meetingType === 'client' ? selectedDealId : undefined,
              clientId: meetingType === 'client' ? clientIdFromDeal : undefined,
              projectId: meetingType === 'project' ? selectedProjectId : undefined,
              participantIds: selectedParticipants
          });
      } else {
          // Создание новой встречи
          const newMeeting: Meeting = {
              id: `m-${Date.now()}`,
              tableId,
              type: meetingType,
              title,
              date: dateFinal,
              time: timeFinal,
              recurrence: meetingType === 'work' ? recurrence : 'none',
              dealId: meetingType === 'client' ? selectedDealId : undefined,
              clientId: meetingType === 'client' ? clientIdFromDeal : undefined,
              projectId: meetingType === 'project' ? selectedProjectId : undefined,
              participantIds: selectedParticipants,
              summary: '',
              isArchived: false
          };
          onSaveMeeting(newMeeting);
      }
      closeMeetingModal();
  };

  const toggleParticipant = (userId: string) => {
      if (selectedParticipants.includes(userId)) {
          setSelectedParticipants(selectedParticipants.filter(id => id !== userId));
      } else {
          setSelectedParticipants([...selectedParticipants, userId]);
      }
  };

  const onDragStart = (e: React.DragEvent, meetingId: string) => {
      setDraggedMeetingId(meetingId);
      e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent) => {
      e.preventDefault();
  };

  const onDrop = (e: React.DragEvent, targetDate: string) => {
      e.preventDefault();
      if (draggedMeetingId) {
          const meeting = meetings.find(m => m.id === draggedMeetingId);
          if (meeting && meeting.date !== targetDate) {
              const dNorm = normalizeDateForInput(targetDate) || targetDate || getTodayLocalDate();
              const dFinal = /^\d{4}-\d{2}-\d{2}$/.test(dNorm) ? dNorm : getTodayLocalDate();
              const tFinal = normalizeWallClockTimeForApi(meeting.time);
              if (isWallClockStartInPastBeforeNow(dFinal, tFinal)) {
                alert('Нельзя перенести встречу на дату и время в прошлом');
                setDraggedMeetingId(null);
                return;
              }
              onSaveMeeting({ ...meeting, date: dFinal });
          }
          setDraggedMeetingId(null);
      }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) closeMeetingModal();
  };

  const goCalendarToday = () => {
    const t = new Date();
    setCalendarMonth({ month: t.getMonth(), year: t.getFullYear() });
  };

  const shiftCalendarMonth = (delta: number) => {
    setCalendarMonth((prev) => {
      let m = prev.month + delta;
      let y = prev.year;
      while (m < 0) {
        m += 12;
        y -= 1;
      }
      while (m > 11) {
        m -= 12;
        y += 1;
      }
      return { month: m, year: y };
    });
  };

  const renderCalendar = () => {
      const currentMonth = calendarMonth.month;
      const currentYear = calendarMonth.year;
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const firstDay = new Date(currentYear, currentMonth, 1).getDay();
      
      const startOffset = firstDay === 0 ? 6 : firstDay - 1; 

      const days = [];
      for (let i = 0; i < startOffset; i++) days.push(null);
      for (let i = 1; i <= daysInMonth; i++) days.push(i);

      const monthLabel = new Date(currentYear, currentMonth, 1).toLocaleString('ru-RU', { month: 'long', year: 'numeric' });

      return (
          <div className="rounded-xl border border-gray-200 dark:border-[#3f3f3f] bg-white dark:bg-[#323232] shadow-sm overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-3 border-b border-gray-200/80 dark:border-[#3f3f3f] bg-gray-50/90 dark:bg-[#2c2c2c] px-4 sm:px-5 py-3 sm:py-4">
                  <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => shiftCalendarMonth(-1)}
                      className="p-2 rounded-xl border border-gray-200 dark:border-[#454545] bg-white dark:bg-[#383838] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#444444] transition-colors shrink-0"
                      title="Предыдущий месяц"
                      aria-label="Предыдущий месяц"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <div className="flex items-center gap-2 min-w-0 flex-1 justify-center sm:justify-start">
                      <CalendarDays className="text-gray-500 dark:text-gray-400 shrink-0 hidden sm:block" size={22} />
                      <span className="capitalize font-semibold text-gray-900 dark:text-white text-base truncate text-center sm:text-left">
                        {monthLabel}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => shiftCalendarMonth(1)}
                      className="p-2 rounded-xl border border-gray-200 dark:border-[#454545] bg-white dark:bg-[#383838] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#444444] transition-colors shrink-0"
                      title="Следующий месяц"
                      aria-label="Следующий месяц"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                  <div className="flex items-center justify-center sm:justify-end gap-2">
                    <button
                      type="button"
                      onClick={goCalendarToday}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 shadow-sm"
                    >
                      Сегодня
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-600 dark:text-gray-400 text-center sm:text-right w-full sm:w-auto sm:max-w-[220px]">Перетащите карточку на другой день, чтобы перенести</p>
              </div>
              <div className="grid grid-cols-7 border-b border-gray-200 dark:border-[#3f3f3f] bg-gray-50 dark:bg-[#2c2c2c]">
                  {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
                      <div key={d} className="p-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{d}</div>
                  ))}
              </div>
              <div className="grid grid-cols-7 bg-white dark:bg-[#303030]">
                  {days.map((day, idx) => {
                      let dateStr = '';
                      if (day) {
                          const mm = String(currentMonth + 1).padStart(2, '0');
                          const dd = String(day).padStart(2, '0');
                          dateStr = `${currentYear}-${mm}-${dd}`;
                      }

                      const dayMeetings = day
                        ? filteredMeetings
                            .filter((m) => normalizeDateForInput(m.date) === dateStr)
                            .sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'))
                        : [];
                      
                      const isToday =
                        day &&
                        new Date().toDateString() === new Date(currentYear, currentMonth, day).toDateString();

                      return (
                        <div 
                            key={idx} 
                            role={day ? 'button' : undefined}
                            tabIndex={day ? 0 : undefined}
                            onKeyDown={
                              day
                                ? (e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      openCreateFlowForDate(dateStr);
                                    }
                                  }
                                : undefined
                            }
                            className={`min-h-[128px] border-r border-b border-gray-100 dark:border-[#3a3a3a] p-1.5 transition-colors ${!day ? 'bg-gray-50/40 dark:bg-[#2e2e2e]' : 'hover:bg-gray-50/70 dark:hover:bg-[#3a3a3a] cursor-pointer'}`}
                            onDragOver={day ? onDragOver : undefined}
                            onDrop={day ? (e) => onDrop(e, dateStr) : undefined}
                            onClick={day ? () => openCreateFlowForDate(dateStr) : undefined}
                        >
                            {day && (
                                <>
                                    <div className={`text-right text-xs font-bold mb-1 px-0.5 ${isToday ? 'text-slate-700 dark:text-slate-200' : 'text-gray-500 dark:text-gray-500'}`}>
                                      {isToday ? (
                                        <span className="inline-flex items-center justify-end gap-1">
                                          <span className="rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-1.5 py-0.5 text-[10px]">{day}</span>
                                        </span>
                                      ) : (
                                        day
                                      )}
                                    </div>
                                    <div className="space-y-1.5">
                                        {dayMeetings.map(m => {
                                          const pCount = (m.participantIds || []).length;
                                          const typeShort =
                                            m.type === 'client'
                                              ? 'Клиент'
                                              : m.type === 'project'
                                                ? 'Проект'
                                                : m.type === 'shoot'
                                                  ? 'Съёмка'
                                                  : 'Команда';
                                          return (
                                            <div 
                                                key={m.id} 
                                                draggable
                                                onDragStart={(e) => onDragStart(e, m.id)}
                                                onClick={(e) => { e.stopPropagation(); handleOpenEdit(m); }}
                                                className="bg-white dark:bg-[#383838] text-gray-900 dark:text-gray-100 px-2 py-1.5 rounded-xl border border-gray-200/90 dark:border-[#484848] cursor-pointer shadow-sm hover:border-gray-300 dark:hover:border-[#555] hover:shadow transition-all" 
                                                style={{ borderLeftWidth: 3, borderLeftColor: getTypeColor(m) }}
                                                title={`${m.time} — ${m.title}`}
                                            >
                                                <div className="text-[11px] font-bold text-gray-700 dark:text-gray-200 tabular-nums">{m.time}</div>
                                                <div className="text-[11px] font-semibold leading-snug line-clamp-2 mt-0.5">{m.title}</div>
                                                <div className="flex flex-wrap items-center gap-1 mt-1">
                                                  <span className="text-[9px] uppercase tracking-wide font-semibold px-1 py-0.5 rounded bg-gray-100 dark:bg-[#2f2f2f] text-gray-700 dark:text-gray-200">{typeShort}</span>
                                                  {pCount > 0 && (
                                                    <span className="text-[9px] text-gray-600 dark:text-gray-400">{pCount} уч.</span>
                                                  )}
                                                </div>
                                            </div>
                                          );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                      );
                  })}
              </div>
          </div>
      );
  };

  const meetingFilterLabel = useMemo(() => {
    const labels: Record<typeof meetingTypeFilter, string> = {
      all: 'Все',
      client: 'С клиентами',
      work: 'Команда',
      project: 'Проекты',
      shoot: 'Съёмки',
    };
    return labels[meetingTypeFilter];
  }, [meetingTypeFilter]);

  useLayoutEffect(() => {
    setModule(
      <div className={APP_TOOLBAR_MODULE_CLUSTER}>
        <ModuleSelectDropdown
          accent="teal"
          size="xs"
          prefixLabel="Тип"
          valueLabel={meetingFilterLabel}
          selectedId={meetingTypeFilter}
          items={[
            { id: 'all', label: 'Все', onClick: () => setMeetingTypeFilter('all') },
            { id: 'client', label: 'С клиентами', onClick: () => setMeetingTypeFilter('client') },
            { id: 'work', label: 'Команда', onClick: () => setMeetingTypeFilter('work') },
            { id: 'project', label: 'Проекты', onClick: () => setMeetingTypeFilter('project') },
            { id: 'shoot', label: 'Съёмки', onClick: () => setMeetingTypeFilter('shoot') },
          ]}
        />
        <ModuleCreateDropdown
          accent="teal"
          label="Новое событие"
          items={[
            {
              id: 'work',
              label: 'Рабочая встреча',
              icon: Building2,
              onClick: () => openMeetingCreate('work', getTodayLocalDate()),
            },
            {
              id: 'client',
              label: 'Встреча с клиентом',
              icon: Briefcase,
              onClick: () => openMeetingCreate('client', getTodayLocalDate()),
            },
            {
              id: 'project',
              label: 'Событие по проекту',
              icon: Clapperboard,
              onClick: () => openMeetingCreate('project', getTodayLocalDate()),
            },
            ...(onSaveShootPlan && contentPlanTables.length > 0
              ? [
                  {
                    id: 'shoot',
                    label: 'План съёмки',
                    icon: Camera,
                    onClick: () => openNewShootPlan(getTodayLocalDate()),
                  },
                ]
              : []),
          ]}
        />
      </div>
    );
    return () => setModule(null);
  }, [
    meetingFilterLabel,
    meetingTypeFilter,
    setModule,
    openMeetingCreate,
    openNewShootPlan,
    onSaveShootPlan,
    contentPlanTables.length,
  ]);

  const scrollAreaClass = embedInWorkdesk
    ? 'w-full min-w-0 min-h-0'
    : `${MODULE_PAGE_GUTTER} pt-3 md:pt-5 pb-16 md:pb-20 h-full overflow-y-auto custom-scrollbar`;

  return (
    <ModulePageShell className={embedInWorkdesk ? '!bg-transparent' : ''}>
      <div className={embedInWorkdesk ? 'flex-1 min-h-0 min-w-0 flex flex-col' : 'flex-1 min-h-0 overflow-hidden'}>
        <div className={scrollAreaClass}>{renderCalendar()}</div>
      </div>

      {/* Create/Edit Modal — один скролл по центру, шапка и футер фиксированы */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center bg-black/35 p-4" onClick={handleBackdropClick}>
            <div
              className="bg-white dark:bg-[#252525] rounded-2xl shadow-2xl w-full max-w-xl border border-gray-200 dark:border-[#333] flex flex-col max-h-[min(92vh,840px)] min-h-0"
              onClick={e => e.stopPropagation()}
            >
                <div className="px-5 py-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-start gap-3 shrink-0 bg-gradient-to-r from-teal-50/50 to-white dark:from-teal-950/20 dark:to-[#252525]">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                        {editingMeeting ? 'Редактировать событие' : 'Новое событие'}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Встреча, планёрка или событие по проекту — укажите участников и время.</p>
                    </div>
                    <button type="button" onClick={closeMeetingModal} className="text-gray-400 hover:text-gray-700 dark:hover:text-white p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-[#333] shrink-0" aria-label="Закрыть">
                      <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0">
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 py-5 space-y-4">
                        {(!meetingTypeLocked || editingMeeting) && (
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Тип</label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMeetingType('work');
                                        setRecurrence('none');
                                    }}
                                    className={`px-3 py-2.5 rounded-xl border-2 transition-all flex items-center gap-2 text-sm ${
                                        meetingType === 'work'
                                            ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-100'
                                            : 'border-gray-200 dark:border-[#444] bg-white dark:bg-[#1e1e1e] text-gray-700 dark:text-gray-300'
                                    }`}
                                >
                                    <Building2 size={17} />
                                    <span className="font-medium">Рабочая</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMeetingType('client');
                                        setRecurrence('none');
                                    }}
                                    className={`px-3 py-2.5 rounded-xl border-2 transition-all flex items-center gap-2 text-sm ${
                                        meetingType === 'client'
                                            ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-100'
                                            : 'border-gray-200 dark:border-[#444] bg-white dark:bg-[#1e1e1e] text-gray-700 dark:text-gray-300'
                                    }`}
                                >
                                    <Briefcase size={17} />
                                    <span className="font-medium">С клиентом</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMeetingType('project');
                                        setRecurrence('none');
                                    }}
                                    className={`px-3 py-2.5 rounded-xl border-2 transition-all flex items-center gap-2 text-sm ${
                                        meetingType === 'project'
                                            ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-100'
                                            : 'border-gray-200 dark:border-[#444] bg-white dark:bg-[#1e1e1e] text-gray-700 dark:text-gray-300'
                                    }`}
                                >
                                    <Clapperboard size={17} />
                                    <span className="font-medium">Проект</span>
                                </button>
                            </div>
                        </div>
                        )}

                        {meetingType === 'client' && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Сделка <span className="text-red-500">*</span></label>
                                <EntitySearchSelect
                                    value={selectedDealId}
                                    onChange={setSelectedDealId}
                                    searchPlaceholder="Сделка, клиент, компания…"
                                    options={[
                                        { value: '', label: 'Выберите сделку' },
                                        ...(deals || []).filter((d) => !d.isArchived).map((d) => {
                                            const client = clients.find((c) => c.id === d.clientId);
                                            const searchText = [
                                                d.title,
                                                d.contactName,
                                                d.number,
                                                d.telegramUsername,
                                                client?.name,
                                                client?.companyName,
                                            ]
                                                .filter(Boolean)
                                                .join(' ');
                                            return {
                                                value: d.id,
                                                label: `${d.title || 'Без названия'}${client ? ` (${client.name})` : ''}`,
                                                searchText,
                                            };
                                        }),
                                    ]}
                                    className="w-full"
                                />
                            </div>
                        )}

                        {meetingType === 'project' && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Проект <span className="text-red-500">*</span></label>
                                <EntitySearchSelect
                                    value={selectedProjectId}
                                    onChange={setSelectedProjectId}
                                    searchPlaceholder="Название проекта…"
                                    options={[
                                        { value: '', label: 'Выберите проект' },
                                        ...(projects || []).filter((p) => !p.isArchived).map((p) => ({
                                            value: p.id,
                                            label: p.name,
                                            searchText: p.name,
                                        })),
                                    ]}
                                    className="w-full"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Тема</label>
                            <input 
                                required 
                                type="text" 
                                value={title} 
                                onChange={e => setTitle(e.target.value)} 
                                className="w-full bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-[#444] rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 outline-none" 
                                placeholder={
                                    meetingType === 'client'
                                        ? 'Например: Презентация проекта'
                                        : meetingType === 'project'
                                          ? 'Например: Съёмка, монтаж, сдача этапа'
                                          : 'Например: Планёрка команды'
                                }
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Дата</label>
                                <DateInput
                                  required
                                  value={normalizeDateForInput(date) || date}
                                  onChange={setDate}
                                  className="w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Время</label>
                                <input 
                                    required 
                                    type="time" 
                                    value={time} 
                                    onChange={e => setTime(e.target.value)} 
                                    className="w-full bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-[#444] rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500/40 outline-none"
                                />
                            </div>
                        </div>

                        {meetingType === 'work' && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Повторение</label>
                                <EntitySearchSelect
                                    value={recurrence}
                                    onChange={(val) => setRecurrence(val as 'none' | 'daily' | 'weekly' | 'monthly')}
                                    options={[
                                        { value: 'none', label: 'Не повторять', searchText: 'не повторять none' },
                                        { value: 'daily', label: 'Ежедневно', searchText: 'ежедневно daily каждый день' },
                                        { value: 'weekly', label: 'Еженедельно', searchText: 'еженедельно weekly неделя' },
                                        { value: 'monthly', label: 'Ежемесячно', searchText: 'ежемесячно monthly месяц' },
                                    ]}
                                    className="w-full"
                                    searchPlaceholder="Повторение…"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Участники</label>
                            <div className="border border-gray-200 dark:border-[#444] rounded-xl max-h-[min(200px,28vh)] overflow-y-auto custom-scrollbar bg-gray-50/50 dark:bg-[#1a1a1a] divide-y divide-gray-100 dark:divide-[#333]">
                                {users.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-gray-400 dark:text-gray-500">Нет сотрудников</div>
                                ) : (
                                    users.map(u => {
                                        const isSelected = selectedParticipants.includes(u.id);
                                        return (
                                            <div 
                                                key={u.id}
                                                onClick={() => toggleParticipant(u.id)}
                                                className={`flex items-center gap-3 p-2.5 cursor-pointer transition-colors hover:bg-white/80 dark:hover:bg-[#252525] ${isSelected ? 'bg-teal-50/80 dark:bg-teal-950/30' : ''}`}
                                            >
                                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${isSelected ? 'bg-teal-600 border-teal-600' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-[#252525]'}`}>
                                                    {isSelected && <Check size={12} className="text-white" />}
                                                </div>
                                                <img src={u.avatar} className="w-7 h-7 rounded-full object-cover" alt="" />
                                                <span className={`text-sm ${isSelected ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>{u.name}</span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="px-5 py-4 border-t border-gray-100 dark:border-[#333] bg-gray-50/80 dark:bg-[#1f1f1f] flex flex-wrap items-center justify-between gap-2 shrink-0">
                        <div className="min-w-0">
                          {editingMeeting && onDeleteMeeting && (
                            <button
                              type="button"
                              onClick={() => setMeetingDeleteConfirmOpen(true)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl"
                            >
                              <Trash2 size={16} />
                              Удалить событие
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                        <button 
                            type="button" 
                            onClick={closeMeetingModal}
                            className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200/80 dark:hover:bg-[#333] rounded-xl"
                        >
                            Отмена
                        </button>
                        <button 
                            type="submit" 
                            className="px-5 py-2.5 text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 rounded-xl shadow-sm"
                        >
                            {editingMeeting ? 'Сохранить' : 'Создать'}
                        </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
      )}

      {pickEventKindOpen && (
        <div
          className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center bg-black/40 p-4"
          onClick={(e) => e.target === e.currentTarget && setPickEventKindOpen(false)}
        >
          <div
            className="bg-white dark:bg-[#252525] rounded-2xl shadow-xl max-w-sm w-full border border-gray-200 dark:border-[#333] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 dark:border-[#333]">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Новое событие</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Дата: {pickEventKindDate ? new Date(pickEventKindDate + 'T12:00:00').toLocaleDateString('ru-RU') : '—'}
              </p>
            </div>
            <div className="p-3 space-y-1">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#333]"
                onClick={() => {
                  setPickEventKindOpen(false);
                  openMeetingCreate('work', pickEventKindDate);
                }}
              >
                <Building2 size={18} className="text-teal-600 shrink-0" />
                Рабочая встреча
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#333]"
                onClick={() => {
                  setPickEventKindOpen(false);
                  openMeetingCreate('client', pickEventKindDate);
                }}
              >
                <Briefcase size={18} className="text-sky-600 shrink-0" />
                Встреча с клиентом
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#333]"
                onClick={() => {
                  setPickEventKindOpen(false);
                  openMeetingCreate('project', pickEventKindDate);
                }}
              >
                <Clapperboard size={18} className="text-emerald-600 shrink-0" />
                Событие по проекту
              </button>
              {onSaveShootPlan && contentPlanTables.length > 0 && (
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#333]"
                  onClick={() => {
                    setPickEventKindOpen(false);
                    openNewShootPlan(pickEventKindDate);
                  }}
                >
                  <Camera size={18} className="text-orange-500 shrink-0" />
                  План съёмки
                </button>
              )}
            </div>
            <div className="px-3 pb-3">
              <button
                type="button"
                className="w-full py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] rounded-xl"
                onClick={() => setPickEventKindOpen(false)}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      <SystemConfirmDialog
        open={meetingDeleteConfirmOpen}
        title="Удалить событие?"
        message="Встреча будет удалена из календаря (в архив). Продолжить?"
        danger
        confirmText="Удалить"
        cancelText="Отмена"
        onCancel={() => setMeetingDeleteConfirmOpen(false)}
        onConfirm={() => {
          if (editingMeeting && onDeleteMeeting) {
            onDeleteMeeting(editingMeeting.id);
            closeMeetingModal();
          }
          setMeetingDeleteConfirmOpen(false);
        }}
      />

      {shootModalDraft && onSaveShootPlan && (
        <ShootPlanModal
          draft={shootModalDraft}
          onDraftChange={setShootModalDraft}
          allPostsForTable={contentPosts}
          users={users}
          reservedPostIds={reservedForShootModal}
          postFormatFilter={shootPostFormatFilter}
          onPostFormatFilterChange={setShootPostFormatFilter}
          onSave={saveShootFromCalendar}
          onCancel={() => setShootModalDraft(null)}
          isNew={!shootPlans.some((p) => p.id === shootModalDraft.id)}
          contentPlanOptions={contentPlanOptions.length > 0 ? contentPlanOptions : undefined}
        />
      )}
    </ModulePageShell>
  );
};

export default MeetingsView;
