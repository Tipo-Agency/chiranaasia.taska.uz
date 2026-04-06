
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Deal, Client, User, Comment, Task, Project, SalesFunnel, Meeting, NotificationPreferences } from '../types';
import { Plus, KanbanSquare, List as ListIcon, X, Send, MessageSquare, Instagram, Globe, UserPlus, Bot, Edit2, TrendingUp, CheckSquare, CheckCircle2, XCircle, Trash2, Calendar, Clock, Users, Tag, GitBranch, Filter, User as UserIcon } from 'lucide-react';
// Клиентский Telegram/Instagram — при необходимости подключать через api/telegramService.
import { DynamicIcon } from './AppIcons';
import { Button, ModulePageShell, ModulePageHeader, ModuleSegmentedControl, MODULE_PAGE_GUTTER, ModuleCreateIconButton, ModuleSelectDropdown, SystemAlertDialog, SystemConfirmDialog } from './ui';
import { DateInput } from './ui/DateInput';
import { TaskSelect } from './TaskSelect';
import { api } from '../backend/api';
import { isFunnelDeal } from '../utils/dealModel';
import { getFunnelKanbanCardAccent } from '../utils/funnelVisual';
import { devWarn } from '../utils/devLog';

interface SalesFunnelViewProps {
  deals: Deal[];
  clients: Client[];
  users: User[];
  projects?: Project[];
  tasks?: Task[];
  meetings?: Meeting[];
  salesFunnels?: SalesFunnel[];
  onSaveDeal: (deal: Deal) => void;
  onDeleteDeal: (id: string) => void;
  onCreateTask?: (task: Partial<Task>) => void;
  onCreateClient?: (client: Client) => void;
  onOpenTask?: (task: Task) => void;
  onSaveMeeting?: (meeting: Meeting) => void;
  onDeleteMeeting?: (meetingId: string) => void;
  onUpdateMeetingSummary?: (meetingId: string, summary: string) => void;
  autoOpenCreateModal?: boolean; // Автоматически открыть модалку создания
}

const STAGES = [
    { id: 'new', label: 'Новая заявка', color: 'bg-gray-200 dark:bg-gray-700' },
    { id: 'qualification', label: 'Квалификация', color: 'bg-blue-200 dark:bg-blue-900' },
    { id: 'proposal', label: 'Предложение (КП)', color: 'bg-purple-200 dark:bg-purple-900' },
    { id: 'negotiation', label: 'Переговоры', color: 'bg-orange-200 dark:bg-orange-900' },
];

const SalesFunnelView: React.FC<SalesFunnelViewProps> = ({ deals, clients, users, projects = [], tasks = [], meetings = [], salesFunnels = [], currentUser, onSaveDeal, onDeleteDeal, onCreateTask, onCreateClient, onOpenTask, onSaveMeeting, onDeleteMeeting, onUpdateMeetingSummary, autoOpenCreateModal = false }) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'rejected'>('kanban');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [modalTab, setModalTab] = useState<'chat' | 'tasks' | 'meetings'>('chat');

  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState(''); // Просто название клиента, без создания
  const [contactName, setContactName] = useState('');
  const [amount, setAmount] = useState('');
  const [stage, setStage] = useState<any>('new');
  const [source, setSource] = useState<any>('manual');
  const [assigneeId, setAssigneeId] = useState('');
  const [notes, setNotes] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [showTaskDropdown, setShowTaskDropdown] = useState(false);
  const [showCustomTaskInput, setShowCustomTaskInput] = useState(false);
  const [customTaskTitle, setCustomTaskTitle] = useState('');
  const [showCreateMeetingForm, setShowCreateMeetingForm] = useState(false);
  const [newMeetingDate, setNewMeetingDate] = useState('');
  const [newMeetingTime, setNewMeetingTime] = useState('10:00');
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>('all');
  const [funnelId, setFunnelId] = useState<string>('');
  const [dealProjectId, setDealProjectId] = useState<string>(''); // вид услуг (модуль/проект)
  const [defaultFunnelId, setDefaultFunnelId] = useState<string | undefined>(undefined);
  const [alertState, setAlertState] = useState<{ open: boolean; title: string; message: string }>({ open: false, title: '', message: '' });
  const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; message: string; onConfirm?: () => void }>({ open: false, title: '', message: '' });

  const activeFunnels = useMemo(() => salesFunnels.filter((f) => !f.isArchived), [salesFunnels]);
  const selectedFunnelIds = useMemo(() => {
    if (selectedFunnelId === 'all') return activeFunnels.map((f) => f.id);
    return activeFunnels.some((f) => f.id === selectedFunnelId) ? [selectedFunnelId] : activeFunnels.map((f) => f.id);
  }, [selectedFunnelId, activeFunnels]);
  const primaryFunnelId = defaultFunnelId || activeFunnels[0]?.id || salesFunnels[0]?.id || '';

  /** Этапы для канбана — из выбранной воронки в шапке страницы */
  const kanbanStages = useMemo(() => {
    const stageMap = new Map<string, (typeof STAGES)[number]>();
    activeFunnels
      .filter((f) => selectedFunnelIds.includes(f.id))
      .forEach((f) => {
        (f.stages || []).forEach((s) => {
          if (!stageMap.has(s.id)) stageMap.set(s.id, s);
        });
      });

    const stages = Array.from(stageMap.values());
    if (stages.length) return stages as any;

    // Фолбэк, если выбранная комбинация воронок без стадий
    return STAGES.map((s) => ({ id: s.id, label: s.label, color: s.color }));
  }, [activeFunnels, salesFunnels, selectedFunnelIds]);

  // Подсказка: к какой воронке принадлежит stage.id (используем для открытия/дропа в канбане)
  const stageToFunnelId = useMemo(() => {
    const map = new Map<string, string>();
    activeFunnels.forEach((f) => {
      (f.stages || []).forEach((s) => {
        map.set(s.id, f.id);
      });
    });
    return map;
  }, [activeFunnels]);

  // Получаем основную воронку из настроек
  useEffect(() => {
    const loadDefaultFunnel = async () => {
      try {
        const notificationPrefs = (await api.notificationPrefs.get()) as NotificationPreferences;
        const defaultId = notificationPrefs?.defaultFunnelId;
        setDefaultFunnelId(defaultId);
      } catch (error) {
        console.error('Error loading default funnel:', error);
      }
    };
    if (salesFunnels.length > 0) {
      loadDefaultFunnel();
    }
  }, [salesFunnels]);

  // По умолчанию выбираем ВСЕ активные воронки (чтобы "основная воронка" в настройках была не нужна для фильтра)
  useEffect(() => {
    if (!activeFunnels.length) return;
    setSelectedFunnelId((prev) => (prev && (prev === 'all' || activeFunnels.some((f) => f.id === prev)) ? prev : 'all'));
  }, [activeFunnels]);

  // Автоматически открываем модалку создания при монтировании, если autoOpenCreateModal = true
  useEffect(() => {
    if (autoOpenCreateModal) {
      handleOpenCreate();
    }
  }, [autoOpenCreateModal]);

  // Слушаем событие для открытия модалки с рабочего стола (WorkdeskView)
  useEffect(() => {
    const handleOpenModal = () => {
      handleOpenCreate();
    };
    window.addEventListener('openCreateDealModal', handleOpenModal);
    return () => window.removeEventListener('openCreateDealModal', handleOpenModal);
  }, []);

  const funnelDeals = useMemo(() => deals.filter((d) => !d.isArchived && isFunnelDeal(d)), [deals]);

  // Открытие сделки из контекста чата
  useEffect(() => {
    const handleOpenDealById = (event: Event) => {
      const custom = event as CustomEvent<{ dealId?: string }>;
      const dealId = custom.detail?.dealId;
      if (!dealId) return;
      const target = funnelDeals.find((d) => d.id === dealId);
      if (!target) return;
      if (target.funnelId && selectedFunnelId !== 'all') setSelectedFunnelId(String(target.funnelId));
      handleOpenEdit(target);
    };
    window.addEventListener('openDealFromChat', handleOpenDealById as EventListener);
    return () => window.removeEventListener('openDealFromChat', handleOpenDealById as EventListener);
  }, [funnelDeals, selectedFunnelId]);

  const handleOpenCreate = (presetStageId?: string) => { 
    setEditingDeal(null); 
    setTitle(''); 
    setClientName(''); 
    setContactName(''); 
    setAmount(''); 
    setSource('manual'); 
    const stageFunnelId = presetStageId ? stageToFunnelId.get(presetStageId) : undefined;
    const fid = stageFunnelId || primaryFunnelId || salesFunnels[0]?.id || '';
    setFunnelId(fid);
    const fu = salesFunnels.find(f => f.id === fid);
    setStage(presetStageId || fu?.stages?.[0]?.id || 'new');
    setDealProjectId('');
    setAssigneeId(users[0]?.id || ''); 
    setNotes('');
    setComments([]); 
    setModalTab('chat');
    setIsModalOpen(true); 
  };
  
  const handleOpenEdit = (d: Deal) => { 
    setEditingDeal(d); 
    setTitle(d.title); 
    // Если есть clientId, получаем название клиента, иначе используем contactName или title
    const client = d.clientId ? clients.find(c => c.id === d.clientId) : null;
    setClientName(client ? client.name : (d.contactName || d.title || '')); 
    setContactName(d.contactName || ''); 
    setAmount(d.amount.toString()); 
    setStage(d.stage); 
    setFunnelId(d.funnelId || ''); 
    setDealProjectId(d.projectId || '');
    setAssigneeId(d.assigneeId); 
    setSource(d.source || 'manual'); 
    setNotes(d.notes || '');
    setComments(d.comments || []); 
    setModalTab('chat');
    setIsModalOpen(true); 
  };

  /** Смена воронки в модалке: подставляем первый этап, если текущий этап не из этой воронки */
  const handleDealFunnelChange = (id: string) => {
    setFunnelId(id);
    const fu = salesFunnels.find(f => f.id === id);
    if (fu?.stages?.length) {
      const still = fu.stages.some(s => s.id === stage);
      if (!still && stage !== 'won' && stage !== 'lost') {
        setStage(fu.stages[0].id);
      }
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      
      try {
          // Проверяем обязательные поля
          const trimmedTitle = title.trim();
          if (!trimmedTitle) {
              setAlertState({ open: true, title: 'Проверьте данные', message: 'Пожалуйста, введите название сделки.' });
              return;
          }
          
          // Если воронка не указана, используем выбранные воронки (первую) или настройки
          let finalFunnelId = funnelId || primaryFunnelId;
          if (!finalFunnelId) {
              try {
                  const notificationPrefs = (await api.notificationPrefs.get()) as NotificationPreferences;
                  finalFunnelId = notificationPrefs?.defaultFunnelId || defaultFunnelId;
              } catch (error) {
                  console.error('Error loading notification prefs:', error);
                  // Используем первую доступную воронку
                  if (salesFunnels.length > 0) {
                      finalFunnelId = salesFunnels[0].id;
                  }
              }
          }
          
          // Если есть воронка, получаем первый этап, если stage не указан
          let finalStage = stage;
          if (finalFunnelId && !finalStage) {
              const funnel = salesFunnels.find(f => f.id === finalFunnelId);
              if (funnel && funnel.stages.length > 0) {
                  finalStage = funnel.stages[0].id;
              } else {
                  // Если воронка не найдена, используем дефолтный этап
                  finalStage = 'new';
              }
          }
          
          // Если stage все еще не указан, используем дефолтный
          if (!finalStage) {
              finalStage = 'new';
          }
          
          const dealData: Deal = {
              id: editingDeal ? editingDeal.id : `deal-${Date.now()}`,
              title: trimmedTitle, 
              clientId: undefined, // Клиент создается только при успешной сделке
              contactName: contactName.trim() || undefined, 
              amount: parseFloat(amount) || 0, 
              currency: 'UZS', 
              stage: finalStage, 
              funnelId: finalFunnelId || undefined,
              source: source || 'manual', 
              assigneeId: assigneeId || undefined, 
              notes: notes.trim() || undefined,
              projectId: dealProjectId || undefined,
              telegramChatId: editingDeal?.telegramChatId, 
              telegramUsername: editingDeal?.telegramUsername, 
              createdAt: editingDeal ? editingDeal.createdAt : new Date().toISOString(), 
              comments: comments || []
          };
          
          onSaveDeal(dealData);
          setIsModalOpen(false);
      } catch (error) {
          devWarn('[DEAL] Error saving deal:', error);
          setAlertState({ open: true, title: 'Ошибка сохранения', message: 'Произошла ошибка при сохранении сделки. Попробуйте еще раз.' });
      }
  };

  const handleSendChat = async () => {
      if (!chatMessage.trim() || !editingDeal) return;

      const deal = editingDeal;
      const text = chatMessage.trim();

      if (deal.source === 'instagram' && deal.telegramChatId?.startsWith('ig:')) {
          try {
              const updated = (await api.integrationsMeta.sendInstagram({ dealId: deal.id, text })) as Deal;
              const next = updated.comments || [];
              setComments(next);
              onSaveDeal({ ...deal, ...updated, comments: next });
              setChatMessage('');
          } catch (e) {
              devWarn('[DEAL] Instagram send failed:', e);
              setAlertState({
                  open: true,
                  title: 'Не удалось отправить в Instagram',
                  message: e instanceof Error ? e.message : 'Проверьте токены страниц и права приложения.',
              });
          }
          return;
      }

      const c: Comment = {
          id: `c-${Date.now()}`,
          text,
          authorId: currentUser?.id || 'demo-user',
          createdAt: new Date().toISOString(),
          type: 'internal',
      };
      const nextComments = [...(comments || []), c];
      setComments(nextComments);
      onSaveDeal({ ...deal, comments: nextComments });
      setChatMessage('');
  };

  const onDragStart = (e: React.DragEvent, id: string) => { setDraggedDealId(id); e.dataTransfer.effectAllowed = 'move'; };
  const onDrop = (e: React.DragEvent, stage: any) => { 
    e.preventDefault(); 
    if(!draggedDealId) return;

    const d = funnelDeals.find((x) => x.id === draggedDealId);
    if(!d) {
      setDraggedDealId(null);
      return;
    }

    if(d.stage === stage) {
      setDraggedDealId(null);
      return;
    }

    const stageFunnelId = stageToFunnelId.get(String(stage));
    const isWonLost = stage === 'won' || stage === 'lost';

    // Если это stage из конкретной воронки — сделка может попасть туда только если stage существует в её воронке
    if(!isWonLost) {
      if(d.funnelId) {
        if(stageFunnelId && stageFunnelId !== d.funnelId) {
          setDraggedDealId(null);
          return;
        }
      }
    }

    const nextFunnelId = d.funnelId || stageFunnelId || primaryFunnelId || undefined;
    const updatedDeal = {...d, stage, funnelId: nextFunnelId};
    onSaveDeal(updatedDeal);
    
    // Если перетащили на "Успех" - создаем клиента
    if (stage === 'won' && onCreateClient) {
      const existingClient = d.clientId ? clients.find((c) => c.id === d.clientId) : null;
      if (!existingClient) {
        // Используем название клиента из сделки (если было введено) или название сделки
        const clientName = d.contactName || d.title; // contactName теперь хранит название клиента
        const client: Client = {
          id: `cl-${Date.now()}`,
          name: clientName,
          contactPerson: d.contactName,
          responsibleUserId: d.assigneeId,
          phone: undefined, // Можно добавить из комментариев
          email: undefined,
          telegram: d.telegramUsername,
          instagram: d.source === 'instagram' ? d.telegramUsername : undefined,
          companyName: d.title,
          companyInfo: d.notes,
          funnelId: d.funnelId || nextFunnelId || undefined,
          notes: `Создано из сделки: ${d.title}. Сумма: ${d.amount} ${d.currency}`
        };
        onCreateClient(client);
        // Обновляем сделку с clientId
        onSaveDeal({ ...updatedDeal, clientId: client.id });
      }
    }

    setDraggedDealId(null); 
  };
  
  const handleCreateTask = (taskTitle: string) => {
    if (!onCreateTask || !editingDeal) return;
    
    // Получаем название компании из сделки (contactName или title)
    const companyName = editingDeal.contactName || editingDeal.title;
    
    const task: Partial<Task> = {
      entityType: 'task',
      title: `${taskTitle.trim()} - ${companyName}`,
      description: `Задача по сделке: ${editingDeal.title}`,
      status: 'Не начато',
      priority: 'Средний',
      assigneeId: editingDeal.assigneeId,
      dealId: editingDeal.id,
      source: 'Сделка',
      projectId: editingDeal.projectId || null,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      tableId: '', // Для обычных задач tableId не используется
      createdAt: new Date().toISOString(),
      createdByUserId: currentUser?.id || editingDeal.assigneeId || undefined // Постановщик - текущий пользователь или менеджер сделки
    };
    
    onCreateTask(task);
  };
  
  // Получаем задачи, связанные с текущей сделкой
  const dealTasks = editingDeal ? tasks.filter(t => t.dealId === editingDeal.id) : [];
  const dealMeetings = editingDeal ? (meetings || []).filter(m => m.dealId === editingDeal.id && !m.isArchived) : [];
  const sortedComments = [...(comments || [])].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aTime - bTime;
  });
  const getCommentAuthorName = (comment: Comment) => {
    if (comment.type === 'instagram_in' || comment.type === 'telegram_in') {
      if (comment.authorId?.startsWith('ig_user:')) return 'Клиент (Instagram)';
    }
    const user = users.find((u) => u.id === comment.authorId);
    return user?.name || 'Система';
  };
  const formatCommentTime = (iso?: string) => {
    if (!iso) return '';
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const handleMarkAsWon = () => {
    if (!editingDeal) return;
    
    // Создаем клиента при успешной сделке (если еще не создан)
    let newClientId = editingDeal.clientId;
    if (!editingDeal.clientId && onCreateClient) {
      const client: Client = {
        id: `cl-${Date.now()}`,
        name: contactName || title || editingDeal.title,
        contactPerson: contactName || editingDeal.contactName,
        responsibleUserId: assigneeId || editingDeal.assigneeId,
        phone: undefined,
        email: undefined,
        telegram: editingDeal.telegramUsername,
        instagram: source === 'instagram' ? editingDeal.telegramUsername : undefined,
        companyName: title || editingDeal.title,
        companyInfo: notes || editingDeal.notes,
        funnelId: funnelId || editingDeal.funnelId || primaryFunnelId || undefined,
        notes: `Создано из сделки: ${editingDeal.title}. Сумма: ${editingDeal.amount} ${editingDeal.currency}`
      };
      onCreateClient(client);
      newClientId = client.id;
    }
    
    const updatedDeal = { 
      ...editingDeal, 
      stage: 'won' as const,
      clientId: newClientId || editingDeal.clientId
    };
    onSaveDeal(updatedDeal);
    setIsModalOpen(false);
  };

  const handleMarkAsLost = () => {
    if (!editingDeal) return;
    const updatedDeal = { ...editingDeal, stage: 'lost' as const };
    onSaveDeal(updatedDeal);
    setIsModalOpen(false);
  };
  
  // Фильтрация сделок по выбранным воронкам, исключаем архивные
  // Если выбраны ВСЕ воронки — показываем также сделки без воронки.
  const filteredDeals = useMemo(() => {
    if (selectedFunnelId === 'all') return funnelDeals;
    return funnelDeals.filter((d) => String(d.funnelId || '') === String(selectedFunnelId));
  }, [funnelDeals, selectedFunnelId]);
  
  const activeDeals = filteredDeals.filter(d => d.stage !== 'won' && d.stage !== 'lost');
  const wonDeals = filteredDeals.filter(d => d.stage === 'won');
  const lostDeals = filteredDeals.filter(d => d.stage === 'lost');

  const getSourceIcon = (s: string) => {
      switch(s) {
          case 'instagram': return <Instagram size={14} className="text-pink-500"/>;
          case 'telegram': return <Send size={14} className="text-blue-500"/>;
          case 'site': return <Globe size={14} className="text-blue-600"/>;
          default: return <UserPlus size={14} className="text-gray-400"/>;
      }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
          setIsModalOpen(false);
      }
  };

  const renderList = () => (
      <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden shadow-sm h-full flex flex-col">
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-[#252525] border-b border-gray-200 dark:border-[#333] sticky top-0 z-10">
                    <tr>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Сделка</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Сумма (UZS)</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Вид услуг</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Этап</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Источник</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Ответственный</th>
                        <th className="px-4 py-3 w-10"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
                    {activeDeals.map(deal => {
                        const assignee = users.find(u => u.id === deal.assigneeId);
                        const dealFunnel = deal.funnelId ? salesFunnels.find(f => f.id === deal.funnelId) : null;
                        const dealStage = dealFunnel?.stages.find(s => s.id === deal.stage);
                        const stageLabel = dealStage?.label || STAGES.find(s => s.id === deal.stage)?.label || deal.stage;
                        const dealProject = projects.find(p => p.id === deal.projectId);
                        return (
                            <tr key={deal.id} onClick={() => handleOpenEdit(deal)} className="hover:bg-gray-50 dark:hover:bg-[#2a2a2a] cursor-pointer group transition-colors">
                                <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{deal.title}</td>
                                <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{(deal.amount || 0).toLocaleString()}</td>
                                <td className="px-4 py-3">
                                    {dealProject ? (
                                        <div className="flex items-center gap-1.5">
                                            <DynamicIcon name={dealProject.icon} className={`${dealProject.color} w-4 h-4`} />
                                            <span className="text-xs text-gray-600 dark:text-gray-400">{dealProject.name}</span>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-gray-400">—</span>
                                    )}
                                </td>
                                <td className="px-4 py-3"><span className="px-2 py-1 rounded text-xs bg-gray-100 dark:bg-[#333] border border-gray-200 dark:border-[#444] text-gray-600 dark:text-gray-300">{stageLabel}</span></td>
                                <td className="px-4 py-3 flex items-center gap-2">{getSourceIcon(deal.source || 'manual')} <span className="text-xs text-gray-500 capitalize">{deal.source}</span></td>
                                <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{assignee?.name}</td>
                                <td className="px-4 py-3 text-right"><button onClick={(e) => { e.stopPropagation(); handleOpenEdit(deal); }} className="text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100"><Edit2 size={14}/></button></td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
          </div>
      </div>
  );

  // Если воронок нет, показываем экран приглашения
  if (salesFunnels.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-[#191919]">
        <div className="text-center max-w-md px-6">
          <TrendingUp size={64} className="mx-auto text-gray-300 dark:text-gray-600 mb-6" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">
            Создайте свою первую воронку
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            Создайте воронку в разделе «Настройки системы» → «Воронки продаж».
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">
            Быстрый переход: иконка шестерёнки в шапке рядом с названием «Воронка продаж».
          </p>
        </div>
      </div>
    );
  }

  return (
    <ModulePageShell className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className={`${MODULE_PAGE_GUTTER} pt-6 md:pt-8 flex-shrink-0`}>
        <div className="mb-6 space-y-5">
          <ModulePageHeader
            accent="violet"
            icon={<TrendingUp size={24} strokeWidth={2} />}
            title="Воронка продаж"
            description="Управление сделками и продажами"
            tabs={
              <ModuleSegmentedControl
                variant="neutral"
                value={viewMode}
                onChange={(v) => setViewMode(v as 'kanban' | 'list' | 'rejected')}
                options={[
                  { value: 'kanban', label: 'Канбан' },
                  { value: 'list', label: 'Список' },
                  { value: 'rejected', label: 'Отказы' },
                ]}
              />
            }
            controls={
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="min-w-[260px]">
                      <TaskSelect
                        value={selectedFunnelId}
                        onChange={setSelectedFunnelId}
                        options={[
                          { value: 'all', label: `Основная: Все (${activeFunnels.length})` },
                          ...activeFunnels.map((f) => ({ value: f.id, label: f.name })),
                        ]}
                      />
                    </div>
                    {selectedFunnelId !== 'all' && (
                      <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525]">
                        <span
                          className={`w-3 h-3 rounded ${
                            activeFunnels.find((f) => f.id === selectedFunnelId)?.color ||
                            activeFunnels.find((f) => f.id === selectedFunnelId)?.stages?.[0]?.color ||
                            'bg-gray-200 dark:bg-gray-700'
                          }`}
                        />
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate max-w-[220px]">
                          {activeFunnels.find((f) => f.id === selectedFunnelId)?.name || 'Воронка'}
                        </span>
                      </div>
                    )}
                  </div>

                  <ModuleCreateIconButton accent="violet" label="Новая сделка" onClick={() => handleOpenCreate()} />
                </div>
              </>
            }
          />
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div
          className={`${MODULE_PAGE_GUTTER} h-full min-h-0 flex flex-col ${
            viewMode === 'kanban'
              ? 'overflow-hidden pb-0'
              : 'pb-24 md:pb-32 overflow-y-auto overflow-x-hidden custom-scrollbar'
          }`}
        >
          {viewMode === 'kanban' ? (
              <div className="flex-1 min-h-0 relative flex flex-col">
                  <div className={`flex flex-1 min-h-0 overflow-x-auto gap-3 md:gap-4 ${draggedDealId ? 'pb-28 md:pb-32' : 'pb-4'}`}>
                      {kanbanStages.map(s => (
                          <div key={s.id} className="w-64 md:w-80 flex-shrink-0 h-full min-h-0 max-h-full flex flex-col bg-gray-50/50 dark:bg-[#1e1e1e] rounded-lg border border-gray-200 dark:border-[#333]" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, s.id)}>
                              <div className="p-2 md:p-3 font-bold text-xs md:text-sm text-gray-700 dark:text-gray-200 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                      s.color ||
                                      activeFunnels.find((f) => f.id === stageToFunnelId.get(String(s.id)))?.color ||
                                      'bg-gray-200 dark:bg-gray-700'
                                    }`}
                                  />
                                  <span className="truncate">{s.label}</span>
                                </div>
                                <span className="bg-gray-200 dark:bg-[#333] px-2 rounded text-xs shrink-0">
                                  {activeDeals.filter(d => d.stage === s.id).length}
                                </span>
                              </div>
                              <div
                                className="p-2 flex-1 overflow-y-auto space-y-2 custom-scrollbar min-h-0"
                                onClick={(e) => {
                                  if (e.target === e.currentTarget) {
                                    handleOpenCreate(s.id);
                                  }
                                }}
                              >
                                  {activeDeals.filter(d => d.stage === s.id).map(d => {
                                      const dealProject = projects.find(p => p.id === d.projectId);
                                      const cardFunnelId = d.funnelId || stageToFunnelId.get(String(d.stage)) || primaryFunnelId;
                                      const cardFunnel = salesFunnels.find((f) => f.id === cardFunnelId);
                                      const funnelAccent = getFunnelKanbanCardAccent(cardFunnel);
                                      return (
                                          <div
                                            key={d.id}
                                            draggable
                                            onDragStart={(e) => onDragStart(e, d.id)}
                                            onDragEnd={() => setDraggedDealId(null)}
                                            onClick={(e) => { e.stopPropagation(); handleOpenEdit(d); }}
                                            className={`relative p-2 md:p-3 rounded-lg shadow-sm border cursor-pointer hover:shadow-md transition-all overflow-hidden ${funnelAccent.card}`}
                                          >
                                            <div className={`absolute left-0 top-0 bottom-0 w-2 ${funnelAccent.stripe} rounded-l`} />
                                            <div className="relative z-10 pl-2.5">
                                              {selectedFunnelId === 'all' && cardFunnel && (
                                                <div className="flex items-center gap-1.5 mb-1 min-w-0">
                                                  <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${funnelAccent.stripe}`} />
                                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 truncate">
                                                    {cardFunnel.name}
                                                  </span>
                                                </div>
                                              )}
                                              <div className="font-medium text-xs md:text-sm text-gray-800 dark:text-gray-100 mb-1 line-clamp-2">{d.title}</div>
                                              <div className="flex items-center justify-between gap-2 mb-1">
                                                <span className="text-xs text-gray-500">{(d.amount || 0).toLocaleString()} UZS</span>
                                                {dealProject && (
                                                    <div className="flex items-center gap-1 text-xs">
                                                        <DynamicIcon name={dealProject.icon} className={`${dealProject.color} w-3 h-3`} />
                                                        <span className="text-gray-500 dark:text-gray-400">{dealProject.name}</span>
                                                    </div>
                                                )}
                                              </div>
                                              <div className="text-xs text-gray-500 flex justify-end items-center">{getSourceIcon(d.source || 'manual')}</div>
                                            </div>
                                          </div>
                                      );
                                  })}
                              </div>
                          </div>
                      ))}
                  </div>
                  
                  {/* Области для перетаскивания: Успех / Отказ (плавающий низ с затемнением сверху) */}
                  {draggedDealId && (
                  <div className="absolute inset-x-0 bottom-0 z-20 pointer-events-none">
                    <div className="h-7 bg-gradient-to-t from-white/90 dark:from-[#141414]/95 to-transparent" />
                    <div className={`${MODULE_PAGE_GUTTER} pb-2 md:pb-3`}>
                      <div className="pointer-events-auto rounded-xl border border-gray-200/80 dark:border-[#333] bg-white/90 dark:bg-[#1b1b1b]/90 backdrop-blur-sm shadow-[0_-8px_24px_rgba(0,0,0,0.12)] px-2 py-2 md:px-3 md:py-3">
                        <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                      <div 
                          className="flex-1 bg-green-50 dark:bg-green-900/20 border-2 border-dashed border-green-300 dark:border-green-700 rounded-lg p-3 md:p-4 flex items-center justify-center gap-2 md:gap-3 min-h-[66px]"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => onDrop(e, 'won')}
                      >
                          <CheckCircle2 size={20} className="md:w-6 md:h-6 text-green-600 dark:text-green-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm md:text-base text-green-700 dark:text-green-400">Успешная сделка</div>
                              <div className="text-xs text-green-600 dark:text-green-500 hidden sm:block">Перетащите сюда → создастся клиент</div>
                          </div>
                          <span className="bg-green-200 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded text-xs font-bold shrink-0">{wonDeals.length}</span>
                      </div>
                      
                      <div 
                          className="flex-1 bg-red-50 dark:bg-red-900/20 border-2 border-dashed border-red-300 dark:border-red-700 rounded-lg p-3 md:p-4 flex items-center justify-center gap-2 md:gap-3 min-h-[66px]"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => onDrop(e, 'lost')}
                      >
                          <XCircle size={20} className="md:w-6 md:h-6 text-red-600 dark:text-red-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm md:text-base text-red-700 dark:text-red-400">Отказ</div>
                              <div className="text-xs text-red-600 dark:text-red-500 hidden sm:block">Перетащите сюда → в базу отказов</div>
                          </div>
                          <span className="bg-red-200 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-1 rounded text-xs font-bold shrink-0">{lostDeals.length}</span>
                      </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  )}
              </div>
          ) : viewMode === 'rejected' ? (
              <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden shadow-sm h-full flex flex-col">
                  <div className="overflow-y-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-[#252525] border-b border-gray-200 dark:border-[#333] sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Сделка</th>
                                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Сумма (UZS)</th>
                                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Вид услуг</th>
                                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Источник</th>
                                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Ответственный</th>
                                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Дата</th>
                                <th className="px-4 py-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
                            {lostDeals.map(deal => {
                                const assignee = users.find(u => u.id === deal.assigneeId);
                                const dealProject = projects.find(p => p.id === deal.projectId);
                                return (
                                    <tr key={deal.id} onClick={() => handleOpenEdit(deal)} className="hover:bg-gray-50 dark:hover:bg-[#2a2a2a] cursor-pointer group transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{deal.title}</td>
                                        <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{(deal.amount || 0).toLocaleString()}</td>
                                        <td className="px-4 py-3">
                                            {dealProject ? (
                                                <div className="flex items-center gap-1.5">
                                                    <DynamicIcon name={dealProject.icon} className={`${dealProject.color} w-4 h-4`} />
                                                    <span className="text-xs text-gray-600 dark:text-gray-400">{dealProject.name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 flex items-center gap-2">{getSourceIcon(deal.source || 'manual')} <span className="text-xs text-gray-500 capitalize">{deal.source}</span></td>
                                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{assignee?.name}</td>
                                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{new Date(deal.createdAt).toLocaleDateString()}</td>
                                        <td className="px-4 py-3 text-right"><button onClick={(e) => { e.stopPropagation(); handleOpenEdit(deal); }} className="text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100"><Edit2 size={14}/></button></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                  </div>
              </div>
          ) : renderList()}
        </div>
      </div>
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/35 backdrop-blur-sm flex items-end md:items-center justify-center z-[220] p-0 md:p-4" onClick={handleBackdropClick}>
              <div className="bg-white dark:bg-[#1e1e1e] w-full h-full md:h-auto md:max-h-[min(720px,92vh)] md:max-w-5xl md:rounded-xl shadow-2xl flex flex-col md:flex-row overflow-hidden border-0 md:border border-gray-200 dark:border-gray-800 rounded-t-2xl md:rounded-xl" onClick={e => e.stopPropagation()}>
                  {/* Левая колонка — поля (как в модалке задачи) */}
                  <div className="flex-1 flex flex-col min-w-0 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 max-h-[52vh] md:max-h-none overflow-hidden">
                      <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start gap-2 shrink-0">
                          <div className="flex-1 min-w-0">
                              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 ml-0.5">Сделка</label>
                              <input
                                  value={title}
                                  onChange={e => setTitle(e.target.value)}
                                  className="w-full text-sm font-semibold bg-white dark:bg-[#252525] border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500/20 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                                  placeholder="Название сделки"
                              />
                          </div>
                          <div className="flex items-center gap-1 shrink-0 mt-5">
                              {editingDeal && (
                                  <button
                                      type="button"
                                      onClick={() => {
                                          setConfirmState({
                                            open: true,
                                            title: 'Удалить сделку',
                                            message: 'Переместить сделку в архив?',
                                            onConfirm: () => {
                                              onDeleteDeal(editingDeal.id);
                                              setIsModalOpen(false);
                                              setConfirmState({ open: false, title: '', message: '' });
                                            },
                                          });
                                      }}
                                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                                      title="В архив"
                                  >
                                      <Trash2 size={18} />
                                  </button>
                              )}
                              <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded transition-colors">
                                  <X size={20} />
                              </button>
                          </div>
                      </div>

                      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-4 space-y-2 min-h-0">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-2">
                              <div className="flex items-center gap-2 md:gap-3 md:col-span-2">
                                  <div className="w-24 shrink-0 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1.5">
                                      <KanbanSquare size={14} className="text-gray-400 shrink-0" />
                                      Воронка
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <TaskSelect
                                          size="compact"
                                          value={funnelId}
                                          onChange={handleDealFunnelChange}
                                          options={salesFunnels.map(f => ({ value: f.id, label: f.name }))}
                                          placeholder="Выберите воронку"
                                      />
                                  </div>
                              </div>
                              <div className="flex items-center gap-2 md:gap-3">
                                  <div className="w-24 shrink-0 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1.5">
                                      <GitBranch size={14} className="text-gray-400 shrink-0" />
                                      Стадия
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <TaskSelect
                                          size="compact"
                                          value={stage}
                                          onChange={setStage}
                                          options={[
                                              ...(funnelId
                                                  ? (() => {
                                                        const currentFunnel = salesFunnels.find(f => f.id === funnelId);
                                                        return currentFunnel && currentFunnel.stages.length > 0
                                                            ? currentFunnel.stages.map(s => ({ value: s.id, label: s.label }))
                                                            : STAGES.map(s => ({ value: s.id, label: s.label }));
                                                    })()
                                                  : STAGES.map(s => ({ value: s.id, label: s.label }))),
                                              { value: 'won', label: 'Выиграна' },
                                              { value: 'lost', label: 'Проиграна' },
                                          ]}
                                      />
                                  </div>
                              </div>
                              <div className="flex items-center gap-2 md:gap-3">
                                  <div className="w-24 shrink-0 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1.5">
                                      <Filter size={14} className="text-gray-400 shrink-0" />
                                      Источник
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <TaskSelect
                                          size="compact"
                                          value={source}
                                          onChange={setSource}
                                          options={[
                                              { value: 'manual', label: 'Вручную' },
                                              { value: 'site', label: 'Заявка с сайта' },
                                              { value: 'instagram', label: 'Instagram' },
                                              { value: 'telegram', label: 'Telegram' },
                                              { value: 'vk', label: 'ВКонтакте' },
                                              { value: 'recommendation', label: 'Рекомендация' },
                                          ]}
                                      />
                                  </div>
                              </div>
                              <div className="flex items-center gap-2 md:gap-3 md:col-span-2">
                                  <div className="w-24 shrink-0 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1.5">
                                      <Tag size={14} className="text-gray-400 shrink-0" />
                                      Модуль
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <TaskSelect
                                          size="compact"
                                          value={dealProjectId}
                                          onChange={setDealProjectId}
                                          placeholder=""
                                          options={[
                                              { value: '', label: 'Не выбрано' },
                                              ...(projects || []).map(p => ({ value: p.id, label: p.name })),
                                          ]}
                                      />
                                  </div>
                              </div>
                              <div className="flex items-center gap-2 md:gap-3 md:col-span-2">
                                  <div className="w-24 shrink-0 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1.5">
                                      <UserIcon size={14} className="text-gray-400 shrink-0" />
                                      Ответств.
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <TaskSelect
                                          size="compact"
                                          value={assigneeId}
                                          onChange={setAssigneeId}
                                          options={users.map(u => ({ value: u.id, label: u.name }))}
                                          placeholder="Выберите исполнителя"
                                      />
                                  </div>
                              </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                              <div>
                                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Клиент</label>
                                  <input
                                      value={clientName}
                                      onChange={e => setClientName(e.target.value)}
                                      className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-1.5 min-h-[32px] text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100"
                                      placeholder="Название или компания"
                                  />
                              </div>
                              <div>
                                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Контакт</label>
                                  <input
                                      value={contactName}
                                      onChange={e => setContactName(e.target.value)}
                                      className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-1.5 min-h-[32px] text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100"
                                      placeholder="ФИО, телефон"
                                  />
                              </div>
                              <div className="md:col-span-2">
                                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Сумма (UZS)</label>
                                  <input
                                      type="number"
                                      value={amount}
                                      onChange={e => setAmount(e.target.value)}
                                      className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-1.5 min-h-[32px] text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                      placeholder="0"
                                  />
                              </div>
                          </div>

                          <div>
                              <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Примечание</label>
                              <textarea
                                  value={notes}
                                  onChange={e => setNotes(e.target.value)}
                                  rows={3}
                                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 resize-y min-h-[72px]"
                                  placeholder="Дополнительно о сделке..."
                              />
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2 pt-1">
                              <button
                                  type="button"
                                  onClick={handleMarkAsWon}
                                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                              >
                                  <CheckCircle2 size={16} />
                                  <span>Успешно</span>
                              </button>
                              <button
                                  type="button"
                                  onClick={handleMarkAsLost}
                                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                              >
                                  <XCircle size={16} />
                                  <span>Отказ</span>
                              </button>
                          </div>

                          <Button type="submit" size="md" fullWidth className="mt-1">
                              Сохранить
                          </Button>
                      </form>
                  </div>

                  {/* Правая колонка — чат / задачи / встречи */}
                  <div className="w-full md:w-[min(420px,44%)] flex flex-col bg-gray-50 dark:bg-[#202020] border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-800 min-h-[280px] md:min-h-0">
                      <div className="flex items-center gap-1 p-1.5 border-b border-gray-200 dark:border-[#333] bg-white/90 dark:bg-[#252525]/90 shrink-0">
                          <button
                              type="button"
                              onClick={() => setModalTab('chat')}
                              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${modalTab === 'chat' ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333]'}`}
                          >
                              Чат
                          </button>
                          <button
                              type="button"
                              onClick={() => setModalTab('tasks')}
                              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${modalTab === 'tasks' ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333]'}`}
                          >
                              Задачи
                          </button>
                          <button
                              type="button"
                              onClick={() => setModalTab('meetings')}
                              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${modalTab === 'meetings' ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333]'}`}
                          >
                              Встречи
                          </button>
                      </div>
                      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                          {modalTab === 'chat' ? (
                              <>
                                  <div className="flex-1 p-4 overflow-y-auto space-y-3">
                                      {sortedComments.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
                                          Пока нет сообщений по сделке
                                        </div>
                                      ) : (
                                        sortedComments.map((c) => {
                                          const mine =
                                            c.authorId === currentUser?.id ||
                                            c.type === 'telegram_out' ||
                                            c.type === 'instagram_out';
                                          return (
                                            <div key={c.id} className={`max-w-[88%] ${mine ? 'ml-auto' : ''}`}>
                                              <div className={`rounded-xl px-3 py-2 text-sm ${mine ? 'bg-[#3337AD] text-white' : 'bg-white dark:bg-[#333] text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-[#444]'}`}>
                                                <div className={`mb-1 text-[11px] ${mine ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                                                  {getCommentAuthorName(c)}{formatCommentTime(c.createdAt) ? ` • ${formatCommentTime(c.createdAt)}` : ''}
                                                </div>
                                                <div className="whitespace-pre-wrap break-words">{c.text}</div>
                                              </div>
                                            </div>
                                          );
                                        })
                                      )}
                                  </div>
                                  <div className="p-4 border-t border-gray-200 dark:border-[#333] flex gap-2">
                                      <input
                                          value={chatMessage}
                                          onChange={(e) => setChatMessage(e.target.value)}
                                          className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 min-h-[36px] text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100"
                                          placeholder={
                                              editingDeal?.source === 'instagram' && editingDeal.telegramChatId?.startsWith('ig:')
                                                  ? 'Ответ в Instagram…'
                                                  : 'Сообщение по сделке…'
                                          }
                                      />
                                      <button onClick={handleSendChat} className="bg-blue-600 text-white p-2 rounded"><Send size={16}/></button>
                                  </div>
                              </>
                          ) : modalTab === 'tasks' ? (
                              <div className="flex-1 p-4 md:p-6 overflow-y-auto flex flex-col">
                                  <div className="flex items-center justify-between mb-4">
                                      <h4 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                          <CheckSquare size={18} /> Задачи по сделке
                                      </h4>
                                      {dealTasks.length > 0 && (
                                          <span className="text-xs text-gray-500 dark:text-gray-400">{dealTasks.length}</span>
                                      )}
                                  </div>
                                  
                                  {/* Список связанных задач */}
                                  {dealTasks.length > 0 && (
                                      <div className="space-y-2 mb-4">
                                          {dealTasks.map(task => (
                                              <div 
                                                  key={task.id}
                                                  onClick={() => onOpenTask && onOpenTask(task)}
                                                  className="p-3 bg-white dark:bg-[#333] border border-gray-200 dark:border-[#444] rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
                                              >
                                                  <div className="font-medium text-sm text-gray-800 dark:text-gray-200 mb-1">{task.title}</div>
                                                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                      <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-[#444]">{task.status}</span>
                                                      {task.priority && (
                                                          <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-[#444]">{task.priority}</span>
                                                      )}
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  )}
                                  
                                  {/* Кнопка создания задачи с выпадающим списком */}
                                  <div className="relative">
                                      <button
                                          type="button"
                                          title="Создать задачу"
                                          aria-label="Создать задачу"
                                          onClick={() => setShowTaskDropdown(!showTaskDropdown)}
                                          className="w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors flex items-center justify-center text-violet-600 dark:text-violet-400"
                                      >
                                          <Plus size={22} strokeWidth={2.5} />
                                      </button>
                                      {showTaskDropdown && (
                                          <>
                                              <div className="fixed inset-0 z-30" onClick={() => setShowTaskDropdown(false)}></div>
                                              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#333] border border-gray-200 dark:border-[#444] rounded-lg shadow-lg z-40 overflow-hidden">
                                                  <button
                                                      onClick={() => {
                                                          setShowCustomTaskInput(true);
                                                          setCustomTaskTitle('');
                                                          setShowTaskDropdown(false);
                                                      }}
                                                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[#404040] transition-colors text-sm text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-[#444]"
                                                  >
                                                      Новая задача...
                                                  </button>
                                                  <button
                                                      onClick={() => { handleCreateTask('Подготовить КП'); setShowTaskDropdown(false); }}
                                                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[#404040] transition-colors text-sm text-gray-700 dark:text-gray-300"
                                                  >
                                                      Подготовить КП
                                                  </button>
                                                  <button
                                                      onClick={() => { handleCreateTask('Согласовать условия'); setShowTaskDropdown(false); }}
                                                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[#404040] transition-colors text-sm text-gray-700 dark:text-gray-300"
                                                  >
                                                      Согласовать условия
                                                  </button>
                                                  <button
                                                      onClick={() => { handleCreateTask('Подготовить договор'); setShowTaskDropdown(false); }}
                                                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[#404040] transition-colors text-sm text-gray-700 dark:text-gray-300"
                                                  >
                                                      Подготовить договор
                                                  </button>
                                                  <button
                                                      onClick={() => { handleCreateTask('Связаться с клиентом'); setShowTaskDropdown(false); }}
                                                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[#404040] transition-colors text-sm text-gray-700 dark:text-gray-300"
                                                  >
                                                      Связаться с клиентом
                                                  </button>
                                              </div>
                                          </>
                                      )}
                                  </div>
                                  {showCustomTaskInput && (
                                      <div className="mt-2 p-2 border border-gray-200 dark:border-[#444] rounded-lg bg-white dark:bg-[#333]">
                                          <div className="flex gap-2">
                                              <input
                                                  value={customTaskTitle}
                                                  onChange={(e) => setCustomTaskTitle(e.target.value)}
                                                  placeholder="Название новой задачи"
                                                  className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-1.5 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100"
                                              />
                                              <button
                                                  type="button"
                                                  onClick={() => {
                                                      const title = customTaskTitle.trim();
                                                      if (!title) {
                                                        setAlertState({ open: true, title: 'Введите название', message: 'Укажите название новой задачи.' });
                                                        return;
                                                      }
                                                      handleCreateTask(title);
                                                      setShowCustomTaskInput(false);
                                                      setCustomTaskTitle('');
                                                  }}
                                                  className="px-3 py-1.5 rounded-md bg-[#3337AD] text-white text-sm hover:bg-[#2d3199]"
                                              >
                                                  Добавить
                                              </button>
                                          </div>
                                      </div>
                                  )}
                              </div>
                          ) : modalTab === 'meetings' ? (
                              <div className="flex-1 p-4 md:p-6 overflow-y-auto flex flex-col">
                                  <div className="flex items-center justify-between mb-4">
                                      <h4 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                          <Calendar size={18} /> Встречи по сделке
                                      </h4>
                                      {dealMeetings.length > 0 && (
                                          <span className="text-xs text-gray-500 dark:text-gray-400">{dealMeetings.length}</span>
                                      )}
                                  </div>
                                  
                                  {/* Список встреч */}
                                  {dealMeetings.length > 0 ? (
                                      <div className="space-y-3 mb-4">
                                          {dealMeetings.map(meeting => (
                                              <div 
                                                  key={meeting.id}
                                                  className="p-4 bg-white dark:bg-[#333] border border-gray-200 dark:border-[#444] rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                              >
                                                  <div className="font-medium text-sm text-gray-800 dark:text-gray-200 mb-2">{meeting.title}</div>
                                                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-2">
                                                      <div className="flex items-center gap-1">
                                                          <Calendar size={12} />
                                                          <span>{new Date(meeting.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                                      </div>
                                                      <div className="flex items-center gap-1">
                                                          <Clock size={12} />
                                                          <span>{meeting.time}</span>
                                                      </div>
                                                      {meeting.participantIds && meeting.participantIds.length > 0 && (
                                                          <div className="flex items-center gap-1">
                                                              <Users size={12} />
                                                              <span>{meeting.participantIds.length} участников</span>
                                                          </div>
                                                      )}
                                                  </div>
                                                  {meeting.summary && (
                                                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 p-2 bg-gray-50 dark:bg-[#404040] rounded">
                                                          {meeting.summary}
                                                      </div>
                                                  )}
                                                  {onDeleteMeeting && (
                                                      <button
                                                          onClick={() => {
                                                              setConfirmState({
                                                                open: true,
                                                                title: 'Удалить встречу',
                                                                message: 'Вы уверены, что хотите удалить встречу?',
                                                                onConfirm: () => {
                                                                  onDeleteMeeting(meeting.id);
                                                                  setConfirmState({ open: false, title: '', message: '' });
                                                                },
                                                              });
                                                          }}
                                                          className="mt-2 text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400"
                                                      >
                                                          Удалить
                                                      </button>
                                                  )}
                                              </div>
                                          ))}
                                      </div>
                                  ) : (
                                      <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                                          Нет встреч по этой сделке
                                      </div>
                                  )}
                                  
                                  {/* Кнопка создания встречи */}
                                  {onSaveMeeting && (
                                      <>
                                        {!showCreateMeetingForm ? (
                                          <button
                                              type="button"
                                              title="Создать встречу"
                                              aria-label="Создать встречу"
                                              onClick={() => {
                                                  if (!editingDeal) {
                                                    setAlertState({ open: true, title: 'Сначала сохраните сделку', message: 'Чтобы создать встречу по сделке, сначала сохраните саму сделку.' });
                                                    return;
                                                  }
                                                  const today = new Date().toISOString().split('T')[0];
                                                  setNewMeetingDate(today);
                                                  setNewMeetingTime('10:00');
                                                  setShowCreateMeetingForm(true);
                                              }}
                                              className="w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors flex items-center justify-center text-violet-600 dark:text-violet-400"
                                          >
                                              <Plus size={22} strokeWidth={2.5} />
                                          </button>
                                        ) : (
                                          <div className="p-3 border border-gray-200 dark:border-[#444] rounded-lg bg-white dark:bg-[#333] space-y-3">
                                            <div className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Новая встреча</div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                              <DateInput
                                                value={newMeetingDate}
                                                onChange={setNewMeetingDate}
                                                size="compact"
                                              />
                                              <input
                                                type="time"
                                                step={60}
                                                value={newMeetingTime}
                                                onChange={(e) => setNewMeetingTime(e.target.value)}
                                                className="h-8 min-h-8 px-2.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#252525] text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500/30"
                                              />
                                            </div>
                                            <div className="flex justify-end gap-2">
                                              <button
                                                type="button"
                                                onClick={() => setShowCreateMeetingForm(false)}
                                                className="px-3 py-1.5 rounded-md border border-gray-200 dark:border-[#444] text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2c2c2c]"
                                              >
                                                Отмена
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (!editingDeal) return;
                                                  if (!newMeetingDate || !newMeetingTime) {
                                                    setAlertState({ open: true, title: 'Заполните дату и время', message: 'Для создания встречи обязательно укажите дату и время.' });
                                                    return;
                                                  }
                                                  const now = new Date();
                                                  const newMeeting: Meeting = {
                                                    id: `m-${now.getTime()}`,
                                                    tableId: 'meetings-system',
                                                    type: 'client',
                                                    dealId: editingDeal.id,
                                                    clientId: editingDeal.clientId,
                                                    title: `Встреча: ${editingDeal.title}`,
                                                    date: newMeetingDate,
                                                    time: newMeetingTime,
                                                    participantIds: editingDeal.assigneeId ? [editingDeal.assigneeId] : [],
                                                    summary: '',
                                                    isArchived: false,
                                                    createdAt: now.toISOString(),
                                                    updatedAt: now.toISOString(),
                                                  };
                                                  onSaveMeeting(newMeeting);
                                                  setShowCreateMeetingForm(false);
                                                  setAlertState({ open: true, title: 'Встреча создана', message: 'Новая встреча по сделке успешно добавлена.' });
                                                }}
                                                className="px-3 py-1.5 rounded-md text-xs text-white bg-[#3337AD] hover:bg-[#2d3199]"
                                              >
                                                Создать встречу
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </>
                                  )}
                              </div>
                          ) : null}
                      </div>
                  </div>
              </div>
          </div>
      )}
      <SystemAlertDialog
        open={alertState.open}
        title={alertState.title}
        message={alertState.message}
        onClose={() => setAlertState({ open: false, title: '', message: '' })}
      />
      <SystemConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        danger
        confirmText="Удалить"
        cancelText="Отмена"
        onCancel={() => setConfirmState({ open: false, title: '', message: '' })}
        onConfirm={() => confirmState.onConfirm?.()}
      />
    </ModulePageShell>
  );
};

export default SalesFunnelView;
