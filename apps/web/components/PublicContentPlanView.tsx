import React, { useState, useEffect } from 'react';
import { ContentPost, TableCollection, ShootPlan } from '../types';
import { Calendar, Instagram, Send, Youtube, Linkedin, Clapperboard } from 'lucide-react';
import { api } from '../backend/api';
import { ModulePageShell, ModulePageHeader, ModuleSegmentedControl, MODULE_PAGE_GUTTER } from './ui';

interface PublicContentPlanViewProps {
  tableId: string;
}

const PublicContentPlanView: React.FC<PublicContentPlanViewProps> = ({ tableId }) => {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [shootPlans, setShootPlans] = useState<ShootPlan[]>([]);
  const [table, setTable] = useState<TableCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'table' | 'gantt'>('calendar');
  const [formatFilter, setFormatFilter] = useState<'all' | 'post' | 'reel' | 'story' | 'article' | 'video'>('all');
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const res = await api.publicContentPlan.getByTableId(tableId);
        const t = (res.table || null) as TableCollection | null;
        const p = (res.posts || []) as ContentPost[];
        const sp = (res.shootPlans || []) as ShootPlan[];
        setTable(t);
        setPosts(p);
        setShootPlans(sp);
      } catch (err) {
        console.error('Ошибка загрузки данных:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [tableId]);

  const getPlatformIcon = (p: string) => {
    switch (p) {
      case 'instagram': return <Instagram size={14} className="text-pink-600"/>;
      case 'telegram': return <Send size={14} className="text-blue-500"/>;
      case 'youtube': return <Youtube size={14} className="text-red-600"/>;
      case 'linkedin': return <Linkedin size={14} className="text-blue-700"/>;
      default: return <Send size={14}/>;
    }
  };

  const getStatusLabel = (s: string) => {
    switch (s) {
      case 'idea': return 'Идея';
      case 'copywriting': return 'Копирайтинг';
      case 'design': return 'Дизайн';
      case 'approval': return 'Согласование';
      case 'scheduled': return 'План';
      case 'published': return 'Готово';
      default: return s;
    }
  };

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'idea': return 'bg-gray-100 text-gray-700';
      case 'copywriting': return 'bg-blue-100 text-blue-700';
      case 'design': return 'bg-purple-100 text-purple-700';
      case 'approval': return 'bg-yellow-100 text-yellow-700';
      case 'scheduled': return 'bg-green-100 text-green-700';
      case 'published': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-gray-100 text-gray-700';
    }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#121212] flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Загрузка...</div>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#121212] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Контент-план не найден</h1>
          <p className="text-gray-500 dark:text-gray-400">Проверьте правильность ссылки</p>
        </div>
      </div>
    );
  }

  const filteredPosts = posts.filter(post =>
    formatFilter === 'all' ? true : post.format === formatFilter
  );
  // Фильтруем посты по текущему месяцу для всех режимов (как в основной системе)
  const monthPosts = filteredPosts.filter(p => {
    if (!p.date) return false;
    const d = new Date(p.date);
    return d.getFullYear() === currentMonth.getFullYear() && d.getMonth() === currentMonth.getMonth();
  });

  const postsSortedDesc = [...monthPosts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const postsSortedAsc = [...monthPosts].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Календарная сетка по месяцам
  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const startWeekDay = (monthStart.getDay() + 6) % 7; // делаем понедельник первым
  const daysInMonth = monthEnd.getDate();

  const days: Date[] = [];
  // дни предыдущего месяца
  for (let i = 0; i < startWeekDay; i++) {
    const d = new Date(monthStart);
    d.setDate(d.getDate() - (startWeekDay - i));
    days.push(d);
  }
  // текущий месяц
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d));
  }
  // добиваем до кратности 7
  while (days.length % 7 !== 0) {
    const d = new Date(days[days.length - 1]);
    d.setDate(d.getDate() + 1);
    days.push(d);
  }

  const postsByDay = (date: Date) => {
    const key = date.toISOString().slice(0, 10);
    return monthPosts.filter(p => p.date && p.date.slice(0, 10) === key);
  };

  const monthLabel = currentMonth.toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <ModulePageShell className="min-h-screen">
      <div className={`${MODULE_PAGE_GUTTER} py-8 space-y-4`}>
        <ModulePageHeader
          icon={<Calendar size={24} strokeWidth={2} />}
          title={table.name}
          description="Публичный контент-план"
          accent="yellow"
        />

        <ModuleSegmentedControl
          size="sm"
          value={viewMode}
          onChange={setViewMode}
          variant="accent"
          accent="yellow"
          options={[
            { value: 'calendar', label: 'Календарь' },
            { value: 'table', label: 'Список' },
            { value: 'gantt', label: 'Таймлайн' },
          ]}
        />

        {shootPlans.length > 0 && (
          <div className="bg-white dark:bg-[#252525] rounded-lg shadow-sm border border-gray-200 dark:border-[#333] overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-[#333] flex items-center gap-2">
              <Clapperboard size={18} className="text-orange-500 shrink-0" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Планы съёмки</h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">только для этого контент-плана</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[480px]">
                <thead className="bg-gray-50 dark:bg-[#202020] text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Дата</th>
                    <th className="px-4 py-2 font-semibold">Название</th>
                    <th className="px-4 py-2 font-semibold">Позиций</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
                  {[...shootPlans]
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((plan) => (
                      <tr key={plan.id} className="hover:bg-gray-50 dark:hover:bg-[#2a2a2a]">
                        <td className="px-4 py-2.5 text-gray-800 dark:text-gray-200 whitespace-nowrap">
                          {plan.date
                            ? new Date(plan.date).toLocaleDateString('ru-RU', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              }).replace(/\//g, '.')
                            : '—'}
                          {plan.time ? ` · ${plan.time}` : ''}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">
                          {plan.title || 'Съёмка'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                          {(plan.items || []).length}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Format filter */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-600 dark:text-gray-300 font-medium">Формат:</span>
          {[
            { id: 'all', label: 'Все' },
            { id: 'post', label: 'Пост' },
            { id: 'reel', label: 'Reels' },
            { id: 'story', label: 'Stories' },
            { id: 'article', label: 'Статья' },
            { id: 'video', label: 'Видео' },
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormatFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-full border text-xs font-medium ${
                formatFilter === f.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-[#252525] text-gray-700 dark:text-gray-200 border-gray-200 dark:border-[#333]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Content (scrollable) */}
        <div className="max-h-[70vh] overflow-y-auto custom-scrollbar space-y-4">
          {viewMode === 'calendar' && (
            <div className="bg-white dark:bg-[#252525] rounded-lg shadow-sm p-4 space-y-3">
              {/* Навигация по месяцам */}
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <button
                  type="button"
                  className="px-2 py-1 rounded border border-gray-200 dark:border-[#333]"
                  onClick={() =>
                    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                  }
                >
                  ‹
                </button>
                <span className="font-medium capitalize">{monthLabel}</span>
                <button
                  type="button"
                  className="px-2 py-1 rounded border border-gray-200 dark:border-[#333]"
                  onClick={() =>
                    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                  }
                >
                  ›
                </button>
                <button
                  type="button"
                  className="ml-2 px-2 py-1 rounded border border-gray-200 dark:border-[#333] text-xs"
                  onClick={() => {
                    const now = new Date();
                    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                  }}
                >
                  Сегодня
                </button>
              </div>

              {/* Шапка дней недели */}
              <div className="grid grid-cols-7 gap-px mt-2 bg-gray-200 dark:bg-[#333] text-[11px] text-gray-500 dark:text-gray-400">
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
                  <div
                    key={d}
                    className="bg-gray-50 dark:bg-[#202020] px-2 py-1 text-center font-medium"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Сетка дней */}
              <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-[#333]">
                {days.map(d => {
                  const key = d.toISOString().slice(0, 10);
                  const inMonth = d.getMonth() === currentMonth.getMonth();
                  const dayPosts = postsByDay(d);
                  return (
                    <div
                      key={key}
                      className={`min-h-[80px] bg-white dark:bg-[#252525] p-1.5 border border-transparent ${
                        inMonth ? '' : 'opacity-40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-gray-700 dark:text-gray-200">
                          {d.getDate()}
                        </span>
                        {dayPosts.length > 0 && (
                          <span className="text-[10px] text-gray-400">{dayPosts.length}</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {dayPosts.map(p => (
                          <div
                            key={p.id}
                            className="rounded bg-gray-100 dark:bg-[#303030] px-1.5 py-0.5 text-[10px] text-gray-800 dark:text-gray-100"
                          >
                            <span className="mr-1 text-[9px] uppercase opacity-70">
                              {getFormatLabel(p.format)}
                            </span>
                            {p.topic}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === 'table' && (
            <div className="bg-white dark:bg-[#252525] rounded-lg shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-[#202020]">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Тема</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Дата</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Площадки</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-[#333]">
                  {postsSortedDesc.map(post => (
                  <tr key={post.id} className="hover:bg-gray-50 dark:hover:bg-[#303030]">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{post.topic}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(post.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {Array.isArray(post.platform) ? post.platform.map(p => getPlatformIcon(p)) : getPlatformIcon(post.platform)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(post.status)}`}>
                        {getStatusLabel(post.status)}
                      </span>
                    </td>
                  </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {viewMode === 'gantt' && (
            <div className="bg-white dark:bg-[#252525] rounded-lg shadow-sm p-6 overflow-x-auto">
              <div className="min-w-[800px]">
                <div className="space-y-4">
                  {postsSortedAsc.map(post => {
                  const postDate = new Date(post.date);
                  const today = new Date();
                  const daysDiff = Math.floor((postDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  const position = Math.max(0, Math.min(100, (daysDiff + 30) / 60 * 100));
                  
                  return (
                    <div key={post.id} className="relative">
                      <div className="flex items-center gap-4 mb-2">
                        <div className="w-48 font-medium text-gray-900 dark:text-white text-sm truncate">{post.topic}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {postDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')}
                        </div>
                      </div>
                      <div className="relative h-8 bg-gray-100 dark:bg-[#303030] rounded">
                        <div 
                          className="absolute h-full bg-blue-500 rounded flex items-center justify-center text-white text-xs font-medium"
                          style={{ left: `${position}%`, width: '4px', minWidth: '4px' }}
                        >
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
              </div>
            </div>
          )}

          {filteredPosts.length === 0 && (
            <div className="bg-white dark:bg-[#252525] rounded-lg shadow-sm p-12 text-center">
              <p className="text-gray-500 dark:text-gray-400">Контент-план пуст</p>
            </div>
          )}
        </div>
      </div>
    </ModulePageShell>
  );
};

export default PublicContentPlanView;

