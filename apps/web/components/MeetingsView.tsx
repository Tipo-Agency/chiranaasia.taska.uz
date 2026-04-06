
import React, { useState, useMemo } from 'react';
import { Meeting, User, TableCollection, Client, Deal, Project, NotificationPreferences, ShootPlan } from '../types';
import {
  Calendar,
  Camera,
  X,
  List,
  LayoutGrid,
  Clock,
  Repeat,
  Check,
  Trash2,
  Box,
  Briefcase,
  Building2,
  Clapperboard,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { TaskSelect } from './TaskSelect';
import { normalizeDateForInput } from '../utils/dateUtils';
import { ModulePageShell, ModulePageHeader, ModuleSegmentedControl, MODULE_PAGE_GUTTER, ModuleCreateIconButton } from './ui';
import { DateInput } from './ui/DateInput';

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
  /** Для перехода в контент-план → вкладка «Съёмки» */
  shootPlans?: ShootPlan[];
  onNavigateToShootPlan?: (tableId: string, shootPlanId: string) => void;
}

const DEFAULT_CAL_COLORS = {
  client: '#0ea5e9',
  work: '#8b5cf6',
  project: '#10b981',
  shoot: '#f97316',
};

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
  onNavigateToShootPlan,
}) => {
  /** Календарь по умолчанию; отдельная вкладка «Съёмки» */
  const [calendarTab, setCalendarTab] = useState<'calendar' | 'list' | 'shoots'>('calendar');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [meetingTypeFilter, setMeetingTypeFilter] = useState<'all' | 'client' | 'work' | 'project' | 'shoot'>('all');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const t = new Date();
    return { month: t.getMonth(), year: t.getFullYear() };
  });
  
  // Form State
  const [meetingType, setMeetingType] = useState<'client' | 'work' | 'project'>('work'); // shoot только из планов съёмок
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('10:00');
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [selectedDealId, setSelectedDealId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

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
      .filter(m => showAll ? true : m.tableId === tableId)
      .map((m) => {
        let inferred: Meeting['type'];
        if (m.shootPlanId || m.type === 'shoot') inferred = 'shoot';
        else if (m.projectId) inferred = 'project';
        else inferred = (m.type || 'work') as Meeting['type'];
        return { ...m, type: inferred };
      });
    
    if (calendarTab === 'shoots') {
      filtered = filtered.filter((m) => m.type === 'shoot');
    } else if (meetingTypeFilter !== 'all') {
      filtered = filtered.filter(m => m.type === meetingTypeFilter);
    }
    
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [meetings, tableId, showAll, meetingTypeFilter, calendarTab]);

  const getTableName = (id: string) => tables.find(t => t.id === id)?.name || '';

  const handleOpenCreate = () => {
      setEditingMeeting(null);
      setMeetingType('work');
      setTitle('');
      setDate(new Date().toISOString().split('T')[0]);
      setTime('10:00');
      setRecurrence('none');
      setSelectedDealId('');
      setSelectedProjectId('');
      setSelectedParticipants([]);
      setIsModalOpen(true);
  };

  const handleOpenEdit = (meeting: Meeting) => {
      if (meetingTypeKey(meeting) === 'shoot' || meeting.shootPlanId) {
        const sid = meeting.shootPlanId || '';
        const plan = sid ? shootPlans.find((p) => p.id === sid) : undefined;
        const targetTableId = plan?.tableId;
        if (targetTableId && onNavigateToShootPlan && sid) {
          onNavigateToShootPlan(targetTableId, sid);
          return;
        }
        alert('План съёмки не найден. Откройте нужный контент-план → вкладка «Съёмки».');
        return;
      }
      setEditingMeeting(meeting);
      const inferred: Meeting['type'] = meeting.projectId ? 'project' : (meeting.type || 'work');
      setMeetingType(inferred);
      setTitle(meeting.title);
      setDate(normalizeDateForInput(meeting.date) || new Date().toISOString().split('T')[0]);
      setTime(meeting.time);
      setRecurrence(meeting.recurrence || 'none');
      setSelectedDealId(meeting.dealId || '');
      setSelectedProjectId(meeting.projectId || '');
      setSelectedParticipants(meeting.participantIds || []);
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
      
      if (editingMeeting) {
          // Редактирование существующей встречи
          onSaveMeeting({
              ...editingMeeting,
              type: meetingType,
              title,
              date,
              time,
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
              date,
              time,
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
      setIsModalOpen(false);
      setEditingMeeting(null);
      setTitle('');
      setSelectedParticipants([]);
      setSelectedDealId('');
      setSelectedProjectId('');
      setRecurrence('none');
      setMeetingType('work');
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
              onSaveMeeting({ ...meeting, date: targetDate });
          }
          setDraggedMeetingId(null);
      }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) setIsModalOpen(false);
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
          <div className="rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#191919] shadow-sm overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-[#333] bg-gradient-to-r from-teal-50/90 to-cyan-50/80 dark:from-teal-950/40 dark:to-cyan-950/30 px-4 sm:px-5 py-3 sm:py-4">
                  <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => shiftCalendarMonth(-1)}
                      className="p-2 rounded-xl border border-teal-200/80 dark:border-teal-800 bg-white/80 dark:bg-[#1a1a1a] text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/50 transition-colors shrink-0"
                      title="Предыдущий месяц"
                      aria-label="Предыдущий месяц"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <div className="flex items-center gap-2 min-w-0 flex-1 justify-center sm:justify-start">
                      <CalendarDays className="text-teal-600 dark:text-teal-400 shrink-0 hidden sm:block" size={22} />
                      <span className="capitalize font-semibold text-gray-900 dark:text-white text-base truncate text-center sm:text-left">
                        {monthLabel}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => shiftCalendarMonth(1)}
                      className="p-2 rounded-xl border border-teal-200/80 dark:border-teal-800 bg-white/80 dark:bg-[#1a1a1a] text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/50 transition-colors shrink-0"
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
              <div className="grid grid-cols-7 border-b border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#252525]">
                  {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
                      <div key={d} className="p-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{d}</div>
                  ))}
              </div>
              <div className="grid grid-cols-7 bg-white dark:bg-[#141414]">
                  {days.map((day, idx) => {
                      let dateStr = '';
                      if (day) {
                          const mm = String(currentMonth + 1).padStart(2, '0');
                          const dd = String(day).padStart(2, '0');
                          dateStr = `${currentYear}-${mm}-${dd}`;
                      }

                      const dayMeetings = day ? filteredMeetings.filter(m => {
                          try {
                              const mDate = new Date(m.date);
                              return mDate.getDate() === day && mDate.getMonth() === currentMonth && mDate.getFullYear() === currentYear;
                          } catch (e) { return false; }
                      }) : [];
                      
                      const isToday =
                        day &&
                        new Date().toDateString() === new Date(currentYear, currentMonth, day).toDateString();

                      return (
                        <div 
                            key={idx} 
                            className={`min-h-[128px] border-r border-b border-gray-100 dark:border-[#2a2a2a] p-1.5 transition-colors ${!day ? 'bg-gray-50/40 dark:bg-[#0f0f0f]' : 'hover:bg-teal-50/30 dark:hover:bg-teal-950/20'}`}
                            onDragOver={day ? onDragOver : undefined}
                            onDrop={day ? (e) => onDrop(e, dateStr) : undefined}
                        >
                            {day && (
                                <>
                                    <div className={`text-right text-xs font-bold mb-1 px-0.5 ${isToday ? 'text-teal-600 dark:text-teal-400' : 'text-gray-500 dark:text-gray-500'}`}>
                                      {isToday ? (
                                        <span className="inline-flex items-center justify-end gap-1">
                                          <span className="rounded-full bg-teal-600 text-white px-1.5 py-0.5 text-[10px]">{day}</span>
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
                                                className="bg-white dark:bg-teal-950/55 text-teal-950 dark:text-teal-50 px-2 py-1.5 rounded-xl border border-teal-200/90 dark:border-teal-800 cursor-pointer shadow-sm hover:border-teal-500 dark:hover:border-teal-500 hover:shadow transition-all" 
                                                style={{ borderLeftWidth: 3, borderLeftColor: getTypeColor(m) }}
                                                title={`${m.time} — ${m.title}`}
                                            >
                                                <div className="text-[11px] font-bold text-teal-700 dark:text-teal-200 tabular-nums">{m.time}</div>
                                                <div className="text-[11px] font-semibold leading-snug line-clamp-2 mt-0.5">{m.title}</div>
                                                <div className="flex flex-wrap items-center gap-1 mt-1">
                                                  <span className="text-[9px] uppercase tracking-wide font-semibold px-1 py-0.5 rounded bg-teal-100/90 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200">{typeShort}</span>
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

  return (
    <ModulePageShell>
      <div className={`${MODULE_PAGE_GUTTER} pt-6 md:pt-8 flex-shrink-0`}>
        <div className="mb-5 space-y-5">
          <ModulePageHeader
            accent="teal"
            icon={<CalendarDays size={24} strokeWidth={2} />}
            title="Календарь"
            description="Встречи, планёрки и события по проектам — в списке и в календаре"
            tabs={
              calendarTab === 'calendar' ? (
              <ModuleSegmentedControl<'all' | 'client' | 'work' | 'project' | 'shoot'>
                variant="neutral"
                value={meetingTypeFilter}
                onChange={setMeetingTypeFilter}
                options={[
                  { value: 'all', label: 'Все' },
                  { value: 'client', label: 'С клиентами' },
                  { value: 'work', label: 'Команда' },
                  { value: 'project', label: 'Проекты' },
                  { value: 'shoot', label: 'Съёмки' },
                ]}
              />
              ) : (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {calendarTab === 'shoots' ? 'Только планы съёмок из контент-плана' : 'Все типы событий'}
                </span>
              )
            }
            controls={
              <>
                <ModuleSegmentedControl<'calendar' | 'list' | 'shoots'>
                  variant="accent"
                  accent="teal"
                  value={calendarTab}
                  onChange={setCalendarTab}
                  options={[
                    { value: 'calendar', label: 'Календарь', icon: <LayoutGrid size={16} /> },
                    { value: 'list', label: 'Список', icon: <List size={16} /> },
                    { value: 'shoots', label: 'Съёмки', icon: <Clapperboard size={16} /> },
                  ]}
                />
                <ModuleCreateIconButton accent="teal" label="Новое событие" onClick={handleOpenCreate} />
              </>
            }
            actions={
              <ModuleCreateIconButton accent="teal" label="Новое событие" onClick={handleOpenCreate} />
            }
          />
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={`${MODULE_PAGE_GUTTER} pb-20 h-full overflow-y-auto custom-scrollbar`}>
      {calendarTab === 'list' ? (
        <div className="grid gap-4">
            {filteredMeetings.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-8 py-16 text-center">
                    <CalendarDays className="mx-auto text-gray-300 dark:text-gray-600 mb-4" size={48} strokeWidth={1.25} />
                    <p className="text-gray-800 dark:text-gray-200 font-semibold text-lg">Нет событий по фильтру</p>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-2 max-w-md mx-auto">Добавьте встречу с клиентом, планёрку или событие по проекту (например съёмку).</p>
                    <button
                      type="button"
                      onClick={handleOpenCreate}
                      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-5 py-2.5 shadow-sm"
                    >
                      <Calendar size={16} /> Запланировать
                    </button>
                </div>
            ) : (
                filteredMeetings.map(meeting => {
                  const d = new Date(meeting.date);
                  const dayNum = d.getDate();
                  const monthShort = d.toLocaleString('ru-RU', { month: 'short' });
                  return (
                    <div
                      key={meeting.id}
                      className="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] shadow-sm transition-all hover:shadow-md hover:border-teal-300/60 dark:hover:border-teal-800"
                      style={{ borderLeftWidth: 4, borderLeftColor: getTypeColor(meeting) }}
                    >
                        {showAll && (
                            <div className="absolute top-3 right-3 z-10 text-[10px] bg-gray-100/95 dark:bg-[#252525] text-gray-600 dark:text-gray-300 px-2 py-1 rounded-lg flex items-center gap-1 border border-gray-200 dark:border-[#444]">
                                <Box size={10} /> {getTableName(meeting.tableId)}
                            </div>
                        )}
                        <div className="flex flex-col sm:flex-row sm:items-stretch">
                          <div className="flex sm:flex-col items-center justify-center gap-0.5 px-5 py-4 sm:py-5 bg-gradient-to-br from-teal-500/12 to-cyan-500/10 dark:from-teal-900/40 dark:to-cyan-950/30 border-b sm:border-b-0 sm:border-r border-gray-100 dark:border-[#333] min-w-[100px] shrink-0">
                            <span className="text-3xl font-bold tabular-nums text-teal-700 dark:text-teal-300 leading-none">{dayNum}</span>
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-600/90 dark:text-teal-400/90">{monthShort}</span>
                          </div>
                          <div className="flex-1 p-4 sm:p-5 min-w-0">
                        <div className="flex justify-between items-start gap-3">
                            <div className="flex-1 cursor-pointer min-w-0" onClick={() => handleOpenEdit(meeting)}>
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                                      meeting.type === 'client'
                                        ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200'
                                        : meeting.type === 'project'
                                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                                        : meeting.type === 'shoot'
                                          ? 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200'
                                        : 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200'
                                    }`}>
                                    {meeting.type === 'client' ? <Briefcase size={12} /> : meeting.type === 'project' ? <Clapperboard size={12} /> : meeting.type === 'shoot' ? <Camera size={12} /> : <Building2 size={12} />}
                                    {meeting.type === 'client' ? 'С клиентом' : meeting.type === 'project' ? 'Проект' : meeting.type === 'shoot' ? 'Съёмка' : 'Команда'}
                                    </span>
                                    {meeting.recurrence && meeting.recurrence !== 'none' && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 px-2 py-0.5 text-[11px] font-medium">
                                            <Repeat size={10} /> {meeting.recurrence === 'daily' ? 'Каждый день' : meeting.recurrence === 'weekly' ? 'Раз в неделю' : 'Раз в месяц'}
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors">
                                    {meeting.title}
                                </h3>
                                {meeting.type === 'client' && meeting.dealId && (
                                        <span className="inline-block mb-2 text-xs bg-sky-50 dark:bg-sky-900/40 text-sky-700 dark:text-sky-200 px-2 py-1 rounded-lg border border-sky-100 dark:border-sky-800">
                                            Сделка: {deals.find(d => d.id === meeting.dealId)?.title || '—'}
                                        </span>
                                    )}
                                {meeting.type === 'project' && meeting.projectId && (
                                        <span className="inline-block mb-2 text-xs bg-emerald-50 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 px-2 py-1 rounded-lg border border-emerald-100 dark:border-emerald-800">
                                            Проект: {projects.find((p) => p.id === meeting.projectId)?.name || '—'}
                                        </span>
                                    )}
                                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-[#252525] px-2.5 py-1 text-xs font-medium">
                                      <Clock size={14} className="text-gray-400" /> {meeting.time}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <div className="flex -space-x-2">
                                    {(meeting.participantIds || []).map(uid => {
                                        const u = users.find(user => user.id === uid);
                                        if (!u) return null;
                                        return (
                                            <img key={uid} src={u.avatar} className="w-9 h-9 rounded-full border-2 border-white dark:border-[#1a1a1a] object-cover object-center ring-2 ring-gray-100 dark:ring-[#333]" title={u.name} alt="" />
                                        );
                                    })}
                                </div>
                                {onDeleteMeeting && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm('Удалить встречу?')) {
                                                onDeleteMeeting(meeting.id);
                                            }
                                        }}
                                        className="p-2 text-gray-400 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                        title="Удалить встречу"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#2a2a2a]" onClick={(e) => e.stopPropagation()}>
                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Итоги и резюме</label>
                            <textarea 
                                className="w-full rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50/80 dark:bg-[#141414] text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 outline-none min-h-[96px] resize-y placeholder-gray-400 dark:placeholder-gray-600"
                                placeholder="Кратко зафиксируйте договорённости и следующие шаги…"
                                defaultValue={meeting.summary}
                                onBlur={(e) => onUpdateSummary(meeting.id, e.target.value)}
                            />
                        </div>
                          </div>
                        </div>
                    </div>
                  );
                })
            )}
        </div>
      ) : (
        renderCalendar()
      )}
        </div>
      </div>

      {/* Create/Edit Modal — один скролл по центру, шапка и футер фиксированы */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-50 p-4" onClick={handleBackdropClick}>
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
                    <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-[#333] shrink-0" aria-label="Закрыть">
                      <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0">
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 py-5 space-y-4">
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

                        {meetingType === 'client' && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Сделка <span className="text-red-500">*</span></label>
                                <TaskSelect
                                    value={selectedDealId}
                                    onChange={setSelectedDealId}
                                    options={[
                                        { value: '', label: 'Выберите сделку' },
                                        ...(deals || []).filter(d => !d.isArchived).map(d => {
                                            const client = clients.find(c => c.id === d.clientId);
                                            return {
                                                value: d.id,
                                                label: `${d.title}${client ? ` (${client.name})` : ''}`
                                            };
                                        })
                                    ]}
                                    className="w-full"
                                />
                            </div>
                        )}

                        {meetingType === 'project' && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Проект <span className="text-red-500">*</span></label>
                                <TaskSelect
                                    value={selectedProjectId}
                                    onChange={setSelectedProjectId}
                                    options={[
                                        { value: '', label: 'Выберите проект' },
                                        ...(projects || []).filter((p) => !p.isArchived).map((p) => ({
                                            value: p.id,
                                            label: p.name,
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
                                <TaskSelect
                                    value={recurrence}
                                    onChange={(val) => setRecurrence(val as 'none' | 'daily' | 'weekly' | 'monthly')}
                                    options={[
                                        { value: 'none', label: 'Не повторять' },
                                        { value: 'daily', label: 'Ежедневно' },
                                        { value: 'weekly', label: 'Еженедельно' },
                                        { value: 'monthly', label: 'Ежемесячно' }
                                    ]}
                                    className="w-full"
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

                    <div className="px-5 py-4 border-t border-gray-100 dark:border-[#333] bg-gray-50/80 dark:bg-[#1f1f1f] flex justify-end gap-2 shrink-0">
                        <button 
                            type="button" 
                            onClick={() => setIsModalOpen(false)}
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
                </form>
            </div>
        </div>
      )}
    </ModulePageShell>
  );
};

export default MeetingsView;
