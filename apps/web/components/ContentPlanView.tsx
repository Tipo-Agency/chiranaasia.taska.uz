
import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ContentPost, Task, TableCollection, ShootPlan, User } from '../types';
import { ShootPlansPanel } from './ShootPlansPanel';
import { Calendar, X, FileText as FileTextIcon, Send, Youtube, Video, Image, FileText, Clock, List, LayoutGrid, KanbanSquare, Linkedin, Check, CheckSquare, ChevronLeft, ChevronRight, Trash2, Edit2, Instagram, CheckSquare2, Save, RefreshCw, MoreVertical } from 'lucide-react';
import {
  ModulePageShell,
  ModuleSegmentedControl,
  MODULE_PAGE_GUTTER,
  ModuleCreateIconButton,
  APP_TOOLBAR_MODULE_CLUSTER,
  MODULE_ACCENTS,
} from './ui';
import { useAppToolbar } from '../contexts/AppToolbarContext';
import { TaskSelect } from './TaskSelect';
import { api } from '../backend/api';
import { normalizeDateForInput } from '../utils/dateUtils';
import { DateInput } from './ui/DateInput';

interface ContentPlanViewProps {
  posts: ContentPost[];
  tableId: string;
  tasks?: Task[];
  activeTable?: TableCollection;
  users?: User[];
  shootPlans?: ShootPlan[];
  onSavePost: (post: ContentPost) => void;
  onDeletePost: (id: string) => void;
  onSaveShootPlan?: (plan: ShootPlan) => void;
  onDeleteShootPlan?: (id: string) => void;
  onOpenTask?: (task: Task) => void;
  onCreateTask?: (task: Partial<Task>) => void;
}

const ContentPlanView: React.FC<ContentPlanViewProps> = ({ 
    posts, tableId, tasks = [], 
    activeTable,
    users = [],
    shootPlans = [],
    onSavePost, onDeletePost, 
    onSaveShootPlan,
    onDeleteShootPlan,
    onOpenTask, onCreateTask 
}) => {
  const { setLeading, setModule } = useAppToolbar();
  const [viewMode, setViewMode] = useState<'calendar' | 'table' | 'kanban' | 'gantt' | 'tasks' | 'shoots'>('calendar');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<ContentPost | null>(null);
  /** Фильтр по формату в календаре: пост / рилс / сторис и т.д. */
  const [formatFilter, setFormatFilter] = useState<ContentPost['format'] | 'all'>('all');
  /** Открытое контекстное меню поста в календаре (id поста или null) */
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);
  const postMenuAnchorRef = useRef<{ post: ContentPost; x: number; y: number } | null>(null);
  const postMenuDropdownRef = useRef<HTMLDivElement>(null);

  // Calendar Navigation State
  const [currentDate, setCurrentDate] = useState(new Date());

  // Form State
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [platform, setPlatform] = useState<string[]>(['instagram']);
  const [format, setFormat] = useState<ContentPost['format']>('post');
  const [status, setStatus] = useState<ContentPost['status']>('idea');
  const [copy, setCopy] = useState('');
  const initialValuesRef = useRef<{
    topic: string;
    description: string;
    date: string;
    platform: string[];
    format: ContentPost['format'];
    status: ContentPost['status'];
    copy: string;
  } | null>(null);

  // Initialize date for form
  useEffect(() => {
      if (!date) setDate(new Date().toISOString().split('T')[0]);
  }, []);

  // Обновление данных из backend API
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshData = async () => {
      if (isRefreshing) return; // Предотвращаем параллельные обновления
      setIsRefreshing(true);
      try {
          // Данные загружаются из backend API через api.*.getAll()
          // Отправляем событие для обновления данных в родительском компоненте
          window.dispatchEvent(new CustomEvent('contentPlanSync'));
      } catch (error) {
          console.error('Ошибка обновления контент-плана:', error);
      } finally {
          setIsRefreshing(false);
      }
  };

  useEffect(() => {
      // Обновление данных при монтировании
      refreshData();

      // Периодическое обновление каждые 15 секунд
      const interval = setInterval(refreshData, 15000);

      // Обновление при фокусе на окне
      const handleFocus = () => {
          refreshData();
      };
      window.addEventListener('focus', handleFocus);

      return () => {
          clearInterval(interval);
          window.removeEventListener('focus', handleFocus);
      };
  }, [tableId]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ tableId?: string }>).detail;
      if (detail?.tableId && detail.tableId !== tableId) return;
      setViewMode('shoots');
    };
    window.addEventListener('openContentPlanShoots', handler as EventListener);
    return () => window.removeEventListener('openContentPlanShoots', handler as EventListener);
  }, [tableId]);

  // DnD State
  const [draggedPostId, setDraggedPostId] = useState<string | null>(null);

  // Filter posts strictly by current table ID (исключаем архивные)
  const filteredPosts = posts
    .filter(p => p.tableId === tableId && !p.isArchived)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  /** Для календаря: дополнительный фильтр по формату (пост / рилс / сторис и т.д.) */
  const filteredPostsByFormat =
    formatFilter === 'all'
      ? filteredPosts
      : filteredPosts.filter(p => p.format === formatFilter);

  const handleOpenCreate = useCallback(() => {
      setEditingPost(null);
      const newDate = new Date().toISOString().split('T')[0];
      setTopic('');
      setDescription('');
      setDate(newDate);
      setPlatform(['instagram']);
      setFormat('post');
      setStatus('idea');
      setCopy('');
      initialValuesRef.current = {
        topic: '',
        description: '',
        date: newDate,
        platform: ['instagram'],
        format: 'post',
        status: 'idea',
        copy: ''
      };
      setIsModalOpen(true);
  }, []);

  useLayoutEffect(() => {
    setLeading(
      <ModuleSegmentedControl
        size="sm"
        variant="accent"
        accent="indigo"
        value={viewMode}
        onChange={setViewMode}
        options={[
          { value: 'calendar', label: 'Календарь' },
          { value: 'table', label: 'Список' },
          { value: 'kanban', label: 'Доска' },
          { value: 'gantt', label: 'Таймлайн' },
          { value: 'tasks', label: 'Задачи' },
          { value: 'shoots', label: 'Съёмки' },
        ]}
      />
    );
    setModule(
      <div className={APP_TOOLBAR_MODULE_CLUSTER}>
        <button
          type="button"
          onClick={refreshData}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium hover:bg-gray-50 dark:hover:bg-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed"
          title="Обновить данные"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          {isRefreshing ? '…' : 'Обновить'}
        </button>
        <ModuleCreateIconButton accent="slate" label="Новый пост" onClick={handleOpenCreate} />
      </div>
    );
    return () => {
      setLeading(null);
      setModule(null);
    };
  }, [viewMode, isRefreshing, setLeading, setModule, handleOpenCreate]);

  /** Создать пост/рилс по клику на пустую ячейку календаря с предзаполненной датой */
  const handleCreateForDate = (dateString: string) => {
    setEditingPost(null);
    setTopic('');
    setDescription('');
    setDate(dateString);
    setPlatform(['instagram']);
    setFormat('post');
    setStatus('idea');
    setCopy('');
    initialValuesRef.current = {
      topic: '',
      description: '',
      date: dateString,
      platform: ['instagram'],
      format: 'post',
      status: 'idea',
      copy: ''
    };
    setIsModalOpen(true);
  };

  const handleOpenEdit = (post: ContentPost) => {
      setEditingPost(post);
      const postPlatform = Array.isArray(post.platform) ? post.platform : [post.platform as any];
      setTopic(post.topic);
      setDescription(post.description || '');
      setDate(normalizeDateForInput(post.date) || '');
      setPlatform(postPlatform);
      setFormat(post.format);
      setStatus(post.status);
      setCopy(post.copy || '');
      initialValuesRef.current = {
        topic: post.topic,
        description: post.description || '',
        date: post.date,
        platform: postPlatform,
        format: post.format,
        status: post.status,
        copy: post.copy || ''
      };
      setIsModalOpen(true);
  };

  const hasChanges = (): boolean => {
    if (!initialValuesRef.current) return false;
    const initial = initialValuesRef.current;
    return (
      initial.topic !== topic ||
      initial.description !== description ||
      initial.date !== date ||
      JSON.stringify([...initial.platform].sort()) !== JSON.stringify([...platform].sort()) ||
      initial.format !== format ||
      initial.status !== status ||
      initial.copy !== copy
    );
  };

  const handleSubmit = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (platform.length === 0) return alert("Выберите хотя бы одну площадку");
      if (!date) return alert("Выберите дату");
      
      // Нормализуем дату - берем только часть до 'T' (YYYY-MM-DD)
      const normalizedDate = date.split('T')[0];
      
      const newPost: ContentPost = {
          id: editingPost ? editingPost.id : `cp-${Date.now()}`,
          tableId,
          topic,
          description: description || undefined,
          date: normalizedDate,
          platform,
          format,
          status,
          copy: copy || undefined
      };
      onSavePost(newPost);
      initialValuesRef.current = {
        topic,
        description,
        date,
        platform,
        format,
        status,
        copy
      };
      setIsModalOpen(false);
  };

  const handleDelete = () => {
      if (editingPost) {
          onDeletePost(editingPost.id);
          setIsModalOpen(false);
      }
  };

  const handleCreateLinkedTask = () => {
      if (onCreateTask && editingPost) {
          onCreateTask({
              entityType: 'task',
              title: `Контент: ${editingPost.topic}`,
              contentPostId: editingPost.id,
              source: activeTable?.name || 'Контент-план',
              createdAt: new Date().toISOString(),
              createdByUserId: undefined // Будет установлен в useTaskLogic из currentUser
          });
      }
  };

  const handleCreateTask = () => {
      if (onCreateTask) {
          onCreateTask({
              entityType: 'task',
              source: activeTable?.name || 'Контент-план',
              createdAt: new Date().toISOString(),
              createdByUserId: undefined // Будет установлен в useTaskLogic из currentUser
          });
      }
  };

  // Получаем все задачи, связанные с постами этого контент-плана
  const contentPlanTasks = tasks.filter(t => {
      if (t.contentPostId) {
          return posts.some(p => p.id === t.contentPostId);
      }
      return t.source === (activeTable?.name || 'Контент-план');
  });

  const renderTasks = () => {
      return (
          <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Задачи контент-плана</h2>
              </div>
              
              {contentPlanTasks.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                      <CheckSquare size={48} className="mx-auto mb-4 opacity-50" />
                      <p>Нет задач</p>
                  </div>
              ) : (
                  <div className="space-y-2">
                      {contentPlanTasks.map(task => {
                          const relatedPost = task.contentPostId ? posts.find(p => p.id === task.contentPostId) : null;
                          return (
                              <div 
                                  key={task.id} 
                                  onClick={() => onOpenTask && onOpenTask(task)}
                                  className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
                              >
                                  <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                              <div className={`w-2 h-2 rounded-full ${
                                                  task.status === 'Выполнено' ? 'bg-green-500' : 
                                                  task.priority === 'Высокий' ? 'bg-red-500' :
                                                  task.priority === 'Средний' ? 'bg-yellow-500' : 'bg-gray-400'
                                              }`}></div>
                                              <h3 className="font-medium text-gray-900 dark:text-white">{task.title}</h3>
                                          </div>
                                          {relatedPost && (
                                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                  Пост: {relatedPost.topic}
                                              </p>
                                          )}
                                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                              <span>Статус: {task.status}</span>
                                              <span>Приоритет: {task.priority}</span>
                                              {task.endDate && (
                                                  <span>Срок: {new Date(task.endDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')}</span>
                                              )}
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}
          </div>
      );
  };

  const togglePlatform = (p: string) => {
      if (platform.includes(p)) {
          setPlatform(platform.filter(item => item !== p));
      } else {
          setPlatform([...platform, p]);
      }
  };

  // DnD Handlers
  const onDragStart = (e: React.DragEvent, postId: string) => { setDraggedPostId(postId); e.dataTransfer.effectAllowed = 'move'; };
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const onDrop = (e: React.DragEvent, targetValue: string, type: 'date' | 'status') => { 
      e.preventDefault(); 
      if (draggedPostId) { 
          const post = posts.find(p => p.id === draggedPostId); 
          if (post) { 
              if (type === 'date' && post.date !== targetValue) onSavePost({ ...post, date: targetValue }); 
              else if (type === 'status' && post.status !== targetValue) onSavePost({ ...post, status: targetValue as any }); 
          } 
          setDraggedPostId(null); 
      } 
  };
  
  const getPlatformIcon = (p: string) => {
      switch (p) {
          case 'instagram': return <Instagram size={14} className="text-slate-600 dark:text-slate-300" />;
          case 'telegram': return <Send size={14} className="text-slate-600 dark:text-slate-300" />;
          case 'youtube': return <Youtube size={14} className="text-slate-600 dark:text-slate-300" />;
          case 'vk': return <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">VK</span>;
          case 'linkedin': return <Linkedin size={14} className="text-slate-600 dark:text-slate-300" />;
          default: return <Send size={14} className="text-slate-600 dark:text-slate-300" />;
      }
  };
  
  const renderPlatformIcons = (platforms: string | string[]) => { 
      const arr = Array.isArray(platforms) ? platforms : [platforms]; 
      return (<div className="flex -space-x-1">{arr.map(p => (<div key={p} className="bg-white dark:bg-[#303030] rounded-full p-0.5 border border-gray-100 dark:border-gray-600">{getPlatformIcon(p)}</div>))}</div>); 
  };
  
  const getFormatLabel = (f: string) => {
    switch (f) {
      case 'reel': return 'Reels';
      case 'post': return 'Пост';
      case 'story': return 'Stories';
      case 'article': return 'Статья';
      case 'video': return 'Видео';
      default: return f;
    }
  };
  const getFormatIcon = (f: string) => {
    switch (f) {
      case 'reel': return <Video size={12} className="text-slate-500 dark:text-slate-300 shrink-0" />;
      case 'story': return <Image size={12} className="text-slate-500 dark:text-slate-300 shrink-0" />;
      case 'article': return <FileText size={12} className="text-slate-500 dark:text-slate-300 shrink-0" />;
      case 'video': return <Video size={12} className="text-slate-500 dark:text-slate-300 shrink-0" />;
      default: return <FileTextIcon size={12} className="text-slate-500 dark:text-slate-300 shrink-0" />;
    }
  };
  const getStatusColor = (s: string) => {
    switch (s) {
      case 'idea':
        return 'border-gray-200 bg-gray-50 dark:bg-[#2a2a2a] dark:border-[#444]';
      case 'published':
        return 'border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-800/60';
      default:
        return 'border-slate-200 bg-slate-50/60 dark:bg-slate-900/25 dark:border-slate-700/60';
    }
  };
  const getStatusLabel = (s: string) => { switch (s) { case 'idea': return 'Идея'; case 'copywriting': return 'Копирайтинг'; case 'design': return 'Дизайн'; case 'approval': return 'Согласование'; case 'scheduled': return 'План'; case 'published': return 'Готово'; default: return s; } };

  const statuses: ContentPost['status'][] = ['idea', 'copywriting', 'design', 'approval', 'scheduled', 'published'];

  useEffect(() => {
    if (!openMenuPostId) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (postMenuDropdownRef.current?.contains(target)) return;
      const trigger = document.querySelector('[data-post-menu-trigger]');
      if (trigger?.contains(target)) return;
      setOpenMenuPostId(null);
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [openMenuPostId]);

  const handleBackdropClick = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
          if (hasChanges()) {
              if (window.confirm("Есть несохраненные изменения. Сохранить перед выходом?")) {
                  handleSubmit();
              } else {
                  setIsModalOpen(false);
              }
          } else {
              setIsModalOpen(false);
          }
      }
  };

  const handleClose = () => {
      if (hasChanges()) {
          if (window.confirm("Есть несохраненные изменения. Сохранить перед выходом?")) {
              handleSubmit();
          } else {
              setIsModalOpen(false);
          }
      } else {
          setIsModalOpen(false);
      }
  };

  const changeMonth = (delta: number) => {
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() + delta);
      setCurrentDate(newDate);
  };

  // --- GANTT RENDERER ---
  const renderGantt = () => {
      const timestamps = filteredPosts.map(p => new Date(p.date).getTime()).filter(t => !isNaN(t));
      let minTime = timestamps.length ? Math.min(...timestamps) : new Date().getTime();
      let maxTime = timestamps.length ? Math.max(...timestamps) : new Date().getTime();
      
      // Add buffer
      minTime -= 7 * 24 * 60 * 60 * 1000;
      maxTime += 14 * 24 * 60 * 60 * 1000;
      
      const startDate = new Date(minTime);
      const endDate = new Date(maxTime);
      const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24);

      const months = [];
      const curr = new Date(startDate);
      curr.setDate(1);
      while (curr < endDate) {
          months.push({ name: curr.toLocaleString('ru-RU', { month: 'short' }), year: curr.getFullYear() });
          curr.setMonth(curr.getMonth() + 1);
      }

      const getPosition = (dateStr: string) => {
          const d = new Date(dateStr);
          const diff = (d.getTime() - startDate.getTime()) / (1000 * 3600 * 24);
          return Math.max(0, Math.min(100, (diff / totalDays) * 100));
      };

      const platforms = ['instagram', 'telegram', 'vk', 'youtube', 'linkedin'];
      const groupedPosts = platforms.map(plat => ({
          platform: plat,
          posts: filteredPosts.filter(p => p.platform.includes(plat))
      })).filter(g => g.posts.length > 0);

      return (
        <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="flex border-b border-gray-200 dark:border-[#333] h-10 bg-gray-50 dark:bg-[#252525] shrink-0">
                <div className="w-48 border-r border-gray-200 dark:border-[#333] shrink-0 p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase flex items-center bg-gray-50 dark:bg-[#252525] z-20">
                    Площадка
                </div>
                <div className="flex-1 flex relative overflow-hidden">
                    {months.map((m, i) => (
                        <div key={i} className="flex-1 border-l border-gray-200 dark:border-[#333] text-xs text-gray-500 dark:text-gray-400 p-2 font-medium text-center uppercase">
                            {m.name} {m.year}
                        </div>
                    ))}
                </div>
            </div>

            <div className="overflow-y-auto flex-1 pb-20 custom-scrollbar relative">
                <div className="absolute inset-0 flex pointer-events-none pl-48">
                    {months.map((_, i) => (
                        <div key={i} className="flex-1 border-l border-dashed border-gray-100 dark:border-[#2a2a2a] h-full"></div>
                    ))}
                </div>

                {groupedPosts.map(group => (
                    <div key={group.platform} className="relative">
                        <div className="bg-gray-50/90 dark:bg-[#252525]/90 backdrop-blur px-3 py-1.5 text-[10px] uppercase font-bold text-gray-600 dark:text-gray-300 sticky top-0 border-b border-gray-100 dark:border-[#333] z-10 flex items-center gap-2">
                            {getPlatformIcon(group.platform)} {group.platform}
                        </div>
                        {group.posts.map(post => {
                            const left = getPosition(post.date);
                            const width = 2; 
                            return (
                                <div key={post.id} className="flex h-8 hover:bg-blue-50/30 dark:hover:bg-[#2a2a2a] border-b border-gray-50 dark:border-[#2a2a2a] group relative">
                                    <div 
                                        className="w-48 border-r border-gray-200 dark:border-[#333] shrink-0 px-3 text-xs truncate text-gray-700 dark:text-gray-300 flex items-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 bg-white dark:bg-[#1e1e1e] z-10"
                                        onClick={() => handleOpenEdit(post)}
                                    >
                                        {post.topic}
                                    </div>
                                    <div className="flex-1 relative flex items-center my-1 pr-4">
                                        <div 
                                            onClick={() => handleOpenEdit(post)}
                                            className={`absolute h-5 rounded-md border cursor-pointer transition-all shadow-sm flex items-center justify-center z-0 ${getStatusColor(post.status)}`}
                                            style={{ left: `${left}%`, width: `${width}%`, minWidth: '24px' }}
                                            title={`${post.topic} (${new Date(post.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')})`}
                                        >
                                           <div className="w-1.5 h-1.5 rounded-full bg-current opacity-50"></div>
                                        </div>
                                        <div style={{ left: `calc(${left}% + 30px)` }} className="absolute text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[200px] pointer-events-none">
                                            {post.topic}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
                
                {filteredPosts.length === 0 && (
                    <div className="p-12 text-center text-gray-400 dark:text-gray-600 text-sm">
                        Нет постов для отображения на таймлайне
                    </div>
                )}
            </div>
        </div>
      );
  };

  const renderCalendar = () => {
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); 
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1; 
    
    const calendarCells = [];
    for (let i = 0; i < startOffset; i++) calendarCells.push(null);
    for (let i = 1; i <= daysInMonth; i++) calendarCells.push(i);

    return (
        <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="bg-gray-50 dark:bg-[#252525] p-3 border-b border-gray-200 dark:border-[#333] flex justify-between items-center shrink-0">
                 <div className="flex items-center gap-4">
                     <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-200 dark:hover:bg-[#333] rounded"><ChevronLeft size={20} className="text-gray-600 dark:text-gray-400"/></button>
                     <h2 className="font-bold text-gray-800 dark:text-white uppercase tracking-wide text-sm text-center">
                         {currentDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}
                     </h2>
                     <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-200 dark:hover:bg-[#333] rounded"><ChevronRight size={20} className="text-gray-600 dark:text-gray-400"/></button>
                 </div>
                 <button onClick={() => setCurrentDate(new Date())} className="text-xs font-medium text-blue-600 hover:underline">Сегодня</button>
            </div>

            {/* Фильтр по формату: пост / рилс / сторис и т.д. */}
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#252525] shrink-0">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Формат:</span>
              {(['all', 'post', 'reel', 'story', 'article', 'video'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormatFilter(f)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    formatFilter === f
                      ? MODULE_ACCENTS.indigo.navIconActive
                      : 'bg-white dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#333] border border-gray-200 dark:border-[#333]'
                  }`}
                >
                  {f === 'all' ? 'Все' : getFormatLabel(f)}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-7 bg-gray-50 dark:bg-[#252525] border-b border-gray-200 dark:border-[#333] text-center text-xs font-bold text-gray-500 dark:text-gray-400 py-2 shrink-0">
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => <div key={d}>{d}</div>)}
            </div>

            <div className="grid grid-cols-7 bg-white dark:bg-[#1e1e1e] flex-1 overflow-y-auto custom-scrollbar">
                {calendarCells.map((day, idx) => {
                    let dateString = '';
                    if (day) {
                        const m = (currentMonth + 1).toString().padStart(2, '0');
                        const d = day.toString().padStart(2, '0');
                        dateString = `${currentYear}-${m}-${d}`;
                    }

                    const dayPosts = day ? filteredPostsByFormat.filter(p => {
                        const postDate = p.date.split('T')[0];
                        return postDate === dateString;
                    }) : [];

                    const handleCellClick = (e: React.MouseEvent) => {
                      if (!day) return;
                      const target = e.target as HTMLElement;
                      if (target.closest('[data-post-card]')) return;
                      handleCreateForDate(dateString);
                    };

                    return (
                        <div
                            key={idx}
                            role="button"
                            tabIndex={0}
                            onClick={handleCellClick}
                            onKeyDown={(e) => { if (day && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleCreateForDate(dateString); } }}
                            className={`min-h-[100px] border-r border-b border-gray-100 dark:border-[#333] p-1 transition-colors cursor-pointer ${!day ? 'bg-gray-50/30 dark:bg-[#151515] cursor-default' : 'hover:bg-gray-50 dark:hover:bg-[#252525]'}`}
                            {...(day
                                ? {
                                      onDragOver,
                                      onDrop: (e: React.DragEvent) => onDrop(e, dateString, 'date'),
                                  }
                                : {})}
                        >
                            {day && (
                                <>
                                  <div className="text-right text-xs text-gray-400 mb-1 mr-1">{day}</div>
                                  <div className="space-y-1">
                                      {dayPosts.map(post => (
                                          <div
                                            data-post-card
                                            key={post.id}
                                            onClick={(e) => { e.stopPropagation(); handleOpenEdit(post); }}
                                            draggable
                                            onDragStart={(e) => onDragStart(e, post.id)}
                                            className={`p-1.5 rounded border text-[10px] cursor-pointer shadow-sm hover:shadow-md transition-all group/card ${getStatusColor(post.status)}`}
                                          >
                                              <div className="flex items-center justify-between gap-1 mb-1">
                                                  <div className="flex items-center gap-1 min-w-0">
                                                      {getFormatIcon(post.format)}
                                                      {renderPlatformIcons(post.platform)}
                                                      <span className="font-bold opacity-80 text-gray-700 dark:text-gray-300 truncate">{getFormatLabel(post.format)}</span>
                                                  </div>
                                                  <button
                                                    data-post-menu-trigger
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                      postMenuAnchorRef.current = { post, x: rect.left, y: rect.bottom };
                                                      setOpenMenuPostId(post.id);
                                                    }}
                                                    className="opacity-0 group-hover/card:opacity-100 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-opacity"
                                                  >
                                                    <MoreVertical size={14} className="text-gray-500 dark:text-gray-400" />
                                                  </button>
                                              </div>
                                              <div className="line-clamp-2 leading-tight font-medium text-gray-800 dark:text-gray-200">{post.topic}</div>
                                          </div>
                                      ))}
                                  </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Портал: меню смены статуса / удаления поста в календаре */}
            {typeof document !== 'undefined' && openMenuPostId && postMenuAnchorRef.current && postMenuAnchorRef.current.post.id === openMenuPostId && createPortal(
              <div
                ref={postMenuDropdownRef}
                className="fixed bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg shadow-xl z-[9999] py-1 min-w-[160px]"
                style={{ top: postMenuAnchorRef.current.y + 4, left: postMenuAnchorRef.current.x }}
              >
                <div className="px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-[#333]">Статус</div>
                {statuses.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      onSavePost({ ...postMenuAnchorRef.current!.post, status: s });
                      setOpenMenuPostId(null);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-[#333]"
                  >
                    {getStatusLabel(s)}
                  </button>
                ))}
                <div className="border-t border-gray-100 dark:border-[#333] mt-1 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (postMenuAnchorRef.current?.post.id) onDeletePost(postMenuAnchorRef.current.post.id);
                      setOpenMenuPostId(null);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                  >
                    <Trash2 size={12} /> Удалить
                  </button>
                </div>
              </div>,
              document.body
            )}
        </div>
    );
  };

  const renderTable = () => (
      <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-[#252525] border-b border-gray-200 dark:border-[#333] sticky top-0 z-10">
                    <tr>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 w-32">Дата</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Тема</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 w-32">Площадка</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 w-24">Формат</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 w-32">Статус</th>
                        <th className="px-4 py-3 w-10"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
                    {filteredPosts.map(post => (
                        <tr key={post.id} onClick={() => handleOpenEdit(post)} className="hover:bg-gray-50 dark:hover:bg-[#2a2a2a] cursor-pointer group transition-colors">
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                              {new Date(post.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')}
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{post.topic}</td>
                            <td className="px-4 py-3">{renderPlatformIcons(post.platform)}</td>
                            <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{getFormatLabel(post.format)}</td>
                            <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-[10px] uppercase font-bold border ${getStatusColor(post.status)}`}>{getStatusLabel(post.status)}</span></td>
                            <td className="px-4 py-3 text-right">
                                <button onClick={(e) => { e.stopPropagation(); onDeletePost(post.id); }} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={14}/></button>
                            </td>
                        </tr>
                    ))}
                    {filteredPosts.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400 dark:text-gray-500">Постов нет</td></tr>}
                </tbody>
            </table>
          </div>
      </div>
  );

  const renderKanban = () => {
      const statuses: ContentPost['status'][] = ['idea', 'copywriting', 'design', 'approval', 'scheduled', 'published'];
      return (
        <div className="flex h-full overflow-x-auto gap-4 pb-4">
            {statuses.map(s => (
                <div 
                    key={s} 
                    className="w-72 flex-shrink-0 flex flex-col bg-gray-50/50 dark:bg-[#1e1e1e] rounded-lg border border-gray-200 dark:border-[#333]"
                    onDragOver={onDragOver}
                    onDrop={(e) => onDrop(e, s, 'status')}
                >
                    <div className="p-3 font-bold text-sm text-gray-700 dark:text-gray-200 uppercase flex justify-between">
                        {getStatusLabel(s)} 
                        <span className="bg-gray-200 dark:bg-[#333] px-2 rounded text-xs">{filteredPosts.filter(p => p.status === s).length}</span>
                    </div>
                    <div className="p-2 flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                        {filteredPosts.filter(p => p.status === s).map(post => (
                            <div 
                                key={post.id} 
                                draggable
                                onDragStart={(e) => onDragStart(e, post.id)}
                                onClick={() => handleOpenEdit(post)} 
                                className={`p-3 rounded shadow-sm border cursor-grab active:cursor-grabbing hover:shadow-md transition-all bg-white dark:bg-[#2b2b2b] border-gray-200 dark:border-[#3a3a3a]`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="text-[10px] font-bold opacity-60 text-gray-500">{new Date(post.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')}</div>
                                    {renderPlatformIcons(post.platform)}
                                </div>
                                <div className="font-medium text-sm text-gray-800 dark:text-gray-100 mb-2 line-clamp-2">{post.topic}</div>
                                <div className="text-[10px] bg-gray-100 dark:bg-[#333] text-gray-500 px-1.5 py-0.5 rounded w-fit font-medium">{getFormatLabel(post.format)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
      );
  };

  return (
    <ModulePageShell>
      <div className={`${MODULE_PAGE_GUTTER} pt-4 md:pt-6 pb-3 flex-shrink-0`}>
        <div className="space-y-2">
          <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:border-[#333] dark:bg-[#1a1a1a] dark:text-gray-300">
            <span className="font-medium">Публичная ссылка:</span>
            <span className="truncate">{`${window.location.origin}/content-plan/${tableId}`}</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/content-plan/${tableId}`);
                alert('Ссылка скопирована!');
              }}
              className="font-bold hover:opacity-80 shrink-0"
            >
              Копировать
            </button>
          </div>
          {activeTable?.type === 'content-plan' && activeTable.isPublic === false && (
            <p className="text-xs text-amber-700 dark:text-amber-400 max-w-xl">
              Публичный просмотр выключен. Включите «Публичная ссылка» в настройках страницы (шестерёнка на карточке в «Пространствах»).
            </p>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
        <div className={`${MODULE_PAGE_GUTTER} pb-16 md:pb-20`}>
          {viewMode === 'calendar' && renderCalendar()}
          {viewMode === 'table' && renderTable()}
          {viewMode === 'shoots' && onSaveShootPlan && onDeleteShootPlan && (
            <ShootPlansPanel
              tableId={tableId}
              posts={posts}
              users={users}
              shootPlans={shootPlans}
              onSave={onSaveShootPlan}
              onDelete={onDeleteShootPlan}
            />
          )}
          {viewMode === 'kanban' && renderKanban()}
          {viewMode === 'gantt' && renderGantt()}
          {viewMode === 'tasks' && renderTasks()}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200" onClick={handleBackdropClick}>
            <div className="bg-white dark:bg-[#252525] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-[#333] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center bg-white dark:bg-[#252525] shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg text-blue-600 dark:text-blue-400">
                            <FileText size={20} />
                        </div>
                        <h3 className="font-bold text-lg text-gray-800 dark:text-white">{editingPost ? 'Редактировать пост' : 'Новый пост'}</h3>
                    </div>
                    <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#333] transition-colors"><X size={20} /></button>
                </div>
                
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-6 space-y-6">
                        {/* Date Input - First Field */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Дата публикации <span className="text-red-500">*</span></label>
                            <DateInput
                              required
                              value={normalizeDateForInput(date) || date}
                              onChange={setDate}
                              className="w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Тема / Заголовок <span className="text-red-500">*</span></label>
                            <input 
                                required 
                                value={topic} 
                                onChange={e => setTopic(e.target.value)} 
                                className="w-full bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-[#555] rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                                placeholder="О чем пост?"
                                autoFocus
                            />
                        </div>
                    
                    {/* TASKS SECTION */}
                    {editingPost && (
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase flex items-center gap-2"><CheckSquare size={14}/> Задачи по контенту</label>
                                <button type="button" onClick={handleCreateLinkedTask} className="text-blue-600 dark:text-blue-400 text-xs font-bold hover:underline">+ Добавить задачу</button>
                            </div>
                            <div className="space-y-1">
                                {tasks.filter(t => t.contentPostId === editingPost.id).length === 0 ? (
                                    <div className="text-xs text-blue-400 dark:text-blue-500 italic">Нет задач</div>
                                ) : (
                                    tasks.filter(t => t.contentPostId === editingPost.id).map(t => (
                                        <div key={t.id} onClick={() => onOpenTask && onOpenTask(t)} className="flex items-center gap-2 bg-white dark:bg-[#252525] p-2 rounded border border-blue-100 dark:border-blue-900/30 cursor-pointer hover:border-blue-300 group">
                                            <div className={`w-3 h-3 rounded-full border ${t.status === 'Выполнено' ? 'bg-green-500 border-green-500' : 'border-gray-400'}`}></div>
                                            <span className={`text-xs text-gray-700 dark:text-gray-300 ${t.status === 'Выполнено' ? 'line-through opacity-50' : ''}`}>{t.title}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                    

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Площадки</label>
                            <div className="flex gap-2 flex-wrap">
                                {['instagram', 'telegram', 'vk', 'youtube'].map(p => { 
                                    const isSelected = platform.includes(p); 
                                    return (
                                        <div key={p} onClick={() => togglePlatform(p)} className={`p-2 rounded-lg border cursor-pointer transition-all flex items-center justify-center ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-[#444] hover:bg-gray-50 dark:hover:bg-[#252525]'}`}>
                                            {getPlatformIcon(p)}
                                        </div>
                                    ); 
                                })}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Формат</label>
                            <div className="relative">
                                <TaskSelect
                                    value={format}
                                    onChange={(val) => setFormat(val as any)}
                                    options={[
                                        { value: 'post', label: 'Пост' },
                                        { value: 'reel', label: 'Reels' },
                                        { value: 'story', label: 'Stories' },
                                        { value: 'article', label: 'Статья' }
                                    ]}
                                    className="w-full bg-gray-50 dark:bg-[#252525]"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Статус</label>
                        <div className="relative">
                            <TaskSelect
                                value={status}
                                onChange={(val) => setStatus(val as any)}
                                options={[
                                    { value: 'idea', label: 'Идея' },
                                    { value: 'copywriting', label: 'Копирайтинг' },
                                    { value: 'design', label: 'Дизайн' },
                                    { value: 'approval', label: 'Согласование' },
                                    { value: 'scheduled', label: 'В плане' },
                                    { value: 'published', label: 'Опубликовано' }
                                ]}
                                className="w-full bg-gray-50 dark:bg-[#252525]"
                            />
                            <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none rotate-90" size={16} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Описание поста</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full h-24 bg-gray-50 dark:bg-[#252525] text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-[#444] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="Идея, концепция, описание поста..."/>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Текст поста</label>
                        <textarea value={copy} onChange={e => setCopy(e.target.value)} className="w-full h-32 bg-gray-50 dark:bg-[#252525] text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-[#444] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="Готовый текст для публикации..."/>
                    </div>
                    
                    </div>
                    
                    {/* Footer */}
                    <div className="p-4 border-t border-gray-100 dark:border-[#333] bg-white dark:bg-[#252525] flex justify-between items-center shrink-0">
                        {editingPost && (
                            <button 
                                type="button" 
                                onClick={handleDelete} 
                                className="text-red-500 text-sm font-medium hover:text-red-700 flex items-center gap-2 transition-colors"
                            >
                                <Trash2 size={16} />
                                Удалить
                            </button>
                        )}
                        <div className="flex gap-2 ml-auto">
                            <button 
                                type="button" 
                                onClick={handleClose} 
                                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#303030] rounded-lg transition-colors"
                            >
                                Отмена
                            </button>
                            <button 
                                type="submit" 
                                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-2 transition-colors"
                            >
                                <Save size={16} />
                                Сохранить
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
      )}
    </ModulePageShell>
  );
};

export default ContentPlanView;
