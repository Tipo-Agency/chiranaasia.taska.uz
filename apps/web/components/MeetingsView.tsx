
import React, { useState, useMemo } from 'react';
import { Meeting, User, TableCollection, Client, Deal } from '../types';
import { Calendar, Users, Plus, X, List, LayoutGrid, Clock, Repeat, Check, Trash2, Box, Briefcase, Building2 } from 'lucide-react';
import { TaskSelect } from './TaskSelect';
import { normalizeDateForInput } from '../utils/dateUtils';

interface MeetingsViewProps {
  meetings: Meeting[];
  users: User[];
  clients?: Client[];
  deals?: Deal[];
  tableId: string;
  showAll?: boolean; // Aggregator mode
  tables?: TableCollection[];
  onSaveMeeting: (meeting: Meeting) => void;
  onDeleteMeeting?: (meetingId: string) => void;
  onUpdateSummary: (meetingId: string, summary: string) => void;
}

const MeetingsView: React.FC<MeetingsViewProps> = ({ meetings = [], users, clients = [], deals = [], tableId, showAll = false, tables = [], onSaveMeeting, onDeleteMeeting, onUpdateSummary }) => {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [meetingTypeFilter, setMeetingTypeFilter] = useState<'all' | 'client' | 'work'>('all');
  
  // Form State
  const [meetingType, setMeetingType] = useState<'client' | 'work'>('work');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('10:00');
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [selectedDealId, setSelectedDealId] = useState<string>('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  // DnD State
  const [draggedMeetingId, setDraggedMeetingId] = useState<string | null>(null);

  const filteredMeetings = useMemo(() => {
    let filtered = (meetings || [])
      .filter(m => !m.isArchived) // Исключаем архивные встречи
      .filter(m => showAll ? true : m.tableId === tableId)
      .map(m => ({
        ...m,
        type: m.type || 'work' // Дефолтный тип для старых встреч
      }));
    
    // Фильтр по типу
    if (meetingTypeFilter !== 'all') {
      filtered = filtered.filter(m => m.type === meetingTypeFilter);
    }
    
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [meetings, tableId, showAll, meetingTypeFilter]);

  const getTableName = (id: string) => tables.find(t => t.id === id)?.name || '';

  const handleOpenCreate = () => {
      setEditingMeeting(null);
      setMeetingType('work');
      setTitle('');
      setDate(new Date().toISOString().split('T')[0]);
      setTime('10:00');
      setRecurrence('none');
      setSelectedDealId('');
      setSelectedParticipants([]);
      setIsModalOpen(true);
  };

  const handleOpenEdit = (meeting: Meeting) => {
      setEditingMeeting(meeting);
      setMeetingType(meeting.type || 'work');
      setTitle(meeting.title);
      setDate(normalizeDateForInput(meeting.date) || new Date().toISOString().split('T')[0]);
      setTime(meeting.time);
      setRecurrence(meeting.recurrence || 'none');
      setSelectedDealId(meeting.dealId || '');
      setSelectedParticipants(meeting.participantIds || []);
      setIsModalOpen(true);
  };

  const handleCreate = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      
      // Валидация для встреч с клиентами
      if (meetingType === 'client' && !selectedDealId) {
          alert('Выберите сделку для встречи');
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
      if (e.target === e.currentTarget) {
          if(window.confirm("Сохранить изменения?")) handleCreate();
          else setIsModalOpen(false);
      }
  };

  const renderCalendar = () => {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const firstDay = new Date(currentYear, currentMonth, 1).getDay();
      
      const startOffset = firstDay === 0 ? 6 : firstDay - 1; 

      const days = [];
      for (let i = 0; i < startOffset; i++) days.push(null);
      for (let i = 1; i <= daysInMonth; i++) days.push(i);

      return (
          <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gray-50 dark:bg-[#252525] border-b border-gray-200 dark:border-[#333] p-4 font-semibold text-gray-700 dark:text-gray-200 flex justify-between items-center">
                  <span className="capitalize">{today.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}</span>
                  <div className="flex gap-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Встреча</span>
                  </div>
              </div>
              <div className="grid grid-cols-7 border-b border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#252525]">
                  {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
                      <div key={d} className="p-2 text-center text-xs font-bold text-gray-400 dark:text-gray-500">{d}</div>
                  ))}
              </div>
              <div className="grid grid-cols-7 bg-white dark:bg-[#1e1e1e]">
                  {days.map((day, idx) => {
                      // Safe date generation
                      let dateStr = '';
                      if (day) {
                          const d = new Date(currentYear, currentMonth, day + 1); // +1 to fix offset issue often seen
                          dateStr = d.toISOString().split('T')[0];
                      }

                      const dayMeetings = day ? filteredMeetings.filter(m => {
                          try {
                              const mDate = new Date(m.date);
                              return mDate.getDate() === day && mDate.getMonth() === currentMonth && mDate.getFullYear() === currentYear;
                          } catch (e) { return false; }
                      }) : [];
                      
                      return (
                        <div 
                            key={idx} 
                            className={`min-h-[100px] border-r border-b border-gray-100 dark:border-[#333] p-2 transition-colors ${!day ? 'bg-gray-50/30 dark:bg-[#1a1a1a]' : 'hover:bg-gray-50/50 dark:hover:bg-[#2a2a2a]'}`}
                            onDragOver={day ? onDragOver : undefined}
                            onDrop={day ? (e) => onDrop(e, dateStr) : undefined}
                        >
                            {day && (
                                <>
                                    <div className="text-right text-xs text-gray-400 mb-1">{day}</div>
                                    <div className="space-y-1">
                                        {dayMeetings.map(m => (
                                            <div 
                                                key={m.id} 
                                                draggable
                                                onDragStart={(e) => onDragStart(e, m.id)}
                                                onClick={(e) => { e.stopPropagation(); handleOpenEdit(m); }}
                                                className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-1 rounded border border-blue-100 dark:border-blue-800 truncate cursor-pointer shadow-sm hover:bg-blue-100 dark:hover:bg-blue-900/50" 
                                                title={m.title}
                                            >
                                                {m.time} {m.title}
                                            </div>
                                        ))}
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
    <div className="h-full flex flex-col min-h-0">
      <div className="max-w-7xl mx-auto w-full pt-8 px-6 flex-shrink-0">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-gray-800 dark:text-white truncate">Встречи</h1>
              <p className="hidden md:block text-xs text-gray-500 dark:text-gray-400 mt-1">
                Управление встречами и планерками
              </p>
            </div>
            <button 
              onClick={handleOpenCreate}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 flex items-center gap-2 shadow-sm"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Создать</span>
            </button>
          </div>
          
          {/* Filters and View Mode */}
          <div className="flex items-center justify-between gap-4 mb-4">
            {/* Type Filter */}
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#252525] rounded-full p-1 text-xs">
              <button 
                onClick={() => setMeetingTypeFilter('all')} 
                className={`px-3 py-1.5 rounded-full ${meetingTypeFilter === 'all' ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}
              >
                Все
              </button>
              <button 
                onClick={() => setMeetingTypeFilter('client')} 
                className={`px-3 py-1.5 rounded-full ${meetingTypeFilter === 'client' ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}
              >
                С клиентами
              </button>
              <button 
                onClick={() => setMeetingTypeFilter('work')} 
                className={`px-3 py-1.5 rounded-full ${meetingTypeFilter === 'work' ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}
              >
                Рабочие
              </button>
            </div>
            
            {/* View Mode Tabs */}
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#252525] rounded-full p-1 text-xs">
              <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-full ${viewMode === 'list' ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}>
                Список
              </button>
              <button onClick={() => setViewMode('calendar')} className={`px-3 py-1.5 rounded-full ${viewMode === 'calendar' ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}>
                Календарь
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="max-w-7xl mx-auto w-full px-6 pb-20 h-full overflow-y-auto custom-scrollbar">
      {viewMode === 'calendar' ? renderCalendar() : (
        <div className="grid gap-4">
            {filteredMeetings.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-[#1e1e1e] border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                    <p className="text-gray-500 dark:text-gray-400">Пока нет запланированных встреч.</p>
                </div>
            ) : (
                filteredMeetings.map(meeting => (
                    <div key={meeting.id} className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative">
                        {showAll && (
                            <div className="absolute top-4 right-4 text-[10px] bg-gray-100 dark:bg-[#333] text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Box size={10} /> {getTableName(meeting.tableId)}
                            </div>
                        )}
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex-1 cursor-pointer" onClick={() => handleOpenEdit(meeting)}>
                                <div className="flex items-center gap-2 mb-1">
                                    {meeting.type === 'client' ? (
                                        <Briefcase size={16} className="text-blue-500" />
                                    ) : (
                                        <Building2 size={16} className="text-purple-500" />
                                    )}
                                    <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">
                                        {meeting.type === 'client' ? 'С клиентом' : 'Рабочая встреча'}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1 flex items-center gap-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                    {meeting.title}
                                    {meeting.type === 'client' && meeting.dealId && (
                                        <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800">
                                            {deals.find(d => d.id === meeting.dealId)?.title || 'Сделка'}
                                        </span>
                                    )}
                                    {meeting.recurrence && meeting.recurrence !== 'none' && (
                                        <span className="text-[10px] bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 rounded border border-purple-100 dark:border-purple-800 flex items-center gap-1 capitalize">
                                            <Repeat size={10} className="text-purple-600 dark:text-purple-300"/> {meeting.recurrence === 'daily' ? 'Ежедневно' : meeting.recurrence === 'weekly' ? 'Еженедельно' : 'Ежемесячно'}
                                        </span>
                                    )}
                                </h3>
                                <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                                    <span className="flex items-center gap-1 bg-gray-50 dark:bg-[#303030] border border-gray-200 dark:border-gray-600 px-2 py-0.5 rounded text-xs"><Calendar size={12} className="text-gray-500 dark:text-gray-400"/> {new Date(meeting.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')}</span>
                                    <span className="flex items-center gap-1 bg-gray-50 dark:bg-[#303030] border border-gray-200 dark:border-gray-600 px-2 py-0.5 rounded text-xs"><Clock size={12} className="text-gray-500 dark:text-gray-400"/> {meeting.time}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex -space-x-2 mr-2">
                                    {(meeting.participantIds || []).map(uid => {
                                        const u = users.find(user => user.id === uid);
                                        if (!u) return null;
                                        return (
                                            <img key={uid} src={u.avatar} className="w-8 h-8 rounded-full border-2 border-white dark:border-[#252525] object-cover object-center" title={u.name} />
                                        );
                                    })}
                                </div>
                                {onDeleteMeeting && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm('Удалить встречу?')) {
                                                onDeleteMeeting(meeting.id);
                                            }
                                        }}
                                        className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                        title="Удалить встречу"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Резюме встречи / Итоги</label>
                            <textarea 
                                className="w-full bg-gray-50 dark:bg-[#1e1e1e] text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 outline-none min-h-[100px] resize-y placeholder-gray-400 dark:placeholder-gray-600"
                                placeholder="Напишите здесь результаты встречи..."
                                defaultValue={meeting.summary}
                                onBlur={(e) => onUpdateSummary(meeting.id, e.target.value)}
                            />
                        </div>
                    </div>
                ))
            )}
        </div>
      )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={handleBackdropClick}>
            <div className="bg-white dark:bg-[#252525] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-gray-200 dark:border-[#333]" onClick={e => e.stopPropagation()}>
                {/* Header - стандартизированный дизайн */}
                <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center bg-white dark:bg-[#252525] shrink-0">
                    <h3 className="font-bold text-gray-800 dark:text-white">{editingMeeting ? 'Редактировать встречу' : 'Новая встреча'}</h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#333]"><X size={18} /></button>
                </div>

                {/* Form */}
                <form onSubmit={handleCreate} className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-6 space-y-5">
                        {/* Meeting Type */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Тип встречи</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMeetingType('work');
                                        setRecurrence('none');
                                        setSelectedClientId('');
                                    }}
                                    className={`px-4 py-3 rounded-lg border-2 transition-all flex items-center gap-2 ${
                                        meetingType === 'work'
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                            : 'border-gray-200 dark:border-[#444] bg-white dark:bg-[#1e1e1e] text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-[#555]'
                                    }`}
                                >
                                    <Building2 size={18} />
                                    <span className="font-medium">Рабочая встреча</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMeetingType('client');
                                        setRecurrence('none');
                                    }}
                                    className={`px-4 py-3 rounded-lg border-2 transition-all flex items-center gap-2 ${
                                        meetingType === 'client'
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                            : 'border-gray-200 dark:border-[#444] bg-white dark:bg-[#1e1e1e] text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-[#555]'
                                    }`}
                                >
                                    <Briefcase size={18} />
                                    <span className="font-medium">С клиентом</span>
                                </button>
                            </div>
                        </div>

                        {/* Deal Selection (only for client meetings) */}
                        {meetingType === 'client' && (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Сделка <span className="text-red-500">*</span></label>
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

                        {/* Title */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Тема встречи</label>
                            <input 
                                required 
                                type="text" 
                                value={title} 
                                onChange={e => setTitle(e.target.value)} 
                                className="w-full bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-[#444] rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                                placeholder={meetingType === 'client' ? 'Например: Презентация проекта' : 'Например: Еженедельная планерка'}
                            />
                        </div>
                        
                        {/* Date & Time */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Дата</label>
                                <input 
                                    required 
                                    type="date" 
                                    value={normalizeDateForInput(date) || date} 
                                    onChange={e => setDate(e.target.value)} 
                                    className="w-full bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-[#444] rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Время</label>
                                <input 
                                    required 
                                    type="time" 
                                    value={time} 
                                    onChange={e => setTime(e.target.value)} 
                                    className="w-full bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-[#444] rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Recurrence (only for work meetings) */}
                        {meetingType === 'work' && (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Повторение</label>
                                <TaskSelect
                                    value={recurrence}
                                    onChange={(val) => setRecurrence(val as any)}
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

                        {/* Participants */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Участники</label>
                            <div className="border border-gray-200 dark:border-[#444] rounded-lg max-h-48 overflow-y-auto custom-scrollbar bg-white dark:bg-[#1e1e1e] divide-y divide-gray-100 dark:divide-[#333]">
                                {users.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-gray-400 dark:text-gray-500">Нет сотрудников</div>
                                ) : (
                                    users.map(u => {
                                        const isSelected = selectedParticipants.includes(u.id);
                                        return (
                                            <div 
                                                key={u.id}
                                                onClick={() => toggleParticipant(u.id)}
                                                className={`flex items-center gap-3 p-3 cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-[#2a2a2a] ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500' : ''}`}
                                            >
                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-[#252525]'}`}>
                                                    {isSelected && <Check size={12} className="text-white" />}
                                                </div>
                                                <img src={u.avatar} className="w-8 h-8 rounded-full border-2 border-gray-200 dark:border-[#444] object-cover object-center" alt={u.name} />
                                                <span className={`text-sm font-medium ${isSelected ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}>{u.name}</span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer - стандартизированный дизайн */}
                    <div className="p-4 border-t border-gray-100 dark:border-[#333] bg-white dark:bg-[#252525] flex justify-between items-center shrink-0">
                        <div className="flex gap-2 ml-auto">
                            <button 
                                type="button" 
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#303030] rounded-lg"
                            >
                                Отмена
                            </button>
                            <button 
                                type="submit" 
                                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-2"
                            >
                                {editingMeeting ? 'Сохранить' : 'Создать встречу'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default MeetingsView;
