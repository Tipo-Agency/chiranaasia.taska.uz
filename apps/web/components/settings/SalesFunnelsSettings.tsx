import React, { useState } from 'react';
import { SalesFunnel, FunnelStage, NotificationPreferences, FunnelSourceConfig, User } from '../../types';
import { Plus, X, Edit2, Trash2, GripVertical, Settings, Instagram, MessageSquare, Star } from 'lucide-react';

interface SalesFunnelsSettingsProps {
    funnels: SalesFunnel[];
    users?: User[];
    onSave: (funnel: SalesFunnel) => void;
    onDelete: (id: string) => void;
    notificationPrefs?: NotificationPreferences;
    onUpdatePrefs?: (prefs: NotificationPreferences) => void;
    /** External header "+" trigger */
    createRequested?: number;
}

const DEFAULT_STAGE_COLORS = [
    'bg-gray-200 dark:bg-gray-700',
    'bg-blue-200 dark:bg-blue-900',
    'bg-purple-200 dark:bg-purple-900',
    'bg-orange-200 dark:bg-orange-900',
    'bg-green-200 dark:bg-green-900',
];

const STAGE_COLOR_OPTIONS = [
    { name: 'Gray', class: 'bg-gray-200 dark:bg-gray-700' },
    { name: 'Blue', class: 'bg-blue-200 dark:bg-blue-900' },
    { name: 'Purple', class: 'bg-purple-200 dark:bg-purple-900' },
    { name: 'Orange', class: 'bg-orange-200 dark:bg-orange-900' },
    { name: 'Green', class: 'bg-green-200 dark:bg-green-900' },
    { name: 'Red', class: 'bg-red-200 dark:bg-red-900' },
    { name: 'Pink', class: 'bg-pink-200 dark:bg-pink-900' },
    { name: 'Indigo', class: 'bg-indigo-200 dark:bg-indigo-900' },
    { name: 'Yellow', class: 'bg-yellow-200 dark:bg-yellow-900' },
    { name: 'Cyan', class: 'bg-cyan-200 dark:bg-cyan-900' },
    { name: 'Emerald', class: 'bg-emerald-200 dark:bg-emerald-900' },
    { name: 'Amber', class: 'bg-amber-200 dark:bg-amber-900' },
];

const SalesFunnelsSettings: React.FC<SalesFunnelsSettingsProps> = ({ funnels, users = [], onSave, onDelete, notificationPrefs, onUpdatePrefs, createRequested }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingFunnel, setEditingFunnel] = useState<SalesFunnel | null>(null);
    const [funnelName, setFunnelName] = useState('');
    const [stages, setStages] = useState<FunnelStage[]>([]);
    const [activeTab, setActiveTab] = useState<'stages' | 'sources'>('stages');
    // Источники
    const [instagramEnabled, setInstagramEnabled] = useState(false);
    const [instagramAccountId, setInstagramAccountId] = useState('');
    const [instagramAccessToken, setInstagramAccessToken] = useState('');
    const [instagramPageId, setInstagramPageId] = useState('');
    const [telegramEnabled, setTelegramEnabled] = useState(false);
    const [telegramBotToken, setTelegramBotToken] = useState('');

    const handleOpenCreate = () => {
        setEditingFunnel(null);
        setFunnelName('');
        setActiveTab('stages');
        // Создаем воронку с дефолтными этапами
        setStages([
            { id: 'new', label: 'Новая заявка', color: DEFAULT_STAGE_COLORS[0], taskTemplate: { enabled: true, title: 'Связаться с клиентом', assigneeMode: 'deal_assignee' } },
            { id: 'qualification', label: 'Квалификация', color: DEFAULT_STAGE_COLORS[1], taskTemplate: { enabled: true, title: 'Уточнить потребности клиента', assigneeMode: 'deal_assignee' } },
            { id: 'proposal', label: 'Предложение (КП)', color: DEFAULT_STAGE_COLORS[2], taskTemplate: { enabled: true, title: 'Подготовить и отправить коммерческое предложение', assigneeMode: 'deal_assignee' } },
            { id: 'negotiation', label: 'Переговоры', color: DEFAULT_STAGE_COLORS[3], taskTemplate: { enabled: true, title: 'Провести переговоры и зафиксировать договоренности', assigneeMode: 'deal_assignee' } },
        ]);
        // Сброс настроек источников
        setInstagramEnabled(false);
        setInstagramAccountId('');
        setInstagramAccessToken('');
        setInstagramPageId('');
        setTelegramEnabled(false);
        setTelegramBotToken('');
        setIsModalOpen(true);
    };

    React.useEffect(() => {
        if (!createRequested) return;
        handleOpenCreate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [createRequested]);

    const handleOpenEdit = (funnel: SalesFunnel) => {
        setEditingFunnel(funnel);
        setFunnelName(funnel.name);
        setStages([...funnel.stages]);
        setActiveTab('stages');
        // Загрузка настроек источников
        if (funnel.sources) {
            if (funnel.sources.instagram) {
                setInstagramEnabled(funnel.sources.instagram.enabled || false);
                setInstagramAccountId(funnel.sources.instagram.instagramAccountId || '');
                setInstagramAccessToken(funnel.sources.instagram.accessToken || '');
                setInstagramPageId(funnel.sources.instagram.pageId || '');
            } else {
                setInstagramEnabled(false);
                setInstagramAccountId('');
                setInstagramAccessToken('');
                setInstagramPageId('');
            }
            if (funnel.sources.telegram) {
                setTelegramEnabled(funnel.sources.telegram.enabled || false);
                setTelegramBotToken(funnel.sources.telegram.botToken || '');
            } else {
                setTelegramEnabled(false);
                setTelegramBotToken('');
            }
        } else {
            setInstagramEnabled(false);
            setInstagramAccountId('');
            setInstagramAccessToken('');
            setInstagramPageId('');
            setTelegramEnabled(false);
            setTelegramBotToken('');
        }
        setIsModalOpen(true);
    };

    const handleAddStage = () => {
        const newId = `stage-${Date.now()}`;
        const colorIndex = stages.length % DEFAULT_STAGE_COLORS.length;
        setStages([...stages, { id: newId, label: 'Новый этап', color: DEFAULT_STAGE_COLORS[colorIndex] }]);
    };

    const handleUpdateStage = (index: number, updates: Partial<FunnelStage>) => {
        const newStages = [...stages];
        newStages[index] = { ...newStages[index], ...updates };
        setStages(newStages);
    };

    const handleDeleteStage = (index: number) => {
        if (stages.length <= 1) {
            alert('Воронка должна содержать хотя бы один этап');
            return;
        }
        setStages(stages.filter((_, i) => i !== index));
    };

    const handleMoveStage = (index: number, direction: 'up' | 'down') => {
        if ((direction === 'up' && index === 0) || (direction === 'down' && index === stages.length - 1)) {
            return;
        }
        const newStages = [...stages];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newStages[index], newStages[targetIndex]] = [newStages[targetIndex], newStages[index]];
        setStages(newStages);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!funnelName.trim()) return;
        if (stages.length === 0) {
            alert('Добавьте хотя бы один этап');
            return;
        }

        // Собираем настройки источников
        const sources: FunnelSourceConfig = {};
        
        if (instagramEnabled) {
            if (!instagramAccountId.trim() || !instagramAccessToken.trim() || !instagramPageId.trim()) {
                alert('Для подключения Instagram заполните все поля: Account ID, Access Token, Page ID');
                return;
            }
            sources.instagram = {
                enabled: true,
                instagramAccountId: instagramAccountId.trim(),
                accessToken: instagramAccessToken.trim(),
                pageId: instagramPageId.trim(),
                lastSyncAt: editingFunnel?.sources?.instagram?.lastSyncAt,
            };
        }
        
        if (telegramEnabled) {
            if (!telegramBotToken.trim()) {
                alert('Для подключения Telegram введите токен бота');
                return;
            }
            sources.telegram = {
                enabled: true,
                botToken: telegramBotToken.trim(),
                lastSyncAt: editingFunnel?.sources?.telegram?.lastSyncAt,
            };
        }

        const funnel: SalesFunnel = {
            id: editingFunnel?.id || `funnel-${Date.now()}`,
            name: funnelName.trim(),
            stages,
            sources: Object.keys(sources).length > 0 ? sources : undefined,
            createdAt: editingFunnel?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        onSave(funnel);
        setIsModalOpen(false);
        setEditingFunnel(null);
        setFunnelName('');
        setStages([]);
        setInstagramEnabled(false);
        setInstagramAccountId('');
        setInstagramAccessToken('');
        setInstagramPageId('');
        setTelegramEnabled(false);
        setTelegramBotToken('');
    };

    const handleBackdrop = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            setIsModalOpen(false);
        }
    };

    const handleSetDefaultFunnel = (funnelId: string) => {
        if (!onUpdatePrefs || !notificationPrefs) return;
        onUpdatePrefs({
            ...notificationPrefs,
            defaultFunnelId: funnelId === notificationPrefs.defaultFunnelId ? undefined : funnelId,
        });
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Воронки продаж</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Настройка направлений продаж, этапов и источников лидов.
                </p>
            </div>

            {/* Настройка основной воронки */}
            {funnels.filter(f => !f.isArchived).length > 0 && (
                <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-[#333] flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <Star size={18} className="text-yellow-500 shrink-0" />
                                <h4 className="font-semibold text-gray-900 dark:text-white truncate">Основная воронка</h4>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Все лиды без дополнительных атрибутов будут попадать в выбранную воронку
                            </p>
                        </div>

                        {notificationPrefs?.defaultFunnelId && (
                            <button
                                onClick={() => handleSetDefaultFunnel('')}
                                className="shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                            >
                                Сбросить
                            </button>
                        )}
                    </div>

                    <div className="divide-y divide-gray-100 dark:divide-[#333]">
                        {funnels.filter(f => !f.isArchived).map((funnel) => {
                            const isSelected = notificationPrefs?.defaultFunnelId === funnel.id;
                            return (
                                <button
                                    key={funnel.id}
                                    type="button"
                                    onClick={() => handleSetDefaultFunnel(funnel.id)}
                                    className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-[#303030] transition-colors ${
                                        isSelected ? 'bg-blue-50/60 dark:bg-blue-500/10' : ''
                                    }`}
                                >
                                    <span
                                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                            isSelected
                                                ? 'border-blue-600 dark:border-blue-400'
                                                : 'border-gray-300 dark:border-gray-600'
                                        }`}
                                        aria-hidden
                                    >
                                        {isSelected && <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400" />}
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-sm font-semibold text-gray-900 dark:text-white truncate">
                                            {funnel.name}
                                        </span>
                                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                                            {funnel.stages?.length ? `${funnel.stages.length} этап(ов)` : 'Нет этапов'}
                                        </span>
                                    </span>
                                    {isSelected && (
                                        <Star size={16} className="text-yellow-500 fill-yellow-500 shrink-0" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden">
                {funnels.filter(f => !f.isArchived).length > 0 ? (
                    <div className="divide-y divide-gray-200 dark:divide-[#333]">
                        {funnels.filter(f => !f.isArchived).map(funnel => (
                            <div key={funnel.id} className="p-4 hover:bg-gray-50 dark:hover:bg-[#303030]">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-gray-800 dark:text-white mb-2">{funnel.name}</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {funnel.stages.map((stage, idx) => (
                                                <div
                                                    key={stage.id}
                                                    className={`px-3 py-1 rounded text-xs font-medium ${stage.color} text-gray-800 dark:text-gray-200`}
                                                >
                                                    {idx + 1}. {stage.label}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        <button 
                                            onClick={() => handleOpenEdit(funnel)} 
                                            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                            title="Редактировать"
                                        >
                                            <Edit2 size={16}/>
                                        </button>
                                        <button 
                                            onClick={() => { if(confirm(`Удалить воронку "${funnel.name}"?`)) onDelete(funnel.id) }} 
                                            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                            title="Удалить"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-8 text-center text-gray-400 dark:text-gray-500">
                        Нет воронок. Создайте первую воронку продаж.
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80] animate-in fade-in duration-200" onClick={handleBackdrop}>
                    <div className="bg-white dark:bg-[#252525] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-[#333] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center bg-white dark:bg-[#252525]">
                            <h3 className="font-bold text-gray-800 dark:text-white">
                                {editingFunnel ? 'Редактировать воронку' : 'Новая воронка продаж'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#333]">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                                    Название воронки (направление)
                                </label>
                                <input 
                                    required 
                                    value={funnelName} 
                                    onChange={e => setFunnelName(e.target.value)} 
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none" 
                                    placeholder="Например: Веб-разработка, Дизайн, Консалтинг"
                                />
                            </div>

                            {/* Вкладки: Этапы и Источники */}
                            <div className="flex gap-2 border-b border-gray-200 dark:border-[#333]">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('stages')}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                        activeTab === 'stages'
                                            ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                    }`}
                                >
                                    Этапы воронки
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('sources')}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                        activeTab === 'sources'
                                            ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Settings size={16} />
                                        Источники лидов
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    disabled
                                    className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-400 dark:text-gray-500 cursor-not-allowed"
                                >
                                    Автоматизация в этапах
                                </button>
                            </div>

                            {activeTab === 'stages' && (

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400">
                                        Этапы воронки
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleAddStage}
                                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                    >
                                        <Plus size={14} /> Добавить этап
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {stages.map((stage, index) => (
                                        <div key={stage.id} className="p-3 border border-gray-200 dark:border-[#333] rounded space-y-3">
                                            <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1 text-gray-400 shrink-0">
                                                <GripVertical size={16} />
                                                <span className="text-xs w-6 text-center">{index + 1}</span>
                                            </div>
                                            <input
                                                value={stage.label}
                                                onChange={e => handleUpdateStage(index, { label: e.target.value })}
                                                className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 outline-none"
                                                placeholder="Название этапа"
                                            />
                                            <div className="flex items-center gap-2">
                                                <div className={`w-8 h-8 rounded border-2 border-gray-300 dark:border-gray-600 ${stage.color}`}></div>
                                                <select
                                                    value={stage.color}
                                                    onChange={e => handleUpdateStage(index, { color: e.target.value })}
                                                    className="w-40 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 outline-none"
                                                >
                                                    {STAGE_COLOR_OPTIONS.map(color => (
                                                        <option key={color.class} value={color.class}>
                                                            {color.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleMoveStage(index, 'up')}
                                                disabled={index === 0}
                                                className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#333] rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                ↑
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleMoveStage(index, 'down')}
                                                disabled={index === stages.length - 1}
                                                className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#333] rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                ↓
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteStage(index)}
                                                disabled={stages.length <= 1}
                                                className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                            </div>
                                            <div className="rounded-lg bg-gray-50 dark:bg-[#2b2b2b] p-3 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Авто-задача для этапа</p>
                                                    <input
                                                        type="checkbox"
                                                        checked={stage.taskTemplate?.enabled !== false}
                                                        onChange={(e) =>
                                                            handleUpdateStage(index, {
                                                                taskTemplate: {
                                                                    ...(stage.taskTemplate || {}),
                                                                    enabled: e.target.checked,
                                                                },
                                                            })
                                                        }
                                                    />
                                                </div>
                                                <input
                                                    value={stage.taskTemplate?.title || ''}
                                                    onChange={(e) =>
                                                        handleUpdateStage(index, {
                                                            taskTemplate: {
                                                                ...(stage.taskTemplate || {}),
                                                                title: e.target.value,
                                                            },
                                                        })
                                                    }
                                                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100"
                                                    placeholder={index === 0 ? 'Например: Связаться с клиентом' : 'Например: Обновить КП и созвониться'}
                                                />
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    <select
                                                        value={stage.taskTemplate?.assigneeMode || 'deal_assignee'}
                                                        onChange={(e) =>
                                                            handleUpdateStage(index, {
                                                                taskTemplate: {
                                                                    ...(stage.taskTemplate || {}),
                                                                    assigneeMode: e.target.value as 'deal_assignee' | 'specific_user',
                                                                },
                                                            })
                                                        }
                                                        className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100"
                                                    >
                                                        <option value="deal_assignee">Ответственный по сделке</option>
                                                        <option value="specific_user">Конкретный сотрудник</option>
                                                    </select>
                                                    {(stage.taskTemplate?.assigneeMode || 'deal_assignee') === 'specific_user' && (
                                                        <select
                                                            value={stage.taskTemplate?.assigneeUserId || ''}
                                                            onChange={(e) =>
                                                                handleUpdateStage(index, {
                                                                    taskTemplate: {
                                                                        ...(stage.taskTemplate || {}),
                                                                        assigneeUserId: e.target.value,
                                                                    },
                                                                })
                                                            }
                                                            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100"
                                                        >
                                                            <option value="">Выберите сотрудника</option>
                                                            {users.filter((u) => !u.isArchived).map((u) => (
                                                                <option key={u.id} value={u.id}>{u.name}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            )}

                            {activeTab === 'sources' && (
                                <div className="space-y-6">
                                    {/* Instagram источник */}
                                    <div className="border border-gray-200 dark:border-[#333] rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <Instagram size={20} className="text-pink-600" />
                                                <div>
                                                    <h4 className="font-semibold text-gray-800 dark:text-white">Instagram</h4>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        Автоматическое получение лидов из Instagram Direct Messages
                                                    </p>
                                                </div>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={instagramEnabled}
                                                    onChange={e => setInstagramEnabled(e.target.checked)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>

                                        {instagramEnabled && (
                                            <div className="space-y-3 mt-4 pt-4 border-t border-gray-200 dark:border-[#333]">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                                                        Instagram Account ID <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        value={instagramAccountId}
                                                        onChange={e => setInstagramAccountId(e.target.value)}
                                                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 outline-none"
                                                        placeholder="17841405309211844"
                                                    />
                                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                        ID Instagram Business аккаунта из Meta Graph API
                                                    </p>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                                                        Access Token <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="password"
                                                        value={instagramAccessToken}
                                                        onChange={e => setInstagramAccessToken(e.target.value)}
                                                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 outline-none"
                                                        placeholder="Long-lived access token"
                                                    />
                                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                        Долгосрочный токен доступа (Long-lived Access Token)
                                                    </p>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                                                        Facebook Page ID <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        value={instagramPageId}
                                                        onChange={e => setInstagramPageId(e.target.value)}
                                                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 outline-none"
                                                        placeholder="123456789012345"
                                                    />
                                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                        ID Facebook страницы, к которой привязан Instagram
                                                    </p>
                                                </div>
                                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3">
                                                    <p className="text-xs text-blue-800 dark:text-blue-300">
                                                        <strong>Инструкция:</strong> Для подключения Instagram нужен профессиональный аккаунт, связанный с Facebook страницей через Meta Business Manager. 
                                                        Подробная инструкция по настройке доступна в документации.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Telegram источник */}
                                    <div className="border border-gray-200 dark:border-[#333] rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <MessageSquare size={20} className="text-blue-600" />
                                                <div>
                                                    <h4 className="font-semibold text-gray-800 dark:text-white">Telegram бот</h4>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        Автоматическое получение лидов через Telegram бота
                                                    </p>
                                                </div>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={telegramEnabled}
                                                    onChange={e => setTelegramEnabled(e.target.checked)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>

                                        {telegramEnabled && (
                                            <div className="space-y-3 mt-4 pt-4 border-t border-gray-200 dark:border-[#333]">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                                                        Токен бота <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="password"
                                                        value={telegramBotToken}
                                                        onChange={e => setTelegramBotToken(e.target.value)}
                                                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 outline-none"
                                                        placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                                                    />
                                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                        Токен бота, полученный от @BotFather
                                                    </p>
                                                </div>
                                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3">
                                                    <p className="text-xs text-blue-800 dark:text-blue-300">
                                                        <strong>Инструкция:</strong> Создайте бота через @BotFather в Telegram, получите токен и введите его здесь. 
                                                        Бот будет автоматически получать сообщения и создавать лиды в этой воронке.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-[#333]">
                                <button 
                                    type="button" 
                                    onClick={() => setIsModalOpen(false)} 
                                    className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#303030] rounded-lg"
                                >
                                    Отмена
                                </button>
                                <button 
                                    type="submit" 
                                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm"
                                >
                                    {editingFunnel ? 'Сохранить' : 'Создать'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesFunnelsSettings;

