/** Сид для локальной разработки (см. `index.tsx`, флаг VITE_ENABLE_DEMO_SEED). */
import { localStoreService } from '../services/localStoreService';
import { Role } from '../types';
import {
  DEFAULT_STATUSES,
  DEFAULT_PRIORITIES,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_FINANCE_CATEGORIES,
  DEFAULT_FUNDS,
  DEFAULT_AUTOMATION_RULES,
} from '../constants';

const SEED_FLAG = 'taska_demo_seeded_v3';

const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);

export function runSeed(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(SEED_FLAG)) return;

  const demoUserId = 'demo-user';

  // Users: 5+ сотрудников (без avatar — отображаются инициалы на цветном фоне)
  localStoreService.setAll('users', [
    { id: demoUserId, name: 'Демо', role: Role.ADMIN, roleId: '00000000-0000-4000-8000-000000000001', roleName: 'Администратор', roleSlug: 'admin', permissions: ['system.full_access'], login: 'demo', password: '' },
    { id: 'u2', name: 'Анна Иванова', role: Role.EMPLOYEE, roleId: '00000000-0000-4000-8000-000000000002', roleName: 'Сотрудник', roleSlug: 'employee', login: 'anna', email: 'anna@example.com' },
    { id: 'u3', name: 'Пётр Сидоров', role: Role.EMPLOYEE, roleId: '00000000-0000-4000-8000-000000000002', roleName: 'Сотрудник', roleSlug: 'employee', login: 'petr', email: 'petr@example.com' },
    { id: 'u4', name: 'Мария Козлова', role: Role.EMPLOYEE, roleId: '00000000-0000-4000-8000-000000000002', roleName: 'Сотрудник', roleSlug: 'employee', login: 'maria', email: 'maria@example.com' },
    { id: 'u5', name: 'Иван Новиков', role: Role.EMPLOYEE, roleId: '00000000-0000-4000-8000-000000000002', roleName: 'Сотрудник', roleSlug: 'employee', login: 'ivan', email: 'ivan@example.com' },
    { id: 'u6', name: 'Елена Соколова', role: Role.EMPLOYEE, roleId: '00000000-0000-4000-8000-000000000002', roleName: 'Сотрудник', roleSlug: 'employee', login: 'elena', email: 'elena@example.com' },
  ]);

  // Tables (страницы)
  localStoreService.setAll('tables', [
    { id: 't1', name: 'Задачи', type: 'tasks', icon: 'CheckSquare', color: 'text-blue-500' },
    { id: 't2', name: 'Контент-план', type: 'content-plan', icon: 'Instagram', color: 'text-pink-500' },
    { id: 't3', name: 'Идеи', type: 'backlog', icon: 'Archive', color: 'text-amber-500' },
    { id: 't4', name: 'Функционал', type: 'functionality', icon: 'Layers', color: 'text-green-600' },
  ]);

  // Statuses, priorities
  localStoreService.setAll('statuses', DEFAULT_STATUSES);
  localStoreService.setAll('priorities', DEFAULT_PRIORITIES);

  // Notification prefs (один документ в массиве)
  localStoreService.setAll('notificationPrefs', [{ id: 'default', ...DEFAULT_NOTIFICATION_PREFS }]);
  localStoreService.setAll('automationRules', DEFAULT_AUTOMATION_RULES);

  // Departments
  localStoreService.setAll('departments', [
    { id: 'd1', name: 'Отдел продаж' },
    { id: 'd2', name: 'Маркетинг' },
    { id: 'd3', name: 'Разработка' },
  ]);

  // Projects
  localStoreService.setAll('projects', [
    { id: 'pr1', name: 'Сайт клиента А' },
    { id: 'pr2', name: 'Реклама в соцсетях' },
  ]);

  // Задачи: реальные названия; часть — из постов, сделок, процессов (разные источники)
  const taskTitles = [
    'Подготовить КП по разработке сайта', 'Созвон с клиентом ООО Ромашка', 'Обновить блок цен на лендинге',
    'Согласовать ТЗ с заказчиком', 'Сверстать главную страницу', 'Настроить аналитику на сайте',
    'Написать текст для поста про акцию', 'Снять сторис для Instagram', 'Подготовить отчёт по рекламе',
    'Провести ретро по спринту', 'Обновить контент в карточках товаров', 'Интегрировать оплату',
    'Задача по сделке: Разработка корпоративного сайта', 'Задача по сделке: Реклама в Instagram',
    'Согласование КП (процесс)', 'Подписание договора (процесс)', 'Проверить вёрстку на мобильных',
    'Доработать форму заявки', 'Подготовить презентацию для клиента', 'Настроить цепочки писем',
  ];
  const statuses = ['Не начато', 'В работе', 'На проверке', 'Выполнено'];
  const dateOffset = (i: number) => {
    const d = new Date();
    d.setDate(d.getDate() + (i % 21) - 7);
    return d.toISOString().slice(0, 10);
  };
  const baseTasks = taskTitles.slice(0, 8).map((title, i) => ({
    id: `task_${i + 1}`,
    tableId: 't1',
    title,
    entityType: 'task' as const,
    status: statuses[i % 4],
    priority: i % 3 === 0 ? 'Низкий' : i % 3 === 1 ? 'Средний' : 'Высокий',
    assigneeId: [demoUserId, 'u2', 'u3', 'u4'][i % 4],
    startDate: dateOffset(i),
    endDate: dateOffset(i + 2),
    createdAt: now(),
  }));
  const extraTasks = taskTitles.slice(8, 20).map((title, i) => ({
    id: `task_extra_${i + 1}`,
    tableId: 't1',
    title,
    entityType: 'task' as const,
    status: statuses[(i + 2) % 4],
    priority: ['Низкий', 'Средний', 'Высокий'][i % 3],
    assigneeId: [demoUserId, 'u2', 'u3'][i % 3],
    startDate: dateOffset(i + 8),
    endDate: dateOffset(i + 10),
    createdAt: now(),
    ...(i === 0 ? { contentPostId: 'cp1', source: 'Контент-план' } : {}),
    ...(i === 1 ? { contentPostId: 'cp_2', source: 'Контент-план' } : {}),
    ...(i === 2 ? { dealId: 'fdeal_1', source: 'Сделка' } : {}),
    ...(i === 3 ? { dealId: 'fdeal_2', source: 'Сделка' } : {}),
    ...(i === 4 ? { processId: 'bp1', processInstanceId: 'pi1', stepId: 'step1', source: 'Бизнес-процесс' } : {}),
    ...(i === 5 ? { processId: 'bp1', processInstanceId: 'pi1', stepId: 'step2', source: 'Бизнес-процесс' } : {}),
  }));
  const backlogIdeaTitles = [
    'Личный кабинет клиента на сайте', 'Уведомления в браузере', 'Интеграция с Telegram-ботом',
    'Виджет обратного звонка', 'A/B-тесты лендингов', 'Чат поддержки на сайте',
    'Расширенная аналитика воронки', 'Авто-напоминания по сделкам', 'Шаблоны КП в один клик',
    'Синхронизация с Google Календарём', 'Экспорт отчётов в Excel', 'Двухэтапная верификация',
  ];
  const backlogIdeas = backlogIdeaTitles.map((title, i) => ({
    id: `idea_${i + 1}`,
    tableId: 't3',
    title,
    description: `Идея для продуктовой доработки: ${title}`,
    entityType: 'idea' as const,
    status: statuses[i % 3],
    priority: i % 3 === 0 ? 'Низкий' : i % 3 === 1 ? 'Средний' : 'Высокий',
    assigneeId: [demoUserId, 'u2', 'u4'][i % 3],
    createdAt: now(),
  }));
  const featureTitles = [
    'Установка счётчиков аналитики', 'Файл robots.txt и sitemap', 'Базовые фичи личного кабинета',
    'Настройка бэкенда и API', 'Расположение сервера', 'Интеграция с платёжной системой',
    'Мобильная версия каталога', 'Фильтры и поиск', 'Чат с поддержкой', 'Рассылка по email',
  ];
  const featureTasks = featureTitles.map((title, i) => ({
    id: `feature_${i + 1}`,
    tableId: 't4',
    title,
    description: `Реализация: ${title}`,
    entityType: 'feature' as const,
    status: statuses[i % 4],
    priority: 'Средний' as const,
    assigneeId: i % 2 === 0 ? demoUserId : 'u5',
    createdAt: now(),
    category: i < 5 ? ['counters', 'seo', 'features', 'backend', 'infrastructure'][i] : 'uncategorized',
    projectId: i % 3 === 0 ? 'pr1' : i % 3 === 1 ? 'pr2' : undefined,
  }));
  localStoreService.setAll('tasks', [...baseTasks, ...extraTasks, ...backlogIdeas, ...featureTasks]);

  // Sales funnels (id этапов = new, qualification, proposal, negotiation — под канбан)
  localStoreService.setAll('salesFunnels', [
    {
      id: 'f1',
      name: 'Продажи',
      stages: [
        { id: 'new', label: 'Новая заявка', color: 'bg-gray-200 dark:bg-gray-700' },
        { id: 'qualification', label: 'Квалификация', color: 'bg-blue-200 dark:bg-blue-900' },
        { id: 'proposal', label: 'Предложение (КП)', color: 'bg-purple-200 dark:bg-purple-900' },
        { id: 'negotiation', label: 'Переговоры', color: 'bg-orange-200 dark:bg-orange-900' },
      ],
    },
  ]);

  // 10 клиентов
  const clientNames = [
    'ООО Ромашка', 'ИП Васильев', 'ЧП Текстиль Плюс', 'ООО Агро Сервис', 'ИП Фотостудия',
    'ООО СтройМаш', 'ИП Кофе Хауз', 'ООО Медиа Групп', 'ЧП Мебель Стандарт', 'ООО Логистик',
  ];
  const clients = clientNames.map((name, i) => ({
    id: `c${i + 1}`,
    name,
    contactPerson: ['Мария', 'Алексей', 'Дилноза', 'Сергей', 'Карина', 'Олег', 'Нигора', 'Артём', 'Юлия', 'Дмитрий'][i],
    email: `contact${i + 1}@example.uz`,
    phone: `+99890${1000000 + i}`,
  }));
  localStoreService.setAll('clients', clients);

  // Сделки воронки: реальные названия, этапы new/qualification/proposal/negotiation (канбан), 5 отказов
  const funnelDealTitles = [
    'Разработка корпоративного сайта', 'Реклама в Instagram', 'Настройка сквозной аналитики',
    'Дизайн мобильного приложения', 'Ведение соцсетей (3 месяца)', 'Лендинг под акцию',
    'Фотосессия для каталога', 'Видеоролик 30 сек', 'Контекстная реклама Яндекс',
    'SMM-сопровождение', 'Редизайн лендинга', 'Интеграция с 1С', 'Поддержка сайта (год)',
    'Запуск интернет-магазина', 'Аудит рекламных кампаний', 'Не подошёл бюджет',
    'Выбрали другого подрядчика', 'Отложили на квартал', 'Нет ответа от ЛПР',
    'Отказ после КП',
  ];
  const funnelDeals = funnelDealTitles.map((title, i) => ({
    id: `fdeal_${i + 1}`,
    title,
    clientId: i < 10 ? clients[i].id : undefined,
    amount: 1500000 + i * 400000,
    currency: 'UZS',
    stage: i >= 15 ? 'lost' : i < 3 ? 'won' : (['new', 'qualification', 'proposal', 'negotiation'] as const)[i % 4],
    funnelId: 'f1',
    assigneeId: [demoUserId, 'u2', 'u3', 'u4'][i % 4],
    createdAt: now(),
    source: (['manual', 'site', 'instagram', 'recommendation'] as const)[i % 4],
  }));
  // Договоры (регулярные и разовые) для клиентов — по 1–2 на клиента; funnelId не f1, чтобы не попадали в воронку
  const contractDeals: any[] = [];
  clients.slice(0, 10).forEach((client, i) => {
    contractDeals.push({
      id: `contract_${client.id}_1`,
      number: `Д-${2025}-${100 + i}`,
      recurring: true,
      clientId: client.id,
      amount: 500000 + i * 100000,
      currency: 'UZS',
      status: i % 3 === 0 ? 'active' : i % 3 === 1 ? 'pending' : 'paid',
      description: 'Ежемесячное сопровождение сайта и рекламы',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      paymentDay: 10,
      createdAt: now(),
      funnelId: 'contracts',
    });
    if (i % 2 === 0) {
      contractDeals.push({
        id: `onetime_${client.id}`,
        number: `Р-${2025}-${200 + i}`,
        recurring: false,
        clientId: client.id,
        amount: 1200000,
        currency: 'UZS',
        status: i % 2 === 0 ? 'completed' : 'pending',
        description: 'Разовая разработка лендинга',
        date: today(),
        createdAt: now(),
        funnelId: 'contracts',
      });
    }
  });
  localStoreService.setAll('deals', [...funnelDeals, ...contractDeals]);

  // Employee infos (5+ сотрудников, оргструктура)
  localStoreService.setAll('employeeInfos', [
    { id: 'emp1', userId: demoUserId, departmentId: 'd1', position: 'Руководитель', hireDate: '2023-01-01' },
    { id: 'emp2', userId: 'u2', departmentId: 'd1', position: 'Менеджер по продажам', hireDate: '2023-06-01' },
    { id: 'emp3', userId: 'u3', departmentId: 'd1', position: 'Менеджер', hireDate: '2023-09-01' },
    { id: 'emp4', userId: 'u4', departmentId: 'd2', position: 'Маркетолог', hireDate: '2024-01-15' },
    { id: 'emp5', userId: 'u5', departmentId: 'd3', position: 'Разработчик', hireDate: '2024-03-01' },
    { id: 'emp6', userId: 'u6', departmentId: 'd2', position: 'SMM-специалист', hireDate: '2024-06-01' },
  ]);

  // Задолженности (моковые — по договорам/сделкам)
  localStoreService.setAll('accountsReceivable', [
    { id: 'ar1', clientId: 'c1', dealId: 'contract_c1_1', amount: 500000, currency: 'UZS', dueDate: today(), status: 'overdue', description: 'Остаток по договору Д-2025-100', createdAt: now() },
    { id: 'ar2', clientId: 'c2', dealId: 'contract_c2_1', amount: 600000, currency: 'UZS', dueDate: today(), status: 'current', description: 'Платёж за март', createdAt: now() },
    { id: 'ar3', clientId: 'c3', dealId: 'contract_c3_1', amount: 700000, currency: 'UZS', dueDate: today(), status: 'overdue', description: 'Просроченный платёж', createdAt: now() },
    { id: 'ar4', clientId: 'c4', dealId: 'contract_c4_1', amount: 400000, currency: 'UZS', dueDate: today(), status: 'current', description: 'Ожидает оплаты', createdAt: now() },
    { id: 'ar5', clientId: 'c5', dealId: 'onetime_c5', amount: 800000, currency: 'UZS', dueDate: today(), status: 'overdue', description: 'Задолженность по разовой сделке', createdAt: now() },
  ]);

  // Документы и папки (мок по вкладкам)
  localStoreService.setAll('folders', [
    { id: 'fd1', tableId: 't1', name: 'Документы по проектам' },
    { id: 'fd2', tableId: 't1', name: 'Шаблоны' },
    { id: 'fd3', tableId: 't1', name: 'Отчёты' },
  ]);
  localStoreService.setAll('docs', [
    { id: 'doc1', tableId: 't1', folderId: 'fd1', title: 'Договор оказания услуг (шаблон)', type: 'link', url: 'https://example.com/doc', tags: ['договор'] },
    { id: 'doc2', tableId: 't1', folderId: 'fd1', title: 'ТЗ на разработку сайта — ООО Ромашка', type: 'internal', tags: ['ТЗ', 'сайт'] },
    { id: 'doc3', tableId: 't1', folderId: 'fd2', title: 'Бриф для клиента', type: 'internal', tags: ['бриф'] },
    { id: 'doc4', tableId: 't1', folderId: 'fd2', title: 'КП шаблон (услуги)', type: 'link', url: 'https://example.com/kp', tags: ['КП'] },
    { id: 'doc5', tableId: 't1', folderId: 'fd3', title: 'Отчёт по рекламе за февраль', type: 'internal', tags: ['отчёт'] },
  ]);

  // Meetings
  const baseMeetings = [
    { id: 'm1', tableId: 't1', title: 'Планерка', date: today(), time: '10:00', participantIds: [demoUserId, 'u2'], summary: 'Еженедельный созвон', type: 'work' },
  ];
  const extraMeetings = Array.from({ length: 5 }).map((_, i) => ({
    id: `m_extra_${i + 1}`,
    tableId: 't1',
    title: `Встреча с клиентом ${i + 1}`,
    date: today(),
    time: `1${i}:00`,
    participantIds: [demoUserId],
    summary: 'Демо встреча',
    type: 'client' as const,
  }));
  localStoreService.setAll('meetings', [...baseMeetings, ...extraMeetings]);

  // Контент-план: реальные названия, по дням (разные даты), посты/сторис/reel, разные статусы
  const contentStatuses = ['idea', 'copywriting', 'design', 'approval', 'scheduled', 'published'] as const;
  const contentFormats = ['post', 'story', 'reel', 'post', 'video', 'post'] as const;
  const contentTopics = [
    'Акция «Лето — скидка 20%»', 'Новый кейс: сайт для ООО Ромашка', 'Сторис: закулисье офиса',
    'Reel: как мы делаем дизайн', 'Полезное: 5 ошибок в рекламе', 'Анонс вебинара по SMM',
    'Отзыв клиента ИП Васильев', 'Сторис с опросом: что важнее?', 'Пост про команду',
    'Кейс: лендинг за 5 дней', 'Reel с тизерами проекта', 'Акция ко Дню предпринимателя',
    'Обзор нового функционала', 'Сторис: этапы разработки', 'Пост про тренды 2025',
    'Видео-приветствие от руководителя', 'Кейс: настройка рекламы', 'Сторис: офис в пятницу',
    'Пост про сертификаты', 'Reel: до/после редизайна', 'Анонс бесплатной консультации',
    'Пост про кейс агро-клиента', 'Сторис вопрос-ответ', 'Итоги месяца в цифрах',
  ];
  const contentPosts = contentTopics.map((topic, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 7 + (i % 14));
    const dateStr = d.toISOString().slice(0, 10);
    return {
      id: i === 0 ? 'cp1' : `cp_${i + 1}`,
      tableId: 't2',
      topic,
      description: `Контент: ${topic}`,
      date: dateStr,
      platform: ['instagram'],
      format: contentFormats[i % contentFormats.length],
      status: contentStatuses[i % contentStatuses.length],
    };
  });
  localStoreService.setAll('contentPosts', contentPosts);

  // Activity
  localStoreService.setAll('activity', [
    { id: 'a1', userId: demoUserId, userName: 'Демо', userAvatar: '', action: 'task_created', details: 'Задача «Подготовить КП»', timestamp: now(), read: false },
  ]);

  // Финансы: категории, фонды, план, планирования, заявки
  localStoreService.setAll('financeCategories', DEFAULT_FINANCE_CATEGORIES);
  localStoreService.setAll('funds', DEFAULT_FUNDS);
  localStoreService.setAll('financePlan', [{ id: 'default', period: 'month', salesPlan: 50000000, currentIncome: 12000000 }]);
  const week1 = new Date();
  week1.setDate(week1.getDate() - 7);
  const week2 = new Date();
  const week1Str = week1.toISOString().slice(0, 10);
  const week2Str = week2.toISOString().slice(0, 10);
  const requestDescriptions = [
    'Подписка на сервис аналитики', 'Канцтовары офис', 'Рекламный бюджет Instagram',
    'Хостинг на год', 'Лицензии Figma', 'Оборудование для студии', 'Курсы для команды',
    'Облачное хранилище', 'Подписка на тариф прод', 'Мерч для клиентов',
    'Транспортные расходы', 'Печать буклетов', 'Фотостоки', 'Сертификация',
    'Аренда переговорки', 'Кофе и чай офис', 'Полиграфия визиток', 'Домен и SSL',
    'Подписка на рассылку', 'Внешний аудит', 'Консультант по налогам', 'Резерв',
  ];
  const purchaseRequests = requestDescriptions.map((description, i) => ({
    id: `prq_${i + 1}`,
    requesterId: [demoUserId, 'u2', 'u4'][i % 3],
    departmentId: ['d1', 'd2', 'd3'][i % 3],
    categoryId: ['fc1', 'fc3', 'fc5', 'fc2', 'fc4'][i % 5],
    amount: 200000 + i * 80000,
    description,
    status: (['pending', 'approved', 'rejected', 'deferred'] as const)[i % 4],
    date: i % 2 === 0 ? week1Str : week2Str,
  }));
  localStoreService.setAll('purchaseRequests', purchaseRequests);
  const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const financialPlanDocuments = [
    { id: 'fpd1', departmentId: 'd1', period: currentPeriod, income: 30000000, expenses: { fc1: 12000000, fc3: 5000000 }, status: 'conducted', createdAt: now(), updatedAt: now(), isArchived: false },
    { id: 'fpd2', departmentId: 'd2', period: currentPeriod, income: 15000000, expenses: { fc3: 4000000, fc5: 1000000 }, status: 'created', createdAt: now(), updatedAt: now(), isArchived: false },
    { id: 'fpd3', departmentId: 'd3', period: currentPeriod, income: 8000000, expenses: { fc2: 2000000, fc5: 1500000 }, status: 'conducted', createdAt: now(), updatedAt: now(), isArchived: false },
    { id: 'fpd4', departmentId: 'd1', period: currentPeriod, income: 25000000, expenses: { fc1: 8000000 }, status: 'approved', createdAt: now(), updatedAt: now(), isArchived: false },
    { id: 'fpd5', departmentId: 'd2', period: currentPeriod, income: 12000000, expenses: { fc3: 3000000, fc4: 1000000 }, status: 'created', createdAt: now(), updatedAt: now(), isArchived: false },
  ];
  localStoreService.setAll('financialPlanDocuments', financialPlanDocuments);
  const requestIds = purchaseRequests.slice(0, 25).map(r => r.id);
  const financialPlannings = [
    { id: 'fpl1', departmentId: 'd1', period: currentPeriod, planDocumentId: 'fpd1', requestIds: requestIds.slice(0, 8), status: 'conducted', createdAt: now(), updatedAt: now(), isArchived: false },
    { id: 'fpl2', departmentId: 'd2', period: currentPeriod, planDocumentId: 'fpd2', requestIds: requestIds.slice(8, 14), status: 'created', createdAt: now(), updatedAt: now(), isArchived: false },
    { id: 'fpl3', departmentId: 'd3', period: currentPeriod, planDocumentId: 'fpd3', requestIds: requestIds.slice(14, 18), status: 'conducted', createdAt: now(), updatedAt: now(), isArchived: false },
    { id: 'fpl4', departmentId: 'd1', period: currentPeriod, planDocumentId: 'fpd4', requestIds: requestIds.slice(18, 22), status: 'approved', createdAt: now(), updatedAt: now(), isArchived: false },
    { id: 'fpl5', departmentId: 'd2', period: currentPeriod, planDocumentId: 'fpd5', requestIds: requestIds.slice(22, 25), status: 'created', createdAt: now(), updatedAt: now(), isArchived: false },
  ];
  localStoreService.setAll('financialPlannings', financialPlannings);

  // BPM: оргструктура с 2 уровнями подчинённых (руководитель → подчинённые → их подчинённые)
  localStoreService.setAll('orgPositions', [
    // Уровень 0: топ
    { id: 'pos_ceo', title: 'Генеральный директор', departmentId: 'd1', order: 0 },
    // Уровень 1: руководители отделов (подчинены CEO)
    { id: 'pos2', title: 'Руководитель отдела продаж', departmentId: 'd1', managerPositionId: 'pos_ceo', order: 1 },
    { id: 'pos_marketing', title: 'Руководитель маркетинга', departmentId: 'd2', managerPositionId: 'pos_ceo', order: 2 },
    { id: 'pos4', title: 'Руководитель разработки', departmentId: 'd3', managerPositionId: 'pos_ceo', order: 3 },
    // Уровень 2: подчинённые руководителей
    { id: 'pos1', title: 'Менеджер по продажам', departmentId: 'd1', managerPositionId: 'pos2', order: 4 },
    { id: 'pos_sales_junior', title: 'Стажёр по продажам', departmentId: 'd1', managerPositionId: 'pos1', order: 5 },
    { id: 'pos3', title: 'Маркетолог', departmentId: 'd2', managerPositionId: 'pos_marketing', order: 6 },
    { id: 'pos_smm', title: 'SMM-специалист', departmentId: 'd2', managerPositionId: 'pos3', order: 7 },
    { id: 'pos_dev_lead', title: 'Тимлид', departmentId: 'd3', managerPositionId: 'pos4', order: 8 },
    { id: 'pos_dev_junior', title: 'Junior разработчик', departmentId: 'd3', managerPositionId: 'pos_dev_lead', order: 9 },
  ]);
  const bp1Steps = [
    { id: 'bp1_s1', title: 'Подготовка КП', assigneeType: 'user', assigneeId: demoUserId, order: 1 },
    { id: 'bp1_s2', title: 'Согласование юристом', assigneeType: 'position', assigneeId: 'pos2', order: 2 },
    { id: 'bp1_s3', title: 'Подписание клиентом', assigneeType: 'user', assigneeId: 'u2', order: 3 },
  ];
  const bp2Steps = [
    { id: 'bp2_s1', title: 'Заявка на закупку', assigneeType: 'user', assigneeId: demoUserId, order: 1 },
    { id: 'bp2_s2', title: 'Согласование бюджета', assigneeType: 'position', assigneeId: 'pos2', order: 2 },
    { id: 'bp2_s3', title: 'Заказ и приёмка', assigneeType: 'user', assigneeId: 'u4', order: 3 },
  ];
  const bp3Steps = [
    { id: 'bp3_s1', title: 'Черновик контента', assigneeType: 'user', assigneeId: 'u4', order: 1 },
    { id: 'bp3_s2', title: 'Верстка и дизайн', assigneeType: 'user', assigneeId: 'u5', order: 2 },
    { id: 'bp3_s3', title: 'Публикация', assigneeType: 'user', assigneeId: 'u6', order: 3 },
  ];
  const bp4Steps = [
    { id: 'bp4_s1', title: 'Приём заявки', assigneeType: 'user', assigneeId: 'u2', order: 1 },
    { id: 'bp4_s2', title: 'Разработка', assigneeType: 'position', assigneeId: 'pos4', order: 2 },
    { id: 'bp4_s3', title: 'Сдача клиенту', assigneeType: 'user', assigneeId: demoUserId, order: 3 },
  ];
  localStoreService.setAll('businessProcesses', [
    {
      id: 'bp1',
      version: 1,
      title: 'Согласование договора',
      description: 'От создания КП до подписания договора клиентом',
      steps: bp1Steps,
      instances: [
        { id: 'pi1', processId: 'bp1', processVersion: 1, currentStepId: 'bp1_s2', status: 'active', startedAt: now(), taskIds: ['task_1', 'task_2'] },
        { id: 'pi2', processId: 'bp1', processVersion: 1, currentStepId: null, status: 'completed', startedAt: now(), completedAt: now(), taskIds: ['task_3'] },
      ],
      isArchived: false,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: 'bp2',
      version: 1,
      title: 'Закупка канцтоваров',
      description: 'Заявка → согласование → заказ',
      steps: bp2Steps,
      instances: [
        { id: 'pi3', processId: 'bp2', processVersion: 1, currentStepId: 'bp2_s1', status: 'active', startedAt: now(), taskIds: [] },
      ],
      isArchived: false,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: 'bp3',
      version: 1,
      title: 'Публикация контента',
      description: 'От идеи до публикации в соцсетях',
      steps: bp3Steps,
      instances: [
        { id: 'pi4', processId: 'bp3', processVersion: 1, currentStepId: 'bp3_s2', status: 'active', startedAt: now(), taskIds: [] },
      ],
      isArchived: false,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: 'bp4',
      version: 1,
      title: 'Выполнение заказа на разработку',
      description: 'Заявка клиента → разработка → сдача',
      steps: bp4Steps,
      instances: [
        { id: 'pi5', processId: 'bp4', processVersion: 1, currentStepId: 'bp4_s2', status: 'active', startedAt: now(), taskIds: [] },
      ],
      isArchived: false,
      createdAt: now(),
      updatedAt: now(),
    },
  ]);

  // Склад: нормальные названия номенклатуры, приходы, расходы, ревизии
  localStoreService.setAll('warehouses', [
    { id: 'wh1', name: 'Основной склад', departmentId: 'd1' },
    { id: 'wh2', name: 'Склад маркетинга', departmentId: 'd2' },
    { id: 'wh3', name: 'Склад мерча', departmentId: 'd2' },
  ]);
  const itemNames = [
    { id: 'it1', sku: '001', name: 'Блокнот А4', unit: 'шт', category: 'Канцтовары' },
    { id: 'it2', sku: '002', name: 'Ручка синяя', unit: 'шт', category: 'Канцтовары' },
    { id: 'it3', sku: '003', name: 'Футболка с логотипом', unit: 'шт', category: 'Мерч' },
    { id: 'it4', sku: '004', name: 'Скрепки коробка', unit: 'шт', category: 'Канцтовары' },
    { id: 'it5', sku: '005', name: 'Папка-регистратор', unit: 'шт', category: 'Канцтовары' },
    { id: 'it6', sku: '006', name: 'Стикеры набор', unit: 'шт', category: 'Канцтовары' },
    { id: 'it7', sku: '007', name: 'Кружка с логотипом', unit: 'шт', category: 'Мерч' },
    { id: 'it8', sku: '008', name: 'Бумага A4 пачка', unit: 'пачка', category: 'Канцтовары' },
    { id: 'it9', sku: '009', name: 'Картридж для принтера', unit: 'шт', category: 'Канцтовары' },
    { id: 'it10', sku: '010', name: 'Кепка брендированная', unit: 'шт', category: 'Мерч' },
  ];
  localStoreService.setAll('inventoryItems', itemNames);

  const stockMovements = [
    { id: 'mv1', type: 'receipt', date: now(), toWarehouseId: 'wh1', items: [{ itemId: 'it1', quantity: 50 }, { itemId: 'it2', quantity: 100 }], reason: 'Оприходование канцтоваров', createdByUserId: demoUserId },
    { id: 'mv2', type: 'receipt', date: now(), toWarehouseId: 'wh1', items: [{ itemId: 'it3', quantity: 20 }, { itemId: 'it7', quantity: 15 }], reason: 'Поступление мерча', createdByUserId: demoUserId },
    { id: 'mv3', type: 'transfer', date: now(), fromWarehouseId: 'wh1', toWarehouseId: 'wh2', items: [{ itemId: 'it1', quantity: 10 }, { itemId: 'it2', quantity: 20 }], reason: 'Передача в отдел маркетинга', createdByUserId: demoUserId },
    { id: 'mv4', type: 'writeoff', date: now(), fromWarehouseId: 'wh1', items: [{ itemId: 'it2', quantity: 5 }], reason: 'Списание испорченного', createdByUserId: demoUserId },
    { id: 'mv5', type: 'receipt', date: now(), toWarehouseId: 'wh1', items: [{ itemId: 'it8', quantity: 10 }, { itemId: 'it9', quantity: 2 }], reason: 'Закупка офисная', createdByUserId: demoUserId },
    { id: 'mv6', type: 'transfer', date: now(), fromWarehouseId: 'wh1', toWarehouseId: 'wh3', items: [{ itemId: 'it3', quantity: 5 }], reason: 'Мерч на выставку', createdByUserId: demoUserId },
  ];
  localStoreService.setAll('stockMovements', stockMovements);
  localStoreService.setAll('inventoryRevisions', [
    {
      id: 'rev1',
      number: 'РВ-001',
      warehouseId: 'wh1',
      date: today(),
      status: 'draft',
      lines: [
        { itemId: 'it1', quantitySystem: 40, quantityFact: 40 },
        { itemId: 'it2', quantitySystem: 95, quantityFact: 93 },
      ],
      createdByUserId: demoUserId,
    },
    {
      id: 'rev2',
      number: 'РВ-002',
      warehouseId: 'wh1',
      date: today(),
      status: 'posted',
      lines: [
        { itemId: 'it1', quantitySystem: 50, quantityFact: 50 },
        { itemId: 'it2', quantitySystem: 100, quantityFact: 100 },
      ],
      createdByUserId: demoUserId,
      postedAt: now(),
    },
  ]);

  localStorage.setItem(SEED_FLAG, '1');
}
