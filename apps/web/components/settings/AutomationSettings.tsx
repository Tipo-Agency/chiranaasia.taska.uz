
import React, { useState, useMemo } from 'react';
import { AutomationRule, NotificationPreferences, StatusOption } from '../../types';
import { Zap, MessageSquare, Plus, Trash2, CheckSquare, Bell, FileText, Calendar, DollarSign, Users, Briefcase, Settings } from 'lucide-react';
import { TaskSelect } from '../TaskSelect';
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
    const [automationModule, setAutomationModule] = useState<'tasks' | 'docs' | 'meetings' | 'content' | 'finance' | 'crm' | 'employees' | 'bpm'>('tasks');
    
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
                    { value: 'finance_plan_updated', label: 'Обновлен финансовый план' }
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
                    { key: 'financePlanUpdated', label: 'Обновлен план', description: 'Когда обновляется финансовый план' }
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

    if (activeTab === 'notifications') {
        return (
            <div className="space-y-6 max-w-5xl">
                {/* Вкладки по модулям */}
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#252525] rounded-full p-1 text-xs overflow-x-auto">
                    <button 
                        onClick={() => setAutomationModule('tasks')} 
                        className={`px-3 py-1.5 rounded-full flex items-center gap-1 whitespace-nowrap ${automationModule === 'tasks' ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}
                    >
                        <CheckSquare size={14}/> Задачи
                    </button>
                    <button 
                        onClick={() => setAutomationModule('docs')} 
                        className={`px-3 py-1.5 rounded-full flex items-center gap-1 whitespace-nowrap ${automationModule === 'docs' ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}
                    >
                        <FileText size={14}/> Документы
                    </button>
                    <button 
                        onClick={() => setAutomationModule('meetings')} 
                        className={`px-3 py-1.5 rounded-full flex items-center gap-1 whitespace-nowrap ${automationModule === 'meetings' ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}
                    >
                        <Calendar size={14}/> Встречи
                    </button>
                    <button 
                        onClick={() => setAutomationModule('content')} 
                        className={`px-3 py-1.5 rounded-full flex items-center gap-1 whitespace-nowrap ${automationModule === 'content' ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}
                    >
                        <FileText size={14}/> Контент-план
                    </button>
                    <button 
                        onClick={() => setAutomationModule('finance')} 
                        className={`px-3 py-1.5 rounded-full flex items-center gap-1 whitespace-nowrap ${automationModule === 'finance' ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}
                    >
                        <DollarSign size={14}/> Финансы
                    </button>
                    <button 
                        onClick={() => setAutomationModule('crm')} 
                        className={`px-3 py-1.5 rounded-full flex items-center gap-1 whitespace-nowrap ${automationModule === 'crm' ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}
                    >
                        <Briefcase size={14}/> CRM
                    </button>
                    <button 
                        onClick={() => setAutomationModule('employees')} 
                        className={`px-3 py-1.5 rounded-full flex items-center gap-1 whitespace-nowrap ${automationModule === 'employees' ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}
                    >
                        <Users size={14}/> Сотрудники
                    </button>
                    <button 
                        onClick={() => setAutomationModule('bpm')} 
                        className={`px-3 py-1.5 rounded-full flex items-center gap-1 whitespace-nowrap ${automationModule === 'bpm' ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}
                    >
                        <Settings size={14}/> Бизнес-процессы
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Настройки уведомлений для модуля */}
                    <div className="bg-white dark:bg-[#252525] p-6 rounded-xl border border-gray-200 dark:border-[#333]">
                        <h3 className="font-bold text-gray-800 dark:text-white mb-2">Настройки уведомлений</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                            Уведомления в системе всегда включены для всех пользователей. Здесь настраиваются только Telegram уведомления.
                        </p>
                        <div className="space-y-4">
                            {getModuleNotificationPrefs(automationModule).map(pref => (
                                <div key={pref.key} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-[#333]">
                                    <div className="flex-1">
                                        <div className="font-bold text-gray-900 dark:text-white text-sm">{pref.label}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{pref.description}</div>
                                    </div>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={safePrefs[pref.key].telegramPersonal} 
                                                onChange={() => handleTogglePref(pref.key, 'telegramPersonal')} 
                                                className="rounded text-blue-600 focus:ring-0"
                                            /> 
                                            Личный чат
                                        </label>
                                        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
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

                    {/* Создание правил автоматизации */}
                    <div className="bg-gray-50 dark:bg-[#202020] p-6 rounded-xl border border-gray-200 dark:border-[#333]">
                        <h3 className="font-bold text-gray-800 dark:text-white mb-4">Создать правило</h3>
                        <form onSubmit={handleAutomationSubmit} className="space-y-4">
                            <input 
                                required 
                                value={autoName} 
                                onChange={e => setAutoName(e.target.value)} 
                                placeholder="Название правила" 
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100" 
                            />
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Когда (Триггер)</label>
                                <TaskSelect
                                    value={autoTrigger}
                                    onChange={(val) => setAutoTrigger(val as AutomationRule['trigger'])}
                                    options={getModuleTriggers(automationModule).map(t => ({ value: t.value, label: t.label }))}
                                />
                            </div>

                            {autoTrigger.includes('status') && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Статус стал</label>
                                    <TaskSelect
                                        value={autoStatusTo}
                                        onChange={setAutoStatusTo}
                                        options={statuses.map(s => ({ value: s.name, label: s.name }))}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Действие</label>
                                <TaskSelect
                                    value={autoActionType}
                                    onChange={(val) => setAutoActionType(val as 'telegram_message' | 'approval_request')}
                                    options={[
                                        { value: 'telegram_message', label: 'Отправить сообщение' },
                                        { value: 'approval_request', label: 'Запрос на согласование' }
                                    ]}
                                />
                            </div>

                            {autoActionType === 'approval_request' && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Тип согласования</label>
                                    <TaskSelect
                                        value={autoApprovalType}
                                        onChange={(val) => setAutoApprovalType(val as any)}
                                        options={[
                                            { value: 'purchase_request', label: 'Заявка на приобретение' },
                                            { value: 'process_step', label: 'Этап бизнес-процесса' },
                                            { value: 'document', label: 'Документ' },
                                            { value: 'deal', label: 'Сделка' }
                                        ]}
                                    />
                                </div>
                            )}

                            {autoActionType === 'telegram_message' && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Шаблон сообщения</label>
                                    <textarea 
                                        value={autoTemplate} 
                                        onChange={e => setAutoTemplate(e.target.value)} 
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100" 
                                        rows={3} 
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Доступные переменные: {'{task_title}'}, {'{status}'}, {'{priority}'}, {'{user_name}'}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Получатель</label>
                                <TaskSelect
                                    value={autoTarget}
                                    onChange={(val) => setAutoTarget(val as any)}
                                    options={[
                                        { value: 'assignee', label: 'Исполнитель' },
                                        { value: 'creator', label: 'Создатель' },
                                        { value: 'manager', label: 'Руководитель' },
                                        { value: 'admin', label: 'Администратор' },
                                        { value: 'specific', label: 'Конкретный пользователь' }
                                    ]}
                                />
                            </div>

                            <Button type="submit" size="md" fullWidth>
                                Создать правило
                            </Button>
                        </form>
                    </div>
                </div>

                {/* Список правил */}
                <div className="space-y-3">
                    <h3 className="font-bold text-gray-800 dark:text-white">Активные правила</h3>
                    {automationRules.filter(r => r.module === automationModule).map(rule => (
                        <div key={rule.id} className="border border-gray-200 dark:border-[#333] rounded-xl p-5 bg-white dark:bg-[#252525] hover:shadow-md transition-all">
                            <div className="flex justify-between items-start mb-2">
                                <div className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                                    <Zap size={18} className="text-yellow-500"/> {rule.name}
                                </div>
                                <button onClick={() => onDeleteRule(rule.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                <div className="flex items-center gap-2">
                                    <Zap size={14} className="text-blue-500"/> 
                                    <span className="font-semibold">Если:</span> {getModuleTriggers(rule.module).find(t => t.value === rule.trigger)?.label || rule.trigger}
                                </div>
                                <div className="flex items-center gap-2">
                                    <MessageSquare size={14} className="text-green-500"/> 
                                    <span className="font-semibold">То:</span> {
                                        rule.action.type === 'approval_request' 
                                            ? `Запрос на согласование: ${rule.action.approvalType}` 
                                            : 'Отправить сообщение'
                                    }
                                </div>
                            </div>
                        </div>
                    ))}
                    {automationRules.filter(r => r.module === automationModule).length === 0 && (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-8">Нет правил для этого модуля</p>
                    )}
                </div>
            </div>
        );
    }

    return null;
};
