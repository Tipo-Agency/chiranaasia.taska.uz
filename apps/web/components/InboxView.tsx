
import React from 'react';
import { ActivityLog } from '../types';
import { Check, Clock, User as UserIcon, Inbox } from 'lucide-react';
import { ModulePageShell, ModulePageHeader, MODULE_PAGE_GUTTER } from './ui';

interface InboxViewProps {
  activities: ActivityLog[];
  onMarkAllRead: () => void;
}

const InboxView: React.FC<InboxViewProps> = ({ activities, onMarkAllRead }) => {
  const unread = activities.filter((a) => !a.read).length;
  return (
    <ModulePageShell>
      <div className={`${MODULE_PAGE_GUTTER} max-w-3xl pt-6 md:pt-8 pb-8`}>
        <ModulePageHeader
          accent="indigo"
          icon={<Inbox size={24} strokeWidth={2} />}
          title="Входящие"
          description={unread > 0 ? `Непрочитанных: ${unread}` : 'Уведомления и события'}
          actions={
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-sm font-medium text-[#3337AD] dark:text-indigo-300 hover:underline flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#191919] hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors"
            >
              <Check size={16} /> Прочитать все
            </button>
          }
        />

      <div className="mt-6 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl shadow-sm overflow-hidden">
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
    </ModulePageShell>
  );
};

export default InboxView;
