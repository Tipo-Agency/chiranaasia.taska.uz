
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Deal, Client, User, Comment, Task, Project, SalesFunnel, Meeting } from '../types';
import { Plus, KanbanSquare, List as ListIcon, X, Send, MessageSquare, Instagram, Globe, UserPlus, Bot, Edit2, TrendingUp, CheckSquare, CheckCircle2, XCircle, Trash2, Calendar, Clock, Users, Tag, GitBranch, Filter, User as UserIcon } from 'lucide-react';
// Telegram / Instagram интеграции отключены в локальной демо-версии
// import { sendClientMessage } from '../services/telegramService';
// import { instagramService } from '../services/instagramService';
import { DynamicIcon } from './AppIcons';
import { TaskSelect } from './TaskSelect';
import { Button } from './ui';
import { api } from '../backend/api';

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
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>('');
  const [funnelId, setFunnelId] = useState<string>('');
  const [dealProjectId, setDealProjectId] = useState<string>(''); // вид услуг (модуль/проект)
  const [defaultFunnelId, setDefaultFunnelId] = useState<string | undefined>(undefined);

  /** Этапы для канбана — из выбранной воронки в шапке страницы */
  const kanbanStages = useMemo(() => {
    const f = salesFunnels.find(x => x.id === selectedFunnelId);
    if (f?.stages?.length) return f.stages;
    return STAGES.map(s => ({ id: s.id, label: s.label, color: s.color }));
  }, [salesFunnels, selectedFunnelId]);

  // Получаем основную воронку из настроек
  useEffect(() => {
    const loadDefaultFunnel = async () => {
      try {
        const notificationPrefs = await api.notificationPrefs.get();
        const defaultId = notificationPrefs?.defaultFunnelId;
        setDefaultFunnelId(defaultId);
        
        // Устанавливаем основную воронку по умолчанию только при первой загрузке
        if (defaultId && salesFunnels.find(f => f.id === defaultId)) {
          setSelectedFunnelId(prev => prev || defaultId);
        } else if (salesFunnels.length > 0) {
          // Если основной воронки нет, выбираем первую
          setSelectedFunnelId(prev => prev || salesFunnels[0].id);
        }
      } catch (error) {
        console.error('Error loading default funnel:', error);
        // При ошибке выбираем первую воронку
        if (salesFunnels.length > 0) {
          setSelectedFunnelId(prev => prev || salesFunnels[0].id);
        }
      }
    };
    if (salesFunnels.length > 0) {
      loadDefaultFunnel();
    }
  }, [salesFunnels]);

  // Автоматически открываем модалку создания при монтировании, если autoOpenCreateModal = true
  useEffect(() => {
    if (autoOpenCreateModal) {
      handleOpenCreate();
    }
  }, [autoOpenCreateModal]);

  // Слушаем событие для открытия модалки из HomeView
  useEffect(() => {
    const handleOpenModal = () => {
      handleOpenCreate();
    };
    window.addEventListener('openCreateDealModal', handleOpenModal);
    return () => window.removeEventListener('openCreateDealModal', handleOpenModal);
  }, []);

  const handleOpenCreate = () => { 
    setEditingDeal(null); 
    setTitle(''); 
    setClientName(''); 
    setContactName(''); 
    setAmount(''); 
    setSource('manual'); 
    const fid = selectedFunnelId || salesFunnels[0]?.id || '';
    setFunnelId(fid);
    const fu = salesFunnels.find(f => f.id === fid);
    setStage(fu?.stages?.[0]?.id || 'new');
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
              alert('Пожалуйста, введите название сделки');
              return;
          }
          
          // Если воронка не указана, используем основную воронку из настроек
          let finalFunnelId = funnelId || selectedFunnelId;
          if (!finalFunnelId) {
              try {
                  const notificationPrefs = await api.notificationPrefs.get();
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
          
          console.log('[DEAL] Saving deal:', dealData);
          onSaveDeal(dealData);
          setIsModalOpen(false);
      } catch (error) {
          console.error('[DEAL] Error saving deal:', error);
          alert('Произошла ошибка при сохранении сделки. Попробуйте еще раз.');
      }
  };

  const handleSendChat = async () => {
      if (!chatMessage.trim() || !editingDeal) return;
      
      const deal = editingDeal;
      // Локальный демо-режим: просто добавляем комментарий в сделку, без внешних API
      const c: Comment = { 
          id: `c-${Date.now()}`, 
          text: chatMessage, 
          authorId: currentUser?.id || 'demo-user', 
          createdAt: new Date().toISOString(), 
          type: 'internal' 
      };
      const nextComments = [...(comments || []), c];
      setComments(nextComments);
      onSaveDeal({ ...deal, comments: nextComments });
      setChatMessage('');
  };

  const onDragStart = (e: React.DragEvent, id: string) => { setDraggedDealId(id); e.dataTransfer.effectAllowed = 'move'; };
  const onDrop = (e: React.DragEvent, stage: any) => { 
    e.preventDefault(); 
    if(draggedDealId) { 
      const d = deals.find(x => x.id === draggedDealId); 
      if(d && d.stage !== stage) {
        const updatedDeal = {...d, stage};
        onSaveDeal(updatedDeal);
        
        // Если перетащили на "Успех" - создаем клиента
        if (stage === 'won' && onCreateClient) {
          const existingClient = d.clientId ? clients.find(c => c.id === d.clientId) : null;
          if (!existingClient) {
            // Используем название клиента из сделки (если было введено) или название сделки
            const clientName = d.contactName || d.title; // contactName теперь хранит название клиента
          const client: Client = {
            id: `cl-${Date.now()}`,
              name: clientName,
            contactPerson: d.contactName,
              phone: undefined, // Можно добавить из комментариев
              email: undefined,
              telegram: d.telegramUsername,
              instagram: d.source === 'instagram' ? d.telegramUsername : undefined,
              companyName: d.title,
              companyInfo: d.notes,
            notes: `Создано из сделки: ${d.title}. Сумма: ${d.amount} ${d.currency}`
          };
          onCreateClient(client);
            // Обновляем сделку с clientId
            onSaveDeal({ ...updatedDeal, clientId: client.id });
          }
        }
      }
      setDraggedDealId(null); 
    } 
  };
  
  const handleCreateTask = (taskTitle: string) => {
    if (!onCreateTask || !editingDeal) return;
    
    // Получаем название компании из сделки (contactName или title)
    const companyName = editingDeal.contactName || editingDeal.title;
    
    const task: Partial<Task> = {
      entityType: 'task',
      title: `${taskTitle} - ${companyName}`,
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

  const handleMarkAsWon = () => {
    if (!editingDeal) return;
    
    // Создаем клиента при успешной сделке (если еще не создан)
    let newClientId = editingDeal.clientId;
    if (!editingDeal.clientId && onCreateClient) {
      const client: Client = {
        id: `cl-${Date.now()}`,
        name: contactName || title || editingDeal.title,
        contactPerson: contactName || editingDeal.contactName,
        phone: undefined,
        email: undefined,
        telegram: editingDeal.telegramUsername,
        instagram: source === 'instagram' ? editingDeal.telegramUsername : undefined,
        companyName: title || editingDeal.title,
        companyInfo: notes || editingDeal.notes,
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
  
  // Фильтрация сделок по выбранной воронке, исключаем архивные
  // Если выбрана основная воронка, показываем сделки с этой воронкой И сделки без воронки
  const filteredDeals = useMemo(() => {
    if (!selectedFunnelId) {
      return deals.filter(d => !d.isArchived);
    }
    
    // Если выбрана основная воронка, показываем сделки с этой воронкой и сделки без воронки
    if (selectedFunnelId === defaultFunnelId) {
      return deals.filter(d => !d.isArchived && (!d.funnelId || d.funnelId === selectedFunnelId));
    }
    
    // Для других воронок показываем только сделки с этой воронкой
    return deals.filter(d => !d.isArchived && d.funnelId === selectedFunnelId);
  }, [deals, selectedFunnelId, defaultFunnelId]);
  
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
    <div className="h-full flex flex-col min-h-0">
      <div className="max-w-7xl mx-auto w-full pt-8 px-6 flex-shrink-0">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-gray-800 dark:text-white truncate">Воронка продаж</h1>
              <p className="hidden md:block text-xs text-gray-500 dark:text-gray-400 mt-1">
                Управление сделками и продажами
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
              <div className="min-w-[160px] sm:min-w-[180px]">
                <TaskSelect
                  value={selectedFunnelId}
                  onChange={setSelectedFunnelId}
                  options={salesFunnels.map(f => ({ value: f.id, label: f.name }))}
                  className="bg-white dark:bg-[#333] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
              <Button variant="primary" size="sm" icon={Plus} onClick={handleOpenCreate}>
                <span className="hidden sm:inline">Создать</span>
                <span className="sm:hidden">+</span>
              </Button>
            </div>
          </div>
          {/* View Mode Tabs */}
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#252525] rounded-full p-1 text-xs">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-2 md:px-3 py-1.5 rounded-full ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              <span className="hidden xs:inline">Канбан</span>
              <span className="xs:hidden">Канбан</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-2 md:px-3 py-1.5 rounded-full ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              <span className="hidden xs:inline">Список</span>
              <span className="xs:hidden">Список</span>
            </button>
            <button
              onClick={() => setViewMode('rejected')}
              className={`px-2 md:px-3 py-1.5 rounded-full ${
                viewMode === 'rejected'
                  ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              <span className="hidden xs:inline">Отказы</span>
              <span className="xs:hidden">Отказы</span>
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="max-w-7xl mx-auto w-full px-6 pb-24 md:pb-32 h-full overflow-y-auto overflow-x-hidden custom-scrollbar">
          {viewMode === 'kanban' ? (
              <div className="h-full flex flex-col gap-4">
                  <div className="flex h-full overflow-x-auto gap-3 md:gap-4 pb-4">
                      {kanbanStages.map(s => (
                          <div key={s.id} className="w-64 md:w-80 flex-shrink-0 flex flex-col bg-gray-50/50 dark:bg-[#1e1e1e] rounded-lg border border-gray-200 dark:border-[#333]" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, s.id)}>
                              <div className="p-2 md:p-3 font-bold text-xs md:text-sm text-gray-700 dark:text-gray-200 flex justify-between">{s.label} <span className="bg-gray-200 dark:bg-[#333] px-2 rounded text-xs">{activeDeals.filter(d => d.stage === s.id).length}</span></div>
                              <div className="p-2 flex-1 overflow-y-auto space-y-2 custom-scrollbar min-h-0">
                                  {activeDeals.filter(d => d.stage === s.id).map(d => {
                                      const dealProject = projects.find(p => p.id === d.projectId);
                                      return (
                                          <div key={d.id} draggable onDragStart={(e) => onDragStart(e, d.id)} onClick={() => handleOpenEdit(d)} className="bg-white dark:bg-[#2b2b2b] p-2 md:p-3 rounded shadow-sm border border-gray-200 dark:border-[#3a3a3a] cursor-pointer hover:shadow-md transition-all">
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
                                      );
                                  })}
                              </div>
                          </div>
                      ))}
                  </div>
                  
                  {/* Области для перетаскивания: Успех / Отказ */}
                  <div className="flex flex-col sm:flex-row gap-3 md:gap-4 shrink-0 px-2 md:px-0">
                      <div 
                          className="flex-1 bg-green-50 dark:bg-green-900/20 border-2 border-dashed border-green-300 dark:border-green-700 rounded-lg p-3 md:p-4 flex items-center justify-center gap-2 md:gap-3"
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
                          className="flex-1 bg-red-50 dark:bg-red-900/20 border-2 border-dashed border-red-300 dark:border-red-700 rounded-lg p-3 md:p-4 flex items-center justify-center gap-2 md:gap-3"
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-[80] p-0 md:p-4" onClick={handleBackdropClick}>
              <div className="bg-white dark:bg-[#1e1e1e] w-full h-full md:h-auto md:max-h-[min(680px,92vh)] md:max-w-5xl md:rounded-xl shadow-2xl flex flex-col md:flex-row overflow-hidden border-0 md:border border-gray-200 dark:border-gray-800 rounded-t-2xl md:rounded-xl" onClick={e => e.stopPropagation()}>
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
                                          if (window.confirm('Удалить сделку в архив?')) {
                                              onDeleteDeal(editingDeal.id);
                                              setIsModalOpen(false);
                                          }
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
                              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${modalTab === 'chat' ? 'bg-[#3337AD] text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333]'}`}
                          >
                              <MessageSquare size={14} className="inline mr-1 -mt-0.5 opacity-90" />
                              Чат
                          </button>
                          <button
                              type="button"
                              onClick={() => setModalTab('tasks')}
                              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${modalTab === 'tasks' ? 'bg-[#3337AD] text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333]'}`}
                          >
                              <CheckSquare size={14} className="inline mr-1 -mt-0.5 opacity-90" />
                              Задачи
                          </button>
                          <button
                              type="button"
                              onClick={() => setModalTab('meetings')}
                              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${modalTab === 'meetings' ? 'bg-[#3337AD] text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333]'}`}
                          >
                              <Calendar size={14} className="inline mr-1 -mt-0.5 opacity-90" />
                              Встречи
                          </button>
                      </div>
                      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                          {modalTab === 'chat' ? (
                              <>
                                  <div className="flex-1 p-4 overflow-y-auto space-y-2">
                                      {comments.map(c => (
                                          <div key={c.id} className={`p-2 rounded text-sm max-w-[80%] ${c.type === 'telegram_out' ? 'bg-blue-500 text-white self-end ml-auto' : 'bg-white dark:bg-[#333] text-gray-800 dark:text-gray-200'}`}>{c.text}</div>
                                      ))}
                                  </div>
                                  <div className="p-4 border-t border-gray-200 dark:border-[#333] flex gap-2">
                                      <input value={chatMessage} onChange={e => setChatMessage(e.target.value)} className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 min-h-[36px] text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100" placeholder="Сообщение по сделке..."/>
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
                                          onClick={() => setShowTaskDropdown(!showTaskDropdown)}
                                          className="w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600"
                                      >
                                          <Plus size={18} /> Создать задачу
                                      </button>
                                      {showTaskDropdown && (
                                          <>
                                              <div className="fixed inset-0 z-30" onClick={() => setShowTaskDropdown(false)}></div>
                                              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#333] border border-gray-200 dark:border-[#444] rounded-lg shadow-lg z-40 overflow-hidden">
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
                                                              if (confirm('Удалить встречу?')) {
                                                                  onDeleteMeeting(meeting.id);
                                                              }
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
                                  {onSaveMeeting && editingDeal && (
                                      <button
                                          onClick={() => {
                                              // Создаем новую встречу, привязанную к сделке
                                              const newMeeting: Meeting = {
                                                  id: `m-${Date.now()}`,
                                                  tableId: 'meetings-system',
                                                  type: 'client',
                                                  dealId: editingDeal.id,
                                                  clientId: editingDeal.clientId,
                                                  title: `Встреча: ${editingDeal.title}`,
                                                  date: new Date().toISOString().split('T')[0],
                                                  time: '10:00',
                                                  participantIds: editingDeal.assigneeId ? [editingDeal.assigneeId] : [],
                                                  summary: '',
                                                  isArchived: false
                                              };
                                              onSaveMeeting(newMeeting);
                                          }}
                                          className="w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600"
                                      >
                                          <Plus size={18} /> Создать встречу
                                      </button>
                                  )}
                              </div>
                          ) : null}
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default SalesFunnelView;
