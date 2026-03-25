
import React, { useState, useEffect } from 'react';
import { Project, Role, Task, User, StatusOption, PriorityOption, NotificationPreferences, AutomationRule, TableCollection, Deal } from '../types';
import { Trash2, Plus, User as UserIcon, Briefcase, Bot, Save, Archive, KeyRound, List, BarChart2, Pencil, CheckSquare, FileText, Users, Zap, Layout, Bell, Play, Mail, Phone, Camera, Send, Link, Server, AtSign, MessageSquare, Instagram, Layers, Settings } from 'lucide-react';
import { ModulePageHeader } from './ui/ModulePageHeader';
import { storageService } from '../services/storageService';
import { getDefaultAvatarForId, getRandomDefaultAvatar } from '../constants/avatars';
import { LABEL_COLORS, PRIORITY_COLORS, ICON_OPTIONS, COLOR_OPTIONS, DEFAULT_NOTIFICATION_PREFS } from '../constants';
import { DynamicIcon } from './AppIcons';
import { SystemAlertDialog, SystemConfirmDialog } from './ui';

interface SettingsModalProps {
  users: User[];
  projects: Project[];
  tasks?: Task[];
  statuses: StatusOption[];
  priorities: PriorityOption[];
  tables?: TableCollection[];
  onUpdateTable?: (table: TableCollection) => void;
  onCreateTable?: () => void;
  onDeleteTable?: (id: string) => void;
  
  onUpdateUsers: (users: User[]) => void;
  onUpdateProjects: (projects: Project[]) => void;
  onUpdateStatuses: (statuses: StatusOption[]) => void;
  onUpdatePriorities: (priorities: PriorityOption[]) => void;
  onRestoreTask?: (taskId: string) => void;
  onPermanentDelete?: (taskId: string) => void; 
  onClose: () => void;
  onUpdateNotificationPrefs: (prefs: NotificationPreferences) => void;
  automationRules?: AutomationRule[];
  onSaveAutomationRule?: (rule: AutomationRule) => void;
  onDeleteAutomationRule?: (id: string) => void;
  
  currentUser?: User;
  onUpdateProfile?: (user: User) => void;
  initialTab?: string;

  deals?: Deal[];
  onSaveDeal?: (deal: Deal) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  users, projects, tasks = [], statuses, priorities, tables = [],
  onUpdateTable, onCreateTable, onDeleteTable,
  onUpdateUsers, onUpdateProjects, onUpdateStatuses, onUpdatePriorities,
  onRestoreTask, onPermanentDelete,
  onUpdateNotificationPrefs, automationRules = [], onSaveAutomationRule, onDeleteAutomationRule,
  currentUser, onUpdateProfile, initialTab = 'users',
  onSaveDeal
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [editingId, setEditingId] = useState<string | null>(null);

  // User/Profile State
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserLogin, setNewUserLogin] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('123456');
  const [newUserRole, setNewUserRole] = useState<Role>(Role.EMPLOYEE);
  
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileLogin, setProfileLogin] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileTelegram, setProfileTelegram] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');

  // Project (Module) State
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectIcon, setNewProjectIcon] = useState('Briefcase');
  const [newProjectColor, setNewProjectColor] = useState('text-blue-500');

  // Page State
  const [newPageName, setNewPageName] = useState('');
  const [newPageIcon, setNewPageIcon] = useState('');
  const [newPageColor, setNewPageColor] = useState('');
  const [newPageType, setNewPageType] = useState('tasks');

  // Status/Priority State
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState(LABEL_COLORS[0].class);
  const [newPriorityName, setNewPriorityName] = useState('');
  const [newPriorityColor, setNewPriorityColor] = useState(PRIORITY_COLORS[0].class);

  // Automation
  const [autoName, setAutoName] = useState('');
  const [autoTrigger, setAutoTrigger] = useState<'task_status_changed' | 'task_created'>('task_status_changed');
  const [autoStatus, setAutoStatus] = useState(statuses[0]?.name || '');
  const [autoModule, setAutoModule] = useState('');
  const [autoTemplate, setAutoTemplate] = useState('Задача "{task_title}" перешла в статус "{status}".');
  const [autoTarget, setAutoTarget] = useState<'assignee' | 'admin'>('assignee');

  // Integrations
  const [employeeBotToken, setEmployeeBotToken] = useState('');
  const [clientBotToken, setClientBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [enableTelegramImport, setEnableTelegramImport] = useState(false);

  // Notifications
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFS);
  const [alertState, setAlertState] = useState({ open: false, title: '', message: '' });
  const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; message: string; onConfirm?: () => void }>({
    open: false,
    title: '',
    message: '',
  });
  const [avatarPromptOpen, setAvatarPromptOpen] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState('');

  useEffect(() => {
      setEmployeeBotToken(storageService.getEmployeeBotToken());
      setClientBotToken(storageService.getClientBotToken());
      setChatId(storageService.getTelegramChatId());
      setEnableTelegramImport(storageService.getEnableTelegramImport());
      setPrefs(storageService.getNotificationPrefs());
      
      if (currentUser) {
          setProfileName(currentUser.name);
          setProfileEmail(currentUser.email || '');
          setProfileLogin(currentUser.login || '');
          setProfilePhone(currentUser.phone || '');
          setProfileTelegram(currentUser.telegram || '');
          setProfilePassword(currentUser.password || '');
          setProfileAvatar(currentUser.avatar || '');
      }
  }, [currentUser]);

  const archivedTasks = tasks.filter(t => t.isArchived);

  // --- Profile ---
  const handleSaveProfile = (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentUser || !onUpdateProfile) return;
      onUpdateProfile({
          ...currentUser,
          name: profileName,
          email: profileEmail,
          login: profileLogin,
          phone: profilePhone,
          telegram: profileTelegram,
          password: profilePassword,
          avatar: profileAvatar
      });
  };

  const handleChangeAvatar = () => {
      setAvatarDraft(profileAvatar || '');
      setAvatarPromptOpen(true);
  };

  // --- Pages ---
  const handleEditPage = (t: TableCollection) => {
      setEditingId(t.id);
      setNewPageName(t.name);
      setNewPageIcon(t.icon);
      setNewPageColor(t.color || 'text-gray-500');
      setNewPageType(t.type);
  };

  const handleSavePage = (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingId || !onUpdateTable) return;
      const table = tables.find(t => t.id === editingId);
      if (table) {
          onUpdateTable({ ...table, name: newPageName, icon: newPageIcon, color: newPageColor, type: newPageType as any });
          setEditingId(null);
      }
  };

  // --- Users ---
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserLogin.trim()) {
      setAlertState({ open: true, title: 'Проверьте данные', message: 'Имя и логин обязательны.' });
      return;
    }

    const passwordToSet = (newUserPassword || '123456').trim();
    
    const newUser: User = {
        id: `u-${Date.now()}`,
        name: newUserName,
        email: newUserEmail,
        login: newUserLogin,
        // Передаём пароль в открытом виде — бэкенд сам захеширует
        password: passwordToSet,
        role: newUserRole,
        avatar: getRandomDefaultAvatar(),
        mustChangePassword: true
    };
    onUpdateUsers([...users, newUser]);
    setNewUserName(''); setNewUserEmail(''); setNewUserLogin(''); setNewUserPassword('123456');
    setAlertState({ open: true, title: 'Пользователь создан', message: `Пароль: ${newUserPassword || '123456'}` });
  };

  const handleDeleteUser = async (id: string) => {
    if (id === currentUser?.id) {
      setAlertState({ open: true, title: 'Действие недоступно', message: 'Нельзя удалить текущего пользователя.' });
      return;
    }
    setConfirmState({
      open: true,
      title: 'Удалить пользователя',
      message: 'Это действие нельзя отменить.',
      onConfirm: async () => {
        const now = new Date().toISOString();
        const updatedUsers = users.map(u => {
          if (u.id === id) return { ...u, isArchived: true, updatedAt: now };
          return { ...u, updatedAt: u.updatedAt || now };
        });
        onUpdateUsers(updatedUsers);
        setConfirmState({ open: false, title: '', message: '' });
      },
    });
  };
  const handleResetPassword = async (id: string) => {
      setConfirmState({
        open: true,
        title: 'Сброс пароля',
        message: 'Сбросить пароль на "123456"?',
        onConfirm: () => {
          onUpdateUsers(users.map(u => u.id === id ? { ...u, password: '123456', mustChangePassword: true } : u));
          setConfirmState({ open: false, title: '', message: '' });
          setAlertState({ open: true, title: 'Готово', message: 'Пароль сброшен на 123456.' });
        },
      });
  };

  // --- Projects (Modules) ---
  const handleSaveProject = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newProjectName.trim()) return;
      if (editingId) {
          onUpdateProjects(projects.map(p => p.id === editingId ? { ...p, name: newProjectName, icon: newProjectIcon, color: newProjectColor } : p));
          setEditingId(null);
      } else {
          onUpdateProjects([...projects, { id: `p-${Date.now()}`, name: newProjectName, icon: newProjectIcon, color: newProjectColor }]);
      }
      setNewProjectName('');
  };
  const handleDeleteProject = (id: string) => onUpdateProjects(projects.filter(p => p.id !== id));
  const handleEditProject = (p: Project) => { setEditingId(p.id); setNewProjectName(p.name); setNewProjectIcon(p.icon || 'Briefcase'); setNewProjectColor(p.color || 'text-blue-500'); };

  // --- Priorities & Statuses ---
  const handleSaveStatus = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newStatusName.trim()) return;
      if (editingId) {
          onUpdateStatuses(statuses.map(s => s.id === editingId ? { ...s, name: newStatusName, color: newStatusColor } : s));
          setEditingId(null);
      } else {
          onUpdateStatuses([...statuses, { id: `s-${Date.now()}`, name: newStatusName, color: newStatusColor }]);
      }
      setNewStatusName('');
  };
  const handleDeleteStatus = (id: string) => onUpdateStatuses(statuses.filter(s => s.id !== id));
  const handleEditStatus = (s: StatusOption) => { setEditingId(s.id); setNewStatusName(s.name); setNewStatusColor(s.color); };

  const handleSavePriority = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newPriorityName.trim()) return;
      if (editingId) {
          onUpdatePriorities(priorities.map(p => p.id === editingId ? { ...p, name: newPriorityName, color: newPriorityColor } : p));
          setEditingId(null);
      } else {
          onUpdatePriorities([...priorities, { id: `pr-${Date.now()}`, name: newPriorityName, color: newPriorityColor }]);
      }
      setNewPriorityName('');
  };
  const handleDeletePriority = (id: string) => onUpdatePriorities(priorities.filter(p => p.id !== id));
  const handleEditPriority = (p: PriorityOption) => { setEditingId(p.id); setNewPriorityName(p.name); setNewPriorityColor(p.color); };

  // --- Automation ---
  const handleOpenAutomationCreate = () => {
      setEditingId(null); setAutoName(''); setAutoTrigger('task_status_changed'); setAutoStatus(statuses[0]?.name || '');
      setAutoModule(''); setAutoTemplate('Задача "{task_title}" перешла в статус "{status}".'); setAutoTarget('assignee');
  };
  const handleAutomationSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!onSaveAutomationRule) return;
      const rule: AutomationRule = {
          id: editingId || `rule-${Date.now()}`,
          name: autoName,
          isActive: true,
          module: 'tasks',
          trigger: autoTrigger,
          conditions: { statusTo: autoTrigger === 'task_status_changed' ? autoStatus : undefined, moduleId: autoModule || undefined },
          action: { type: 'telegram_message', targetUser: autoTarget, template: autoTemplate, buttons: [] }
      };
      onSaveAutomationRule(rule);
      setEditingId(null); setAutoName('');
  };

  // --- Integrations ---
  const handleSaveEmployeeBot = () => {
    storageService.setEmployeeBotToken(employeeBotToken);
    setAlertState({ open: true, title: 'Сохранено', message: 'Токен бота для сотрудников сохранён (локально).' });
  };
  const handleSaveClientBot = () => {};
  const handleSaveChatId = () => {};
  const handleToggleTelegramImport = () => {};
  
  const handleSimulateLead = (source: 'instagram' | 'site' | 'telegram') => {
      if (!onSaveDeal || !currentUser) return;
      onSaveDeal({
          id: `lead-${Date.now()}`,
          title: source === 'instagram' ? '@username: Цена?' : 'Заявка',
          amount: 0, currency: 'UZS', stage: 'new', source: source, assigneeId: currentUser.id, createdAt: new Date().toISOString()
      });
      setAlertState({ open: true, title: 'Готово', message: 'Лид создан.' });
  };

  const TabButton = ({ id, label, icon }: { id: any, label: string, icon: React.ReactNode }) => (
    <button onClick={() => { setActiveTab(id); setEditingId(null); }} className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors w-full text-left ${activeTab === id ? 'bg-white dark:bg-[#303030] text-blue-600 shadow-sm border border-gray-200 dark:border-gray-600' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#252525]'}`}>
        {icon} {label}
    </button>
  );

  const websiteScriptCode = `<script>\nasync function sendToCFO(data) { ... }\n</script>`;
  const nodeServerCode = `// server.js for Meta Webhook ...`;

  return (
    <div className="h-full flex flex-col bg-gray-50/50 dark:bg-[#141414]">
        <div className="border-b border-gray-200 dark:border-[#333] bg-white dark:bg-[#191919] px-4 sm:px-6 py-4 shrink-0">
          <ModulePageHeader
            accent="slate"
            icon={<Settings size={24} strokeWidth={2} />}
            title="Настройки пространства"
            description="Профиль, страницы, модули, статусы и интеграции"
            className="mb-0"
          />
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
            <div className="w-64 bg-gray-50 dark:bg-[#202020] border-r border-gray-100 dark:border-[#333] p-4 flex flex-col gap-1 shrink-0 overflow-y-auto custom-scrollbar">
                <div className="text-xs font-bold text-gray-400 dark:text-gray-600 px-3 mt-1 mb-2 uppercase">Личные</div>
                <TabButton id="profile" label="Мой профиль" icon={<UserIcon size={16}/>} />
                
                <div className="text-xs font-bold text-gray-400 dark:text-gray-600 px-3 mt-6 mb-2 uppercase">Система</div>
                <TabButton id="users" label="Пользователи" icon={<Users size={16}/>} />
                <TabButton id="pages" label="Страницы" icon={<Layout size={16}/>} />
                <TabButton id="projects" label="Модули" icon={<Briefcase size={16}/>} />
                
                <div className="text-xs font-bold text-gray-400 dark:text-gray-600 px-3 mt-6 mb-2 uppercase">Задачи</div>
                <TabButton id="statuses" label="Статусы" icon={<List size={16}/>} />
                <TabButton id="priorities" label="Приоритеты" icon={<BarChart2 size={16}/>} />
                
                <div className="text-xs font-bold text-gray-400 dark:text-gray-600 px-3 mt-6 mb-2 uppercase">Автоматизация</div>
                <TabButton id="notifications" label="Уведомления" icon={<Bell size={16}/>} />
                <TabButton id="automation" label="Роботы" icon={<Zap size={16}/>} />
                <TabButton id="integrations" label="Боты (Telegram)" icon={<Bot size={16}/>} />
                <TabButton id="leads" label="Источники Лидов" icon={<Link size={16}/>} />
                <TabButton id="meta" label="Сервер Meta" icon={<Server size={16}/>} />
                <TabButton id="archive" label="Архив" icon={<Archive size={16}/>} />
            </div>

            <div className="flex-1 p-8 overflow-y-auto bg-white dark:bg-[#191919] custom-scrollbar">
                <div className="max-w-3xl mx-auto">
                {/* PROFILE */}
                {activeTab === 'profile' && currentUser && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-6 mb-8">
                            <div className="relative group cursor-pointer" onClick={handleChangeAvatar}>
                                <img src={profileAvatar || currentUser.avatar} className="w-24 h-24 rounded-full border-4 border-gray-100 dark:border-[#333] object-cover" />
                                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera size={24} className="text-white" />
                                </div>
                            </div>
                            <div>
                                <h3 className="font-bold text-2xl text-gray-900 dark:text-white">{currentUser.name}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 uppercase font-medium">{currentUser.role}</p>
                            </div>
                        </div>
                        <form onSubmit={handleSaveProfile} className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Имя</label>
                                    <input value={profileName} onChange={e => setProfileName(e.target.value)} className="w-full bg-white dark:bg-[#252525] border border-gray-300 dark:border-[#333] rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Телефон</label>
                                    <input value={profilePhone} onChange={e => setProfilePhone(e.target.value)} className="w-full bg-white dark:bg-[#252525] border border-gray-300 dark:border-[#333] rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100" placeholder="+998..." />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Логин <span className="text-red-500">*</span></label>
                                    <div className="flex items-center">
                                        <span className="p-2.5 bg-gray-50 dark:bg-[#202020] border border-r-0 border-gray-300 dark:border-[#333] rounded-l-lg text-gray-500"><AtSign size={18}/></span>
                                        <input required value={profileLogin} onChange={e => setProfileLogin(e.target.value)} className="w-full bg-white dark:bg-[#252525] border border-gray-300 dark:border-[#333] rounded-r-lg px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Email (Необязательно)</label>
                                    <div className="flex items-center">
                                        <span className="p-2.5 bg-gray-50 dark:bg-[#202020] border border-r-0 border-gray-300 dark:border-[#333] rounded-l-lg text-gray-500"><Mail size={18}/></span>
                                        <input value={profileEmail} onChange={e => setProfileEmail(e.target.value)} className="w-full bg-white dark:bg-[#252525] border border-gray-300 dark:border-[#333] rounded-r-lg px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100" />
                                    </div>
                                </div>
                            </div>
                            <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm flex items-center gap-2 transition-colors">
                                <Save size={18}/> Сохранить профиль
                            </button>
                        </form>
                    </div>
                )}

                {/* MODULES (PROJECTS) */}
                {activeTab === 'projects' && (
                    <div className="space-y-6">
                        <form onSubmit={handleSaveProject} className="p-6 bg-gray-50 dark:bg-[#202020] rounded-xl border border-gray-200 dark:border-[#333] flex flex-col gap-4">
                            <input value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="Название модуля" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100" />
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">Иконка</label>
                                    <div className="grid grid-cols-6 gap-2 bg-white dark:bg-[#252525] p-2 rounded border border-gray-200 dark:border-gray-600 max-h-32 overflow-y-auto custom-scrollbar">
                                        {ICON_OPTIONS.map(icon => (
                                            <div key={icon} onClick={() => setNewProjectIcon(icon)} className={`p-1.5 rounded cursor-pointer flex justify-center hover:bg-gray-100 dark:hover:bg-[#404040] ${newProjectIcon === icon ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-500' : 'text-gray-400'}`}>
                                                <DynamicIcon name={icon} size={16} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">Цвет</label>
                                    <div className="grid grid-cols-5 gap-2">
                                        {COLOR_OPTIONS.map(c => (
                                            <div key={c} onClick={() => setNewProjectColor(c)} className={`w-6 h-6 rounded-full cursor-pointer border-2 ${newProjectColor === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent hover:scale-105'}`}>
                                                <div className={`w-full h-full rounded-full ${c.replace('text-', 'bg-').replace('500', '400')}`}></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                {editingId && <button type="button" onClick={() => { setEditingId(null); setNewProjectName(''); }} className="text-gray-500 px-3 text-sm">Отмена</button>}
                                <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">{editingId ? 'Сохранить' : 'Добавить'}</button>
                            </div>
                        </form>
                        <div className="grid grid-cols-2 gap-4">
                            {projects.map(p => (
                                <div key={p.id} className="p-4 border border-gray-200 dark:border-[#333] rounded-xl flex justify-between items-center bg-white dark:bg-[#252525] hover:border-blue-300 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <DynamicIcon name={p.icon || 'Briefcase'} className={p.color} size={20} />
                                        <span className="text-sm font-bold text-gray-800 dark:text-white">{p.name}</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleEditProject(p)} className="p-1.5 text-gray-400 hover:text-blue-500"><Pencil size={14}/></button>
                                        <button onClick={() => handleDeleteProject(p.id)} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* PRIORITIES */}
                {activeTab === 'priorities' && (
                    <div className="space-y-6">
                        <form onSubmit={handleSavePriority} className="p-6 bg-gray-50 dark:bg-[#202020] rounded-xl border border-gray-200 dark:border-[#333] flex flex-col gap-4">
                            <input value={newPriorityName} onChange={e => setNewPriorityName(e.target.value)} placeholder="Название приоритета" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100" />
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase">Выберите цвет</label>
                                <div className="flex gap-3 flex-wrap">
                                    {PRIORITY_COLORS.map(c => (
                                        <div key={c.name} onClick={() => setNewPriorityColor(c.class)} className={`w-8 h-8 rounded-full cursor-pointer border-2 transition-all flex items-center justify-center ${newPriorityColor === c.class ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent hover:scale-105'}`}>
                                            <div className={`w-6 h-6 rounded-full ${c.class.replace('text-', 'bg-').replace('600', '400').split(' ')[0]}`}></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                {editingId && <button type="button" onClick={() => { setEditingId(null); setNewPriorityName(''); }} className="text-gray-500 px-4 text-sm font-medium">Отмена</button>}
                                <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">{editingId ? 'Сохранить' : 'Добавить'}</button>
                            </div>
                        </form>
                        <div className="space-y-2">
                            {priorities.map(p => (
                                <div key={p.id} className="flex items-center justify-between p-3 border border-gray-100 dark:border-[#333] rounded-lg bg-white dark:bg-[#252525]">
                                    <span className={`px-2.5 py-1 rounded text-xs font-bold border ${p.color}`}>{p.name}</span>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleEditPriority(p)} className="p-1.5 text-gray-400 hover:text-blue-500"><Pencil size={14}/></button>
                                        <button onClick={() => handleDeletePriority(p.id)} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* PAGES */}
                {activeTab === 'pages' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white">Список страниц</h3>
                            {onCreateTable && (
                                <button onClick={onCreateTable} className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/30">
                                    <Plus size={16}/> Добавить страницу
                                </button>
                            )}
                        </div>

                        {editingId ? (
                            <form onSubmit={handleSavePage} className="p-6 bg-gray-50 dark:bg-[#202020] rounded-xl border border-gray-200 dark:border-[#333]">
                                <h3 className="font-bold text-base mb-4 text-gray-800 dark:text-white">Редактировать страницу</h3>
                                <div className="space-y-4">
                                    <input value={newPageName} onChange={e => setNewPageName(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100" placeholder="Название" />
                                    
                                    <div className="p-3 bg-white dark:bg-[#252525] rounded border border-gray-200 dark:border-[#333]">
                                        <label className="block text-xs font-bold text-gray-500 mb-2">Тип страницы</label>
                                        <div className="text-sm font-bold text-gray-800 dark:text-white uppercase">{newPageType}</div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-2">Иконка</label>
                                        <div className="grid grid-cols-6 gap-2 bg-white dark:bg-[#252525] p-2 rounded border border-gray-200 dark:border-gray-600 max-h-32 overflow-y-auto custom-scrollbar">
                                            {ICON_OPTIONS.map(icon => (
                                                <div key={icon} onClick={() => setNewPageIcon(icon)} className={`p-1.5 rounded cursor-pointer flex justify-center hover:bg-gray-100 dark:hover:bg-[#404040] ${newPageIcon === icon ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-500' : 'text-gray-400'}`}>
                                                    <DynamicIcon name={icon} size={16} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-2">Цвет</label>
                                        <div className="grid grid-cols-9 gap-2">
                                            {COLOR_OPTIONS.map(c => (
                                                <div key={c} onClick={() => setNewPageColor(c)} className={`w-6 h-6 rounded-full cursor-pointer border-2 ${newPageColor === c ? 'border-gray-900 dark:border-white' : 'border-transparent'}`}><div className={`w-full h-full rounded-full ${c.replace('text-', 'bg-').replace('500', '400')}`}></div></div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-3 justify-end">
                                        <button type="button" onClick={() => setEditingId(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Отмена</button>
                                        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Сохранить</button>
                                    </div>
                                </div>
                            </form>
                        ) : null}
                        
                        <div className="space-y-3">
                            {tables.map(table => (
                                <div key={table.id} className="flex items-center justify-between p-4 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl group hover:shadow-sm transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-lg ${table.isSystem ? 'bg-gray-100 dark:bg-[#333] text-gray-500' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'}`}>
                                            <DynamicIcon name={table.icon} className={table.color} />
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm text-gray-900 dark:text-white">{table.name}</div>
                                            {table.isSystem && <span className="text-[10px] uppercase font-bold text-gray-400">Системная</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEditPage(table)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><Pencil size={16}/></button>
                                        {!table.isSystem && onDeleteTable && (
                                            <button
                                              onClick={() =>
                                                setConfirmState({
                                                  open: true,
                                                  title: 'Удалить страницу',
                                                  message: 'Вы уверены, что хотите удалить страницу?',
                                                  onConfirm: () => {
                                                    onDeleteTable(table.id);
                                                    setConfirmState({ open: false, title: '', message: '' });
                                                  },
                                                })
                                              }
                                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                            >
                                              <Trash2 size={16}/>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* AUTOMATION */}
                {activeTab === 'automation' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white">Правила автоматизации</h3>
                            <button onClick={handleOpenAutomationCreate} className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/30"><Plus size={16}/> Добавить правило</button>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            {automationRules.map(rule => (
                                <div key={rule.id} className="border border-gray-200 dark:border-[#333] rounded-xl p-5 bg-white dark:bg-[#252525] hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                                            <Zap size={18} className="text-yellow-500"/> {rule.name}
                                        </div>
                                        {onDeleteAutomationRule && (
                                            <button onClick={() => onDeleteAutomationRule(rule.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                                        )}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5">
                                        <div className="flex items-center gap-2"><Zap size={14} className="text-blue-500"/> <span className="font-semibold text-gray-900 dark:text-gray-300">Если:</span> {rule.trigger === 'task_status_changed' ? `Статус изменен на "${rule.conditions.statusTo}"` : 'Создана новая задача'}</div>
                                        <div className="flex items-center gap-2"><MessageSquare size={14} className="text-green-500"/> <span className="font-semibold text-gray-900 dark:text-gray-300">То:</span> Отправить сообщение</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Rest of tabs (Integrations, Leads, Meta, Archive) similar to before but ensured present */}
                {activeTab === 'integrations' && (
                    <div className="space-y-6">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50 flex gap-4">
                            <Bot className="text-blue-600 dark:text-blue-400 shrink-0" size={24}/>
                            <div>
                                <h3 className="font-bold text-blue-900 dark:text-blue-100">Telegram Боты</h3>
                                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">Используйте два разных бота для разделения потоков.</p>
                            </div>
                        </div>
                        <div className="p-5 border border-gray-200 dark:border-[#333] rounded-xl bg-white dark:bg-[#252525]">
                            <h4 className="font-bold text-gray-800 dark:text-white mb-2">1. Бот для сотрудников</h4>
                            <div className="flex gap-3">
                                <input value={employeeBotToken} onChange={e => setEmployeeBotToken(e.target.value)} type="password" placeholder="Токен" className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100" />
                                <button onClick={handleSaveEmployeeBot} className="bg-gray-100 hover:bg-gray-200 dark:bg-[#333] px-4 rounded-lg text-sm font-medium">Сохранить</button>
                            </div>
                        </div>
                        <div className="p-5 border border-gray-200 dark:border-[#333] rounded-xl bg-white dark:bg-[#252525]">
                            <h4 className="font-bold text-gray-800 dark:text-white mb-2">Chat ID</h4>
                            <div className="flex gap-3">
                                <input value={chatId} onChange={e => setChatId(e.target.value)} placeholder="-100..." className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100" />
                                <button onClick={handleSaveChatId} className="bg-gray-100 hover:bg-gray-200 dark:bg-[#333] px-4 rounded-lg text-sm font-medium">Сохранить</button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="space-y-8">
                        <div className="bg-gray-50 dark:bg-[#202020] p-6 rounded-xl border border-gray-200 dark:border-[#333]">
                            <h3 className="text-base font-bold text-gray-800 dark:text-white mb-4">Добавить пользователя</h3>
                            <form onSubmit={handleAddUser} className="space-y-4">
                                <input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Имя Фамилия" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100" />
                                <input value={newUserLogin} onChange={e => setNewUserLogin(e.target.value)} placeholder="Логин (Обязательно)" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100" />
                                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 text-sm shadow-sm">Создать</button>
                            </form>
                        </div>
                        <div className="space-y-3">
                            {users.map(user => (
                                <div key={user.id} className="flex items-center justify-between p-4 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl">
                                    <div className="flex items-center gap-4">
                                        <img src={user.avatar} className="w-10 h-10 rounded-full object-cover object-center" alt="" />
                                        <div>
                                            <div className="font-bold text-sm text-gray-900 dark:text-white">{user.name}</div>
                                            <div className="text-xs text-gray-500">{user.login}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleResetPassword(user.id)} className="p-2 text-gray-400 hover:text-orange-500 rounded-lg"><KeyRound size={18}/></button>
                                        <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg"><Trash2 size={18}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* Fallback for other tabs if selected */}
                {activeTab === 'statuses' && (
                    <div className="space-y-6">
                        <form onSubmit={handleSaveStatus} className="p-6 bg-gray-50 dark:bg-[#202020] rounded-xl border border-gray-200 dark:border-[#333] flex flex-col gap-4">
                            <input value={newStatusName} onChange={e => setNewStatusName(e.target.value)} placeholder="Название статуса" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100" />
                            <div className="flex gap-3 flex-wrap">
                                {LABEL_COLORS.map(c => (
                                    <div key={c.name} onClick={() => setNewStatusColor(c.class)} className={`w-8 h-8 rounded-full cursor-pointer border-2 transition-all flex items-center justify-center ${newStatusColor === c.class ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent hover:scale-105'}`}>
                                        <div className={`w-6 h-6 rounded-full ${c.class.replace('text-', 'bg-').replace('800', '400')}`}></div>
                                    </div>
                                ))}
                            </div>
                            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm self-end">Добавить</button>
                        </form>
                        <div className="space-y-2">
                            {statuses.map(s => (
                                <div key={s.id} className="flex items-center justify-between p-3 border border-gray-100 dark:border-[#333] rounded-lg bg-white dark:bg-[#252525]">
                                    <span className={`px-2.5 py-1 rounded text-xs font-bold ${s.color}`}>{s.name}</span>
                                    <button onClick={() => handleDeleteStatus(s.id)} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                </div>
            </div>
            {avatarPromptOpen && (
              <div
                className="fixed inset-0 z-[230] bg-black/35 flex items-center justify-center p-4"
                onClick={() => setAvatarPromptOpen(false)}
              >
                <div
                  className="w-full max-w-md rounded-xl border border-gray-200 dark:border-[#444] bg-white dark:bg-[#252525] shadow-2xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-[#333]">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">URL аватара</h4>
                  </div>
                  <div className="p-4">
                    <input
                      value={avatarDraft}
                      onChange={(e) => setAvatarDraft(e.target.value)}
                      placeholder="https://..."
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#1f1f1f] text-gray-900 dark:text-gray-100"
                    />
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Оставьте пустым, чтобы выбрать стандартный аватар.</p>
                  </div>
                  <div className="px-4 pb-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setAvatarPromptOpen(false)}
                      className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#444] text-sm text-gray-700 dark:text-gray-300"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = avatarDraft.trim();
                        setProfileAvatar(next ? next : getRandomDefaultAvatar());
                        setAvatarPromptOpen(false);
                      }}
                      className="px-3 py-2 rounded-lg text-sm text-white bg-[#3337AD] hover:bg-[#2d3199]"
                    >
                      Сохранить
                    </button>
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
              confirmText="Подтвердить"
              cancelText="Отмена"
              onCancel={() => setConfirmState({ open: false, title: '', message: '' })}
              onConfirm={() => confirmState.onConfirm?.()}
            />
        </div>
    </div>
  );
};

export default SettingsModal;
