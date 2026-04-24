
import React, { useMemo, useState } from 'react';
import { AutomationRule, NotificationPreferences, StatusOption } from '../../types';
import { MessageSquare, Send, Trash2, Zap } from 'lucide-react';
import { EntitySearchSelect } from '../ui/EntitySearchSelect';
import { Button } from '../ui';

interface AutomationSettingsProps {
  activeTab: string;
  automationRules: AutomationRule[];
  notificationPrefs: NotificationPreferences;
  statuses: StatusOption[];
  onSaveRule: (rule: AutomationRule) => void;
  onDeleteRule: (id: string) => void;
  onUpdatePrefs: (prefs: NotificationPreferences) => void;
}

export const AutomationSettings: React.FC<AutomationSettingsProps> = ({
    activeTab, automationRules, notificationPrefs, statuses,
    onSaveRule, onDeleteRule, onUpdatePrefs
}) => {
    const [automationModule, setAutomationModule] = useState<AutomationRule['module']>('tasks');
    
    // Защита от undefined - используем значения по умолчанию
    const safePrefs = useMemo(() => {
        const defaultPrefs = { telegramPersonal: true, telegramGroup: false };
        return {
            // Задачи
            newTask: notificationPrefs?.newTask || defaultPrefs,
            statusChange: notificationPrefs?.statusChange || defaultPrefs,
            taskAssigned: notificationPrefs?.taskAssigned || defaultPrefs,
            taskComment: notificationPrefs?.taskComment || defaultPrefs,
            taskDeadline: notificationPrefs?.taskDeadline || defaultPrefs,
            // Документы
            docCreated: notificationPrefs?.docCreated || defaultPrefs,
            docUpdated: notificationPrefs?.docUpdated || defaultPrefs,
            docShared: notificationPrefs?.docShared || defaultPrefs,
            // Встречи
            meetingCreated: notificationPrefs?.meetingCreated || defaultPrefs,
            meetingReminder: notificationPrefs?.meetingReminder || defaultPrefs,
            meetingUpdated: notificationPrefs?.meetingUpdated || defaultPrefs,
            // Контент-план
            postCreated: notificationPrefs?.postCreated || defaultPrefs,
            postStatusChanged: notificationPrefs?.postStatusChanged || defaultPrefs,
            // Финансы
            purchaseRequestCreated: notificationPrefs?.purchaseRequestCreated || defaultPrefs,
            purchaseRequestStatusChanged: notificationPrefs?.purchaseRequestStatusChanged || defaultPrefs,
            financePlanUpdated: notificationPrefs?.financePlanUpdated || defaultPrefs,
            // CRM
            dealCreated: notificationPrefs?.dealCreated || defaultPrefs,
            dealStatusChanged: notificationPrefs?.dealStatusChanged || defaultPrefs,
            clientCreated: notificationPrefs?.clientCreated || defaultPrefs,
            contractCreated: notificationPrefs?.contractCreated || defaultPrefs,
            // Сотрудники
            employeeCreated: notificationPrefs?.employeeCreated || defaultPrefs,
            employeeUpdated: notificationPrefs?.employeeUpdated || defaultPrefs,
            // Бизнес-процессы
            processStarted: notificationPrefs?.processStarted || defaultPrefs,
            processStepCompleted: notificationPrefs?.processStepCompleted || defaultPrefs,
            processStepRequiresApproval: notificationPrefs?.processStepRequiresApproval || defaultPrefs,
        };
    }, [notificationPrefs]);

    // Automation Form
    const [autoName, setAutoName] = useState('');
    const [autoTrigger, setAutoTrigger] = useState<AutomationRule['trigger']>('task_created');
    const [autoStatusTo, setAutoStatusTo] = useState(statuses[0]?.name || '');
    const [autoTemplate, setAutoTemplate] = useState('Задача "{task_title}" перешла в статус "{status}".');
    const [autoTarget, setAutoTarget] = useState<'assignee' | 'creator' | 'admin' | 'specific' | 'manager'>('assignee');
    const [autoActionType, setAutoActionType] = useState<'telegram_message' | 'approval_request'>('telegram_message');
    const [autoApprovalType, setAutoApprovalType] = useState<'purchase_request' | 'process_step' | 'document' | 'deal'>('purchase_request');
    const safeChannels = notificationPrefs?.channels || { in_app: true, chat: true, telegram: false, email: false };
    const safeQuietHours = notificationPrefs?.quietHours || { enabled: false, start: '22:00', end: '08:00', timezone: 'Asia/Tashkent' };

    const handleTogglePref = (key: keyof NotificationPreferences, channel: 'telegramPersonal' | 'telegramGroup') => {
        const currentPrefs = notificationPrefs || safePrefs;
        onUpdatePrefs({
            ...currentPrefs,
            [key]: { ...(currentPrefs[key] || { telegramPersonal: true, telegramGroup: false }), [channel]: !(currentPrefs[key]?.[channel] ?? (channel === 'telegramPersonal' ? true : false)) }
        });
    };

    const handleAutomationSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const rule: AutomationRule = {
            id: `rule-${Date.now()}`,
            name: autoName,
            isActive: true,
            module: automationModule,
            trigger: autoTrigger,
            conditions: { 
                statusTo: autoTrigger.includes('status') ? autoStatusTo : undefined
            },
            action: {
                type: autoActionType,
                template: autoActionType === 'telegram_message' ? autoTemplate : undefined,
                targetUser: autoTarget,
                approvalType: autoActionType === 'approval_request' ? autoApprovalType : undefined,
                buttons: autoActionType === 'approval_request' ? [
                    { text: 'Одобрить', action: 'approve' },
                    { text: 'Отклонить', action: 'reject' },
                    { text: 'Перенести', action: 'defer' }
                ] : undefined
            }
        };
        onSaveRule(rule);
        setAutoName('');
    };

    const handleToggleGlobalChannel = (channel: 'in_app' | 'chat' | 'telegram' | 'email') => {
        onUpdatePrefs({
            ...(notificationPrefs || safePrefs),
            channels: {
                ...safeChannels,
                [channel]: !safeChannels[channel],
            },
        });
    };

    const handleQuietHoursChange = (patch: Partial<NonNullable<NotificationPreferences['quietHours']>>) => {
        onUpdatePrefs({
            ...(notificationPrefs || safePrefs),
            quietHours: {
                ...safeQuietHours,
                ...patch,
            },
        });
    };

    const defaultCalColors = { client: '#0ea5e9', work: '#8b5cf6', project: '#10b981', shoot: '#f97316' };
    const calColors = { ...defaultCalColors, ...(notificationPrefs?.calendarColors || {}) };
    const setCalColor = (key: keyof NonNullable<NotificationPreferences['calendarColors']>, hex: string) => {
        onUpdatePrefs({
            ...(notificationPrefs || safePrefs),
            calendarColors: { ...calColors, [key]: hex },
        });
    };

    const getModuleTriggers = (module: AutomationRule['module']): { value: AutomationRule['trigger'], label: string }[] => {
        switch(module) {
            case 'tasks':
                return [
                    { value: 'task_created', label: 'Создана задача' },
                    { value: 'task_status_changed', label: 'Изменен статус задачи' },
                    { value: 'task_assigned', label: 'Назначен исполнитель' },
                    { value: 'task_comment', label: 'Добавлен комментарий' },
                    { value: 'task_deadline', label: 'Приближается дедлайн' }
                ];
            case 'docs':
                return [
                    { value: 'doc_created', label: 'Создан документ' },
                    { value: 'doc_updated', label: 'Обновлен документ' },
                    { value: 'doc_shared', label: 'Документ расшарен' }
                ];
            case 'meetings':
                return [
                    { value: 'meeting_created', label: 'Создана встреча' },
                    { value: 'meeting_reminder', label: 'Напоминание о встрече' },
                    { value: 'meeting_updated', label: 'Обновлена встреча' }
                ];
            case 'content':
                return [
                    { value: 'post_created', label: 'Создан пост' },
                    { value: 'post_status_changed', label: 'Изменен статус поста' }
                ];
            case 'finance':
                return [
                    { value: 'purchase_request_created', label: 'Создана заявка на приобретение' },
                    { value: 'purchase_request_status_changed', label: 'Изменен статус заявки' },
                    { value: 'finance_plan_updated', label: 'Обновлён план' }
                ];
            case 'crm':
                return [
                    { value: 'deal_created', label: 'Создана сделка' },
                    { value: 'deal_status_changed', label: 'Изменен статус сделки' },
                    { value: 'client_created', label: 'Создан клиент' },
                    { value: 'contract_created', label: 'Создан договор' }
                ];
            case 'employees':
                return [
                    { value: 'employee_created', label: 'Создан сотрудник' },
                    { value: 'employee_updated', label: 'Обновлен сотрудник' }
                ];
            case 'bpm':
                return [
                    { value: 'process_started', label: 'Запущен процесс' },
                    { value: 'process_step_completed', label: 'Завершен этап процесса' },
                    { value: 'process_step_requires_approval', label: 'Требуется согласование этапа' }
                ];
            default:
                return [];
        }
    };

    const getModuleNotificationPrefs = (module: AutomationRule['module']): { key: keyof NotificationPreferences, label: string, description: string }[] => {
        switch(module) {
            case 'tasks':
                return [
                    { key: 'newTask', label: 'Новая задача', description: 'Когда вас назначают ответственным' },
                    { key: 'statusChange', label: 'Смена статуса', description: 'Когда статус вашей задачи меняется' },
                    { key: 'taskAssigned', label: 'Назначен исполнитель', description: 'Когда назначают исполнителя' },
                    { key: 'taskComment', label: 'Комментарий', description: 'Когда добавляют комментарий к задаче' },
                    { key: 'taskDeadline', label: 'Дедлайн', description: 'Напоминание о приближающемся дедлайне' }
                ];
            case 'docs':
                return [
                    { key: 'docCreated', label: 'Создан документ', description: 'Когда создается новый документ' },
                    { key: 'docUpdated', label: 'Обновлен документ', description: 'Когда документ обновляется' },
                    { key: 'docShared', label: 'Документ расшарен', description: 'Когда документ расшаривается' }
                ];
            case 'meetings':
                return [
                    { key: 'meetingCreated', label: 'Создана встреча', description: 'Когда создается новая встреча' },
                    { key: 'meetingReminder', label: 'Напоминание о встрече', description: 'Напоминание перед встречей' },
                    { key: 'meetingUpdated', label: 'Обновлена встреча', description: 'Когда встреча обновляется' }
                ];
            case 'content':
                return [
                    { key: 'postCreated', label: 'Создан пост', description: 'Когда создается новый пост' },
                    { key: 'postStatusChanged', label: 'Изменен статус поста', description: 'Когда меняется статус поста' }
                ];
            case 'finance':
                return [
                    { key: 'purchaseRequestCreated', label: 'Создана заявка', description: 'Когда создается заявка на приобретение' },
                    { key: 'purchaseRequestStatusChanged', label: 'Изменен статус заявки', description: 'Когда меняется статус заявки' },
                    { key: 'financePlanUpdated', label: 'Обновлён план', description: 'Когда обновляется план' }
                ];
            case 'crm':
                return [
                    { key: 'dealCreated', label: 'Создана сделка', description: 'Когда создается новая сделка' },
                    { key: 'dealStatusChanged', label: 'Изменен статус сделки', description: 'Когда меняется статус сделки' },
                    { key: 'clientCreated', label: 'Создан клиент', description: 'Когда создается новый клиент' },
                    { key: 'contractCreated', label: 'Создан договор', description: 'Когда создается новый договор' }
                ];
            case 'employees':
                return [
                    { key: 'employeeCreated', label: 'Создан сотрудник', description: 'Когда создается новый сотрудник' },
                    { key: 'employeeUpdated', label: 'Обновлен сотрудник', description: 'Когда обновляется сотрудник' }
                ];
            case 'bpm':
                return [
                    { key: 'processStarted', label: 'Запущен процесс', description: 'Когда запускается бизнес-процесс' },
                    { key: 'processStepCompleted', label: 'Завершен этап', description: 'Когда завершается этап процесса' },
                    { key: 'processStepRequiresApproval', label: 'Требуется согласование', description: 'Когда требуется согласование этапа' }
                ];
            default:
                return [];
        }
    };

    if (activeTab === 'notifications' || activeTab === 'events') {
        const isTriggers = activeTab === 'events';

        return (
            <div className="space-y-6 w-full max-w-none">
                <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="min-w-0">
                            <div className="text-sm font-bold text-gray-900 dark:text-white">
                                {isTriggers ? 'Триггеры' : 'Уведомления'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {isTriggers
                                    ? 'Автоматические правила: событие → действие.'
                                    : 'Каналы доставки и Telegram-настройки.'}
                            </div>
                        </div>

                        <div className="w-full sm:w-[320px]">
                            <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                                Модуль
                            </div>
                            <EntitySearchSelect
                                value={automationModule}
                                onChange={(val) => setAutomationModule(val as AutomationRule['module'])}
                                options={[
                                    { value: 'tasks', label: 'Задачи', searchText: 'задачи tasks' },
                                    { value: 'docs', label: 'Документы', searchText: 'документы docs' },
                                    { value: 'meetings', label: 'Встречи', searchText: 'встречи meetings' },
                                    { value: 'content', label: 'Контент-план', searchText: 'контент content' },
                                    { value: 'finance', label: 'Финансы', searchText: 'финансы finance' },
                                    { value: 'crm', label: 'CRM', searchText: 'crm сделки' },
                                    { value: 'employees', label: 'Сотрудники', searchText: 'сотрудники employees hr' },
                                    { value: 'bpm', label: 'Бизнес-процессы', searchText: 'bpm процессы' },
                                ]}
                                searchPlaceholder="Модуль…"
                            />
                        </div>
                    </div>
                </div>

                {!isTriggers && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-4 sm:p-6">
                            <div className="text-sm font-bold text-gray-900 dark:text-white">
                                Каналы доставки
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Что именно включено у пользователя — зависит от его настроек и прав.
                            </div>

                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    { key: 'in_app', label: 'В системе' },
                                    { key: 'chat', label: 'В чате' },
                                    { key: 'telegram', label: 'Telegram' },
                                    { key: 'email', label: 'Email' },
                                ].map((channel) => (
                                    <label
                                        key={channel.key}
                                        className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-[#303030]"
                                    >
                                        <span className="text-gray-800 dark:text-gray-200 font-semibold">
                                            {channel.label}
                                        </span>
                                        <input
                                            type="checkbox"
                                            checked={Boolean(safeChannels[channel.key as keyof typeof safeChannels])}
                                            onChange={() =>
                                                handleToggleGlobalChannel(
                                                    channel.key as 'in_app' | 'chat' | 'telegram' | 'email'
                                                )
                                            }
                                            className="rounded text-blue-600 focus:ring-0"
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-4 sm:p-6">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-sm font-bold text-gray-900 dark:text-white">
                                        Тихие часы
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        Не отправлять уведомления в выбранное время.
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(safeQuietHours.enabled)}
                                        onChange={() => handleQuietHoursChange({ enabled: !safeQuietHours.enabled })}
                                        className="rounded text-blue-600 focus:ring-0"
                                    />
                                    Включить
                                </label>
                            </div>

                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <input
                                    type="time"
                                    value={safeQuietHours.start || '22:00'}
                                    onChange={(e) => handleQuietHoursChange({ start: e.target.value })}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100"
                                />
                                <input
                                    type="time"
                                    value={safeQuietHours.end || '08:00'}
                                    onChange={(e) => handleQuietHoursChange({ end: e.target.value })}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100"
                                />
                                <input
                                    type="text"
                                    value={safeQuietHours.timezone || 'Asia/Tashkent'}
                                    onChange={(e) => handleQuietHoursChange({ timezone: e.target.value })}
                                    placeholder="Asia/Tashkent"
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100"
                                />
                            </div>
                        </div>

                        <div className="lg:col-span-2 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-4 sm:p-6">
                            <div className="flex items-center gap-2 mb-1">
                                <Send size={14} className="text-sky-500 shrink-0" />
                                <div className="text-sm font-bold text-gray-900 dark:text-white">Мой Telegram</div>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-4">
                                Укажите ваш Telegram Chat ID, чтобы получать личные уведомления.
                                Узнать ID можно у бота <span className="font-mono bg-gray-100 dark:bg-[#333] px-1 rounded">@userinfobot</span> или
                                через команду <span className="font-mono bg-gray-100 dark:bg-[#333] px-1 rounded">/start</span> у бота Taska.
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="text"
                                    value={notificationPrefs?.telegramChatId ?? ''}
                                    onChange={(e) =>
                                        onUpdatePrefs({
                                            ...(notificationPrefs || safePrefs),
                                            telegramChatId: e.target.value || undefined,
                                        })
                                    }
                                    placeholder="Например: 123456789"
                                    className="flex-1 max-w-xs border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100 placeholder-gray-400 font-mono"
                                />
                                {notificationPrefs?.telegramChatId && (
                                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Сохранён</span>
                                )}
                            </div>
                            {safeChannels.telegram === false && (
                                <div className="mt-3 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-xl px-3 py-2">
                                    Включите канал <strong>Telegram</strong> выше, чтобы уведомления доходили.
                                </div>
                            )}
                        </div>

                        <div className="lg:col-span-2 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-4 sm:p-6">
                            <div className="text-sm font-bold text-gray-900 dark:text-white">Цвета в модуле «Календарь»</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-4">
                                Карточки событий по типу: клиент, команда, проект, съёмка.
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {(
                                    [
                                        { key: 'client' as const, label: 'С клиентом' },
                                        { key: 'work' as const, label: 'Команда' },
                                        { key: 'project' as const, label: 'Проект' },
                                        { key: 'shoot' as const, label: 'Съёмка' },
                                    ] as const
                                ).map(({ key, label }) => (
                                    <label key={key} className="block space-y-1">
                                        <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{label}</span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="color"
                                                value={calColors[key]}
                                                onChange={(e) => setCalColor(key, e.target.value)}
                                                className="h-10 w-14 rounded border border-gray-200 dark:border-[#444] cursor-pointer bg-transparent"
                                            />
                                            <span className="text-xs font-mono text-gray-600 dark:text-gray-400">{calColors[key]}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="lg:col-span-2 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-100 dark:border-[#333]">
                                <div className="text-sm font-bold text-gray-900 dark:text-white">
                                    Telegram уведомления по событиям
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    Для выбранного модуля: {getModuleNotificationPrefs(automationModule).length} вариантов.
                                </div>
                            </div>

                            <div className="divide-y divide-gray-100 dark:divide-[#333]">
                                {getModuleNotificationPrefs(automationModule).map((pref) => (
                                    <div key={pref.key} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                                {pref.label}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                {pref.description}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 shrink-0">
                                            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={safePrefs[pref.key].telegramPersonal}
                                                    onChange={() => handleTogglePref(pref.key, 'telegramPersonal')}
                                                    className="rounded text-blue-600 focus:ring-0"
                                                />
                                                Личное
                                            </label>
                                            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={safePrefs[pref.key].telegramGroup}
                                                    onChange={() => handleTogglePref(pref.key, 'telegramGroup')}
                                                    className="rounded text-blue-600 focus:ring-0"
                                                />
                                                Группа
                                            </label>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {isTriggers && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-100 dark:border-[#333]">
                                <div className="text-sm font-bold text-gray-900 dark:text-white">
                                    Создать триггер
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    Событие → условия → действие.
                                </div>
                            </div>

                            <form onSubmit={handleAutomationSubmit} className="p-4 sm:p-6 space-y-4">
                                <div>
                                    <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                                        Название
                                    </div>
                                    <input
                                        required
                                        value={autoName}
                                        onChange={(e) => setAutoName(e.target.value)}
                                        placeholder="Например: Напомнить о дедлайне"
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100"
                                    />
                                </div>

                                <div>
                                    <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                                        Событие
                                    </div>
                                    <EntitySearchSelect
                                        value={autoTrigger}
                                        onChange={(val) => setAutoTrigger(val as AutomationRule['trigger'])}
                                        options={getModuleTriggers(automationModule).map((t) => ({
                                            value: t.value,
                                            label: t.label,
                                            searchText: `${t.label} ${t.value}`,
                                        }))}
                                        searchPlaceholder="Событие…"
                                    />
                                </div>

                                {autoTrigger.includes('status') && (
                                    <div>
                                        <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                                            Условие: статус стал
                                        </div>
                                        <EntitySearchSelect
                                            value={autoStatusTo}
                                            onChange={setAutoStatusTo}
                                            options={statuses
                                                .filter((s) => !s.isArchived)
                                                .map((s) => ({ value: s.name, label: s.name, searchText: s.name }))}
                                            searchPlaceholder="Статус…"
                                        />
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                                            Действие
                                        </div>
                                        <EntitySearchSelect
                                            value={autoActionType}
                                            onChange={(val) =>
                                                setAutoActionType(val as 'telegram_message' | 'approval_request')
                                            }
                                            options={[
                                                { value: 'telegram_message', label: 'Сообщение', searchText: 'сообщение telegram' },
                                                { value: 'approval_request', label: 'Согласование', searchText: 'согласование approval' },
                                            ]}
                                            searchPlaceholder="Действие…"
                                        />
                                    </div>

                                    <div>
                                        <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                                            Получатель
                                        </div>
                                        <EntitySearchSelect
                                            value={autoTarget}
                                            onChange={(val) => setAutoTarget(val as 'assignee' | 'creator' | 'manager' | 'admin' | 'specific')}
                                            options={[
                                                { value: 'assignee', label: 'Исполнитель', searchText: 'исполнитель assignee' },
                                                { value: 'creator', label: 'Создатель', searchText: 'создатель creator' },
                                                { value: 'manager', label: 'Руководитель', searchText: 'руководитель manager' },
                                                { value: 'admin', label: 'Администратор', searchText: 'администратор admin' },
                                                { value: 'specific', label: 'Пользователь', searchText: 'пользователь specific' },
                                            ]}
                                            searchPlaceholder="Получатель…"
                                        />
                                    </div>
                                </div>

                                {autoActionType === 'approval_request' && (
                                    <div>
                                        <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                                            Тип согласования
                                        </div>
                                        <EntitySearchSelect
                                            value={autoApprovalType}
                                            onChange={(val) => setAutoApprovalType(val as 'purchase_request' | 'process_step' | 'document' | 'deal')}
                                            options={[
                                                { value: 'purchase_request', label: 'Заявка на приобретение', searchText: 'заявка приобретение purchase' },
                                                { value: 'process_step', label: 'Этап бизнес‑процесса', searchText: 'этап bpm процесс process_step' },
                                                { value: 'document', label: 'Документ', searchText: 'документ document' },
                                                { value: 'deal', label: 'Сделка', searchText: 'сделка deal crm' },
                                            ]}
                                            searchPlaceholder="Тип…"
                                        />
                                    </div>
                                )}

                                {autoActionType === 'telegram_message' && (
                                    <div>
                                        <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                                            Текст сообщения
                                        </div>
                                        <textarea
                                            value={autoTemplate}
                                            onChange={(e) => setAutoTemplate(e.target.value)}
                                            className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100"
                                            rows={3}
                                        />
                                        <div className="text-[11px] text-gray-400 mt-1">
                                            Переменные: {'{task_title}'}, {'{status}'}, {'{priority}'},{' '}
                                            {'{user_name}'}
                                        </div>
                                    </div>
                                )}

                                <Button type="submit" size="md" fullWidth>
                                    Создать
                                </Button>
                            </form>
                        </div>

                        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-100 dark:border-[#333]">
                                <div className="text-sm font-bold text-gray-900 dark:text-white">
                                    Активные триггеры
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    Для выбранного модуля.
                                </div>
                            </div>

                            <div className="divide-y divide-gray-100 dark:divide-[#333]">
                                {automationRules.filter((r) => !r.isArchived && r.module === automationModule).map((rule) => (
                                    <div key={rule.id} className="px-4 py-3 flex items-start gap-3">
                                        <div className="mt-0.5 text-yellow-500 shrink-0">
                                            <Zap size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                                {rule.name}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                <span className="font-semibold">Если:</span>{' '}
                                                {getModuleTriggers(rule.module).find((t) => t.value === rule.trigger)
                                                    ?.label || rule.trigger}
                                                {' · '}
                                                <span className="font-semibold">То:</span>{' '}
                                                {rule.action.type === 'approval_request'
                                                    ? 'Согласование'
                                                    : 'Сообщение'}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onDeleteRule(rule.id)}
                                            className="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-gray-50 dark:hover:bg-[#303030]"
                                            title="Удалить"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}

                                {automationRules.filter((r) => !r.isArchived && r.module === automationModule).length === 0 && (
                                    <div className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                                        Нет триггеров для этого модуля
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return null;
};
