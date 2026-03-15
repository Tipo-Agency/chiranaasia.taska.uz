import React, { useState, useMemo } from 'react';
import { Task, User, StatusOption, Project } from '../types';
import { CheckCircle2, Plus, Trash2, Edit2, Search, Play, Layers, Folder, ChevronDown } from 'lucide-react';

interface FunctionalityViewProps {
  features: Task[]; // Все функции из всех functionality таблиц
  users: User[];
  statuses: StatusOption[];
  projects: Project[]; // Добавляем проекты для вкладок
  onUpdateFeature: (id: string, updates: Partial<Task>) => void;
  onDeleteFeature: (id: string) => void;
  onOpenFeature: (feature: Task) => void;
  onCreateFeature: (projectId?: string, category?: string) => void; // Добавляем projectId и category
  onTakeToWork?: (feature: Task) => void;
}

// Стандартные категории функций
const STANDARD_CATEGORIES = [
  { id: 'counters', name: 'Установка счетчиков', icon: 'BarChart' },
  { id: 'seo', name: 'Настройка под SEO', icon: 'Search' },
  { id: 'features', name: 'Фичи', icon: 'Sparkles' },
  { id: 'backend', name: 'Бэкенд', icon: 'Server' },
  { id: 'infrastructure', name: 'Серверная инфраструктура', icon: 'Cloud' },
];

// Стандартные функции для автоматического создания
const STANDARD_FEATURES = [
  // Установка счетчиков
  { category: 'counters', title: 'Установка счетчиков аналитики', description: 'Установка Google Analytics, Яндекс.Метрики и других счетчиков' },
  
  // Настройка под SEO
  { category: 'seo', title: 'Файл robots.txt', description: 'Создание и настройка файла robots.txt' },
  { category: 'seo', title: 'Sitemap.xml', description: 'Создание и настройка sitemap.xml' },
  
  // Фичи
  { category: 'features', title: 'Базовые фичи', description: 'Реализация основных функций проекта' },
  
  // Бэкенд
  { category: 'backend', title: 'Настройка бэкенда', description: 'Настройка серверной части приложения' },
  
  // Серверная инфраструктура
  { category: 'infrastructure', title: 'Расположение сервера', description: 'Определение где расположен сервер: у нас на сервере или у клиента' },
];

const FunctionalityView: React.FC<FunctionalityViewProps> = ({ 
    features, 
    users, 
    statuses,
    projects,
    onUpdateFeature, 
    onDeleteFeature, 
    onOpenFeature,
    onCreateFeature,
    onTakeToWork
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all'); // 'all' или конкретный projectId
  const [selectedCategory, setSelectedCategory] = useState<string>('all'); // 'all' или конкретная категория

  // Получаем все проекты, у которых есть функции
  const projectsWithFeatures = useMemo(() => {
    const projectIds = new Set(features.filter(f => f.projectId).map(f => f.projectId!));
    return projects.filter(p => projectIds.has(p.id));
  }, [features, projects]);

  // Фильтруем функции по проекту и категории (только entityType: 'feature')
  const filteredFeatures = useMemo(() => {
    let result = features.filter(f => f.entityType === 'feature' && !f.isArchived);

    // Фильтр по поиску
    if (searchQuery) {
      result = result.filter(f => 
        f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.description && f.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Фильтр по проекту
    if (selectedProjectId !== 'all') {
      result = result.filter(f => f.projectId === selectedProjectId);
    }

    // Фильтр по категории
    if (selectedCategory !== 'all') {
      result = result.filter(f => f.category === selectedCategory);
    }

    return result;
  }, [features, searchQuery, selectedProjectId, selectedCategory]);

  // Группируем функции по проектам и категориям
  const groupedFeatures = useMemo(() => {
    const grouped: Record<string, Record<string, Task[]>> = {};

    filteredFeatures.forEach(feature => {
      const projectId = feature.projectId || 'no-project';
      const category = feature.category || 'uncategorized';

      if (!grouped[projectId]) {
        grouped[projectId] = {};
      }
      if (!grouped[projectId][category]) {
        grouped[projectId][category] = [];
      }
      grouped[projectId][category].push(feature);
    });

    return grouped;
  }, [filteredFeatures]);

  // Calculate Progress
  const total = features.length;
  const completed = features.filter(f => {
      const s = statuses.find(st => st.name === f.status);
      return s?.color.includes('green');
  }).length;
  
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const getStatusBadge = (statusName: string) => {
      const s = statuses.find(st => st.name === statusName);
      const color = s?.color || 'bg-gray-100 text-gray-600';
      
      return (
          <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase border border-transparent ${color}`}>
              {statusName}
          </span>
      );
  };

  const getCategoryLabel = (categoryId: string) => {
    if (categoryId === 'uncategorized') return 'Без категории';
    const category = STANDARD_CATEGORIES.find(c => c.id === categoryId);
    return category ? category.name : categoryId;
  };

  const getProjectName = (projectId: string) => {
    if (projectId === 'no-project') return 'Без проекта';
    const project = projects.find(p => p.id === projectId);
    return project ? project.name : projectId;
  };

  return (
    <div className="pt-6 px-6 pb-20 h-full flex flex-col">
        {/* Header Stats */}
        <div className="mb-8 bg-white dark:bg-[#252525] p-6 rounded-xl border border-gray-200 dark:border-[#333] shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Функционал</h1>
                    <p className="hidden sm:block text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Функции проектов
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{progress}%</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Готовность системы</div>
                </div>
            </div>
            <div className="w-full bg-gray-100 dark:bg-[#333] rounded-full h-3 overflow-hidden">
                <div 
                    className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out relative"
                    style={{ width: `${progress}%` }}
                >
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                </div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400 font-medium">
                <span>0%</span>
                <span>{completed} из {total} функций готово</span>
                <span>100%</span>
            </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="relative max-w-xs w-full">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input 
                    type="text" 
                    placeholder="Найти функцию..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-200"
                />
            </div>
            
            <div className="flex items-center gap-2">
                {/* Фильтр по проекту */}
                <div className="relative">
                    <select
                        value={selectedProjectId}
                        onChange={e => setSelectedProjectId(e.target.value)}
                        className="px-3 pr-8 py-2 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg text-sm text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                    >
                        <option value="all">Все проекты</option>
                        {projectsWithFeatures.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                </div>

                {/* Фильтр по категории */}
                <div className="relative">
                    <select
                        value={selectedCategory}
                        onChange={e => setSelectedCategory(e.target.value)}
                        className="px-3 pr-8 py-2 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg text-sm text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                    >
                        <option value="all">Все категории</option>
                        {STANDARD_CATEGORIES.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                </div>

                <button 
                    onClick={() => onCreateFeature(selectedProjectId !== 'all' ? selectedProjectId : undefined, selectedCategory !== 'all' ? selectedCategory : undefined)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 shadow-sm"
                >
                    <Plus size={18} /> Добавить функцию
                </button>
            </div>
        </div>

        {/* Features List - Grouped by Project and Category */}
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
            {Object.keys(groupedFeatures).length === 0 ? (
                <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-12 text-center">
                    <Layers size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                    <p className="text-gray-400 dark:text-gray-500 text-lg mb-2">Функционал пуст</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">Добавьте первую функцию</p>
                    <button 
                        onClick={() => onCreateFeature()}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 shadow-sm mx-auto"
                    >
                        <Plus size={18} /> Добавить функцию
                    </button>
                </div>
            ) : (
                Object.entries(groupedFeatures).map(([projectId, categories]) => (
                    <div key={projectId} className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-sm overflow-hidden">
                        {/* Project Header */}
                        <div className="bg-gray-50 dark:bg-[#202020] px-6 py-4 border-b border-gray-200 dark:border-[#333]">
                            <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                <Layers size={20} />
                                {getProjectName(projectId)}
                            </h2>
                        </div>

                        {/* Categories */}
                        {Object.entries(categories).map(([categoryId, categoryFeatures]) => (
                            <div key={categoryId} className="border-b border-gray-200 dark:border-[#333] last:border-b-0">
                                {/* Category Header */}
                                <div className="bg-gray-50/50 dark:bg-[#1a1a1a] px-6 py-3">
                                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                        <Folder size={16} />
                                        {getCategoryLabel(categoryId)}
                                        <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                                            ({categoryFeatures.length})
                                        </span>
                                    </h3>
                                </div>

                                {/* Features in Category */}
                                <div className="divide-y divide-gray-100 dark:divide-[#333]">
                                    {categoryFeatures.map(feature => {
                                        const assignees = feature.assigneeIds && feature.assigneeIds.length > 0
                                            ? feature.assigneeIds.map(uid => users.find(u => u.id === uid)).filter(Boolean) as User[]
                                            : feature.assigneeId
                                                ? [users.find(u => u.id === feature.assigneeId)].filter(Boolean) as User[]
                                                : [];
                                        
                                        return (
                                            <div key={feature.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-[#303030] group transition-colors">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <div 
                                                            onClick={() => onOpenFeature(feature)}
                                                            className="font-medium text-gray-800 dark:text-gray-200 text-base cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 mb-1"
                                                        >
                                                            {feature.title}
                                                        </div>
                                                        {feature.description && (
                                                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                                                                {feature.description}
                                                            </div>
                                                        )}
                                                        
                                                        <div className="flex items-center gap-4 flex-wrap">
                                                            <div className="flex items-center gap-2">
                                                                {getStatusBadge(feature.status)}
                                                            </div>
                                                            
                                                            {assignees.length === 0 ? (
                                                                <span className="text-xs text-gray-400 italic">Не назначено</span>
                                                            ) : assignees.length === 1 ? (
                                                                <div className="flex items-center gap-2">
                                                                    <img src={assignees[0].avatar} className="w-5 h-5 rounded-full object-cover object-center" alt={assignees[0].name} />
                                                                    <span className="text-xs text-gray-600 dark:text-gray-400">{assignees[0].name}</span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex -space-x-1.5">
                                                                    {assignees.slice(0, 3).map(user => (
                                                                        <img key={user.id} src={user.avatar} className="w-5 h-5 rounded-full border-2 border-white dark:border-[#252525] object-cover object-center" title={user.name} alt={user.name} />
                                                                    ))}
                                                                    {assignees.length > 3 && (
                                                                        <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-[#333] border-2 border-white dark:border-[#252525] flex items-center justify-center text-[8px] font-bold text-gray-600 dark:text-gray-400">
                                                                            +{assignees.length - 3}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {onTakeToWork && (
                                                            <button
                                                                onClick={() => onTakeToWork(feature)}
                                                                className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 flex items-center gap-1.5 shadow-sm transition-colors"
                                                            >
                                                                <Play size={14} /> Взять в работу
                                                            </button>
                                                        )}
                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button 
                                                                onClick={() => onOpenFeature(feature)} 
                                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                                                title="Редактировать"
                                                            >
                                                                <Edit2 size={16}/>
                                                            </button>
                                                            <button 
                                                                onClick={() => onDeleteFeature(feature.id)} 
                                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                                title="Удалить"
                                                            >
                                                                <Trash2 size={16}/>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                ))
            )}
        </div>
    </div>
  );
};

export default FunctionalityView;
export { STANDARD_FEATURES, STANDARD_CATEGORIES };
