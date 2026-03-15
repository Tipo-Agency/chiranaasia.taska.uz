
import React from 'react';
import { ActivityLog } from '../types';
import { Check, Clock, User as UserIcon } from 'lucide-react';

interface InboxViewProps {
  activities: ActivityLog[];
  onMarkAllRead: () => void;
}

const InboxView: React.FC<InboxViewProps> = ({ activities, onMarkAllRead }) => {
  return (
    <div className="max-w-3xl mx-auto w-full pt-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            Входящие
            {activities.filter(a => !a.read).length > 0 && (
                <span className="text-sm bg-red-500 text-white px-2 py-0.5 rounded-full">
                    {activities.filter(a => !a.read).length}
                </span>
            )}
        </h1>
        <button 
            onClick={onMarkAllRead}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-[#333] transition-colors"
        >
            <Check size={16} /> Прочитать все
        </button>
      </div>

      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-sm overflow-hidden">
        {activities.length === 0 ? (
            <div className="p-12 text-center text-gray-400 dark:text-gray-500 flex flex-col items-center">
                <Clock size={48} className="mb-4 opacity-20" />
                <p>Нет новых уведомлений</p>
            </div>
        ) : (
            <div className="divide-y divide-gray-100 dark:divide-[#333]">
                {activities.map(log => (
                    <div key={log.id} className={`p-4 flex gap-4 transition-colors ${!log.read ? 'bg-blue-50/50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-[#303030]'}`}>
                        <div className="mt-1">
                             {log.userAvatar ? (
                                 <img src={log.userAvatar} className="w-8 h-8 rounded-full border border-gray-200 dark:border-[#444] object-cover object-center" alt="" />
                             ) : (
                                 <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-[#444] flex items-center justify-center text-gray-500 dark:text-gray-300">
                                     <UserIcon size={14} />
                                 </div>
                             )}
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-start">
                                <div className="text-sm">
                                    <span className="font-semibold text-gray-900 dark:text-white">{log.userName}</span>
                                    <span className="text-gray-600 dark:text-gray-400 mx-1">{log.action}</span>
                                    <span className="font-medium text-gray-800 dark:text-gray-200">"{log.details}"</span>
                                </div>
                                <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap ml-2">
                                    {new Date(log.timestamp).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                                </span>
                            </div>
                        </div>
                        {!log.read && (
                            <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0"></div>
                        )}
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default InboxView;
