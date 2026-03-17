import React, { useState, useEffect } from 'react';
import { ContentPost, TableCollection } from '../types';
import { Calendar, Instagram, Send, Youtube, Linkedin } from 'lucide-react';
import { api } from '../backend/api';

interface PublicContentPlanViewProps {
  tableId: string;
}

const PublicContentPlanView: React.FC<PublicContentPlanViewProps> = ({ tableId }) => {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [table, setTable] = useState<TableCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'table' | 'gantt'>('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const res = await api.publicContentPlan.getByTableId(tableId);
        const t = (res.table || null) as TableCollection | null;
        const p = (res.posts || []) as ContentPost[];
        setTable(t);
        setPosts(p);
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#121212]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{table.name}</h1>
          <p className="text-gray-500 dark:text-gray-400">Публичный контент-план</p>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center gap-2 bg-white dark:bg-[#252525] rounded-lg p-1 mb-6 shadow-sm">
          <button 
            onClick={() => setViewMode('calendar')} 
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'calendar' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333]'
            }`}
          >
            Календарь
          </button>
          <button 
            onClick={() => setViewMode('table')} 
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'table' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333]'
            }`}
          >
            Список
          </button>
          <button 
            onClick={() => setViewMode('gantt')} 
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'gantt' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333]'
            }`}
          >
            Таймлайн
          </button>
        </div>

        {/* Content */}
        {viewMode === 'calendar' && (
          <div className="bg-white dark:bg-[#252525] rounded-lg shadow-sm p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {posts.map(post => (
                <div key={post.id} className="border border-gray-200 dark:border-[#333] rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{post.topic}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(post.status)}`}>
                      {getStatusLabel(post.status)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    {new Date(post.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {Array.isArray(post.platform) ? post.platform.map(p => (
                      <div key={p} className="flex items-center gap-1">
                        {getPlatformIcon(p)}
                      </div>
                    )) : getPlatformIcon(post.platform)}
                  </div>
                  {post.copy && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{post.copy}</p>
                  )}
                </div>
              ))}
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
                {posts.map(post => (
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
                {posts.map(post => {
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

        {posts.length === 0 && (
          <div className="bg-white dark:bg-[#252525] rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">Контент-план пуст</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicContentPlanView;

