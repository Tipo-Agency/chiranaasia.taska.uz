import React, { useState, useMemo, useLayoutEffect, useCallback } from 'react';
import { Task, User, StatusOption, Project } from '../types';
import { Trash2, Edit2, Play, Layers, Folder } from 'lucide-react';
import { TaskSelect } from './TaskSelect';
import {
  ModulePageShell,
  MODULE_PAGE_GUTTER,
  ModuleCreateDropdown,
  ModuleCreateIconButton,
  ModuleFilterIconButton,
  ToolbarModuleLabel,
  APP_TOOLBAR_MODULE_CLUSTER,
} from './ui';
import { TaskBadgeInline } from './ui/TaskBadgeInline';
import { useAppToolbar } from '../contexts/AppToolbarContext';

interface FunctionalityViewProps {
  features: Task[]; // Функции только текущей страницы пространства (tableId совпадает с активной таблицей)
  users: User[];
  statuses: StatusOption[];
  projects: Project[]; // Добавляем проекты для вкладок
  onUpdateFeature: (id: string, updates: Partial<Task>) => void;
  onDeleteFeature: (id: string) => void;
  onOpenFeature: (feature: Task) => void;
  onCreateFeature: (projectId?: string, category?: string) => void; // Добавляем projectId и category
  onCreateProject?: (name: string) => void;
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
    onCreateProject,
    onTakeToWork
}) => {
  const { setLeading, setModule } = useAppToolbar();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all'); // 'all' или конкретный projectId
  const [selectedCategory, setSelectedCategory] = useState<string>('all'); // 'all' или конкретная категория
  const [scope, setScope] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const filterActiveCount = useMemo(
    () =>
      (selectedProjectId !== 'all' ? 1 : 0) +
      (selectedCategory !== 'all' ? 1 : 0) +
      (scope !== 'all' ? 1 : 0),
    [selectedProjectId, selectedCategory, scope]
  );

  const handleCreateFeatureClick = useCallback(() => {
    onCreateFeature(
      selectedProjectId !== 'all' ? selectedProjectId : undefined,
      selectedCategory !== 'all' ? selectedCategory : undefined
    );
  }, [onCreateFeature, selectedProjectId, selectedCategory]);

  const handleCreateProjectClick = useCallback(() => {
    const name = window.prompt('Название проекта');
    if (!name?.trim()) return;
    onCreateProject?.(name.trim());
  }, [onCreateProject]);

  useLayoutEffect(() => {
    setLeading(<ToolbarModuleLabel accent="sky">Функционал</ToolbarModuleLabel>);
    setModule(
      <div className={APP_TOOLBAR_MODULE_CLUSTER}>
        <ModuleFilterIconButton
          accent="sky"
          size="sm"
          active={showFilters || filterActiveCount > 0}
          activeCount={filterActiveCount}
          label="Фильтры"
          onClick={() => setShowFilters((v) => !v)}
        />
        <ModuleCreateDropdown
          accent="sky"
          buttonSize="sm"
          label="Создать"
          items={[
            {
              id: 'create-feature',
              label: 'Функция',
              onClick: handleCreateFeatureClick,
            },
            {
              id: 'create-project',
              label: 'Проект',
              onClick: handleCreateProjectClick,
            },
          ]}
        />
      </div>
    );
    return () => {
      setLeading(null);
      setModule(null);
    };
  }, [
    setLeading,
    setModule,
    showFilters,
    filterActiveCount,
    handleCreateFeatureClick,
    handleCreateProjectClick,
  ]);

  // Получаем все проекты, у которых есть функции
  const projectsWithFeatures = useMemo(() => {
    const projectIds = new Set(features.filter(f => f.projectId).map(f => f.projectId!));
    return projects.filter(p => projectIds.has(p.id));
  }, [features, projects]);

  // Фильтруем функции по проекту и категории (только entityType: 'feature')
  const filteredFeatures = useMemo(() => {
    let result = features.filter(f => f.entityType === 'feature' && !f.isArchived);

    // Фильтр по проекту
    if (selectedProjectId !== 'all') {
      result = result.filter(f => f.projectId === selectedProjectId);
    }

    // Фильтр по категории
    if (selectedCategory !== 'all') {
      result = result.filter(f => f.category === selectedCategory);
    }

    if (scope === 'assigned') {
      result = result.filter((f) => !!f.assigneeId || !!(f.assigneeIds && f.assigneeIds.length));
    }
    if (scope === 'unassigned') {
      result = result.filter((f) => !f.assigneeId && !(f.assigneeIds && f.assigneeIds.length));
    }

    return result;
  }, [features, selectedProjectId, selectedCategory, scope]);

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
  const completedStatuses = ['Выполнено', 'Done', 'Завершено'];
  const completed = features.filter((f) => completedStatuses.includes(f.status)).length;
  
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const getStatusBadge = (statusName: string) => {
      const s = statuses.find(st => st.name === statusName);
      const color = s?.color || 'bg-gray-100 text-gray-600';
      
      return (
          <TaskBadgeInline color={color} className="px-2 py-1 rounded-full text-xs font-bold uppercase">
              {statusName}
          </TaskBadgeInline>
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
    <ModulePageShell>
      {showFilters && (
        <div className={`${MODULE_PAGE_GUTTER} pt-2 pb-2 flex-shrink-0 border-b border-gray-200 dark:border-[#333]`}>
          <div className="p-4 bg-gray-50 dark:bg-[#252525] rounded-lg border border-gray-200 dark:border-[#333]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Проект</label>
                <TaskSelect
                  value={selectedProjectId}
                  onChange={setSelectedProjectId}
                  options={[
                    { value: 'all', label: 'Все проекты' },
                    ...projectsWithFeatures.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Категория</label>
                <TaskSelect
                  value={selectedCategory}
                  onChange={setSelectedCategory}
                  options={[
                    { value: 'all', label: 'Все категории' },
                    ...STANDARD_CATEGORIES.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Исполнитель</label>
                <TaskSelect
                  value={scope}
                  onChange={(v) => setScope(v as 'all' | 'assigned' | 'unassigned')}
                  options={[
                    { value: 'all', label: 'Все' },
                    { value: 'assigned', label: 'С исполнителем' },
                    { value: 'unassigned', label: 'Без исполнителя' },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`${MODULE_PAGE_GUTTER} pt-4 md:pt-5 pb-2 flex-shrink-0`}>
        <div className="w-full bg-gray-100 dark:bg-[#333] rounded-full h-3 overflow-hidden">
          <div className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out relative" style={{ width: `${progress}%` }}>
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          </div>
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400 font-medium">
          <span>0%</span>
          <span>
            {completed} из {total} функций готово
          </span>
          <span>100%</span>
        </div>
      </div>


      {/* Features List - Grouped by Project and Category */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={`${MODULE_PAGE_GUTTER} pb-24 md:pb-32 h-full overflow-y-auto custom-scrollbar space-y-6`}>
            {Object.keys(groupedFeatures).length === 0 ? (
                <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-12 text-center">
                    <Layers size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                    <p className="text-gray-400 dark:text-gray-500 text-lg mb-2">Функционал пуст</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">Добавьте первую функцию</p>
                    <ModuleCreateIconButton
                        accent="sky"
                        label="Добавить функцию"
                        onClick={() => onCreateFeature()}
                        className="mx-auto"
                    />
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
    </ModulePageShell>
  );
};

export default FunctionalityView;
export { STANDARD_FEATURES, STANDARD_CATEGORIES };
