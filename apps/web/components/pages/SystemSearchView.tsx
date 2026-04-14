/**
 * Глобальный поиск по системе (рабочий стол → Enter в шапке).
 * Задачи, сделки воронки, клиенты, встречи, документы.
 */
import React, { useMemo } from 'react';
import {
  CheckSquare,
  Briefcase,
  Users,
  Calendar,
  FileText,
  Search,
} from 'lucide-react';
import type { Task, Deal, Client, Meeting, Doc } from '../../types';
import type { AppActions } from '../../frontend/hooks/useAppLogic';
import { ModulePageShell, MODULE_PAGE_GUTTER, MODULE_PAGE_TOP_PAD } from '../ui';
import { getDealDisplayTitle, isFunnelDeal } from '../../utils/dealModel';
import { normalizeHeaderSearchQuery, rowMatchesHeaderSearch } from '../../utils/headerSearchMatch';

export interface SystemSearchViewProps {
  query: string;
  tasks: Task[];
  deals: Deal[];
  clients: Client[];
  meetings: Meeting[];
  docs: Doc[];
  actions: AppActions;
}

export const SystemSearchView: React.FC<SystemSearchViewProps> = ({
  query,
  tasks,
  deals,
  clients,
  meetings,
  docs,
  actions,
}) => {
  const qNorm = useMemo(() => normalizeHeaderSearchQuery(query), [query]);

  const matchedTasks = useMemo(() => {
    if (!qNorm) return [];
    return tasks.filter(
      (t) =>
        !t.isArchived &&
        t.entityType !== 'idea' &&
        t.entityType !== 'feature' &&
        rowMatchesHeaderSearch(qNorm, [t.title, t.description, t.status, t.source])
    );
  }, [tasks, qNorm]);

  const matchedDeals = useMemo(() => {
    if (!qNorm) return [];
    return deals.filter((d) => {
      if (d.isArchived || !isFunnelDeal(d)) return false;
      const c = d.clientId ? clients.find((x) => x.id === d.clientId) : undefined;
      return rowMatchesHeaderSearch(qNorm, [
        d.title,
        d.contactName,
        d.notes,
        d.number,
        d.telegramUsername,
        c?.name,
        c?.companyName,
        c?.phone,
        c?.email,
      ]);
    });
  }, [deals, clients, qNorm]);

  const matchedClients = useMemo(() => {
    if (!qNorm) return [];
    return clients.filter(
      (c) =>
        !c.isArchived &&
        rowMatchesHeaderSearch(qNorm, [c.name, c.companyName, c.phone, c.email, c.telegram, c.instagram, c.notes])
    );
  }, [clients, qNorm]);

  const matchedMeetings = useMemo(() => {
    if (!qNorm) return [];
    return meetings.filter((m) => !m.isArchived && rowMatchesHeaderSearch(qNorm, [m.title, m.summary, m.date]));
  }, [meetings, qNorm]);

  const matchedDocs = useMemo(() => {
    if (!qNorm) return [];
    return docs.filter((d) => !d.isArchived && rowMatchesHeaderSearch(qNorm, [d.title, d.url, d.content]));
  }, [docs, qNorm]);

  const total =
    matchedTasks.length +
    matchedDeals.length +
    matchedClients.length +
    matchedMeetings.length +
    matchedDocs.length;

  const openDeal = (dealId: string) => {
    actions.setCurrentView('sales-funnel');
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('openDealFromChat', { detail: { dealId } }));
    }, 0);
  };

  return (
    <ModulePageShell className="flex-1 min-h-0 overflow-hidden">
      <div className={`${MODULE_PAGE_GUTTER} ${MODULE_PAGE_TOP_PAD} flex-1 min-h-0 overflow-y-auto custom-scrollbar pb-24`}>
        <div className="flex items-center gap-2 mb-4 text-gray-900 dark:text-white">
          <Search className="w-5 h-5 text-[#3337AD] shrink-0" aria-hidden />
          <h1 className="text-lg font-semibold">Поиск по системе</h1>
          {qNorm ? (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              «{query.trim()}» — {total} совпад.
            </span>
          ) : (
            <span className="text-sm text-gray-500 dark:text-gray-400">Введите запрос в шапке и нажмите Enter</span>
          )}
        </div>

        {!qNorm ? null : total === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">Ничего не найдено.</p>
        ) : (
          <div className="space-y-8">
            {matchedTasks.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">
                  <CheckSquare className="w-4 h-4 text-blue-500" />
                  Задачи ({matchedTasks.length})
                </h2>
                <ul className="space-y-1 rounded-xl border border-gray-200 dark:border-[#333] divide-y divide-gray-100 dark:divide-[#333] overflow-hidden bg-white dark:bg-[#1e1e1e]">
                  {matchedTasks.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => actions.openTaskModal(t)}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-[#252525] text-sm"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">{t.title || 'Без названия'}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {t.status}
                          {t.endDate ? ` · до ${t.endDate}` : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {matchedDeals.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">
                  <Briefcase className="w-4 h-4 text-violet-500" />
                  Сделки в воронке ({matchedDeals.length})
                </h2>
                <ul className="space-y-1 rounded-xl border border-gray-200 dark:border-[#333] divide-y divide-gray-100 dark:divide-[#333] overflow-hidden bg-white dark:bg-[#1e1e1e]">
                  {matchedDeals.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => openDeal(d.id)}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-[#252525] text-sm"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">{getDealDisplayTitle(d)}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {d.stage || '—'}
                          {d.contactName ? ` · ${d.contactName}` : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {matchedClients.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">
                  <Users className="w-4 h-4 text-emerald-500" />
                  Клиенты ({matchedClients.length})
                </h2>
                <ul className="space-y-1 rounded-xl border border-gray-200 dark:border-[#333] divide-y divide-gray-100 dark:divide-[#333] overflow-hidden bg-white dark:bg-[#1e1e1e]">
                  {matchedClients.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          actions.setCurrentView('sales-funnel');
                          actions.setCrmHubTab('clients');
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-[#252525] text-sm"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">{c.name}</span>
                        {c.companyName ? (
                          <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.companyName}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {matchedMeetings.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">
                  <Calendar className="w-4 h-4 text-purple-500" />
                  Встречи ({matchedMeetings.length})
                </h2>
                <ul className="space-y-1 rounded-xl border border-gray-200 dark:border-[#333] divide-y divide-gray-100 dark:divide-[#333] overflow-hidden bg-white dark:bg-[#1e1e1e]">
                  {matchedMeetings.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => {
                          actions.setWorkdeskTab('meetings');
                          actions.setCurrentView('home');
                          window.setTimeout(() => {
                            window.dispatchEvent(
                              new CustomEvent('openMeetingFromChat', { detail: { meetingId: m.id } })
                            );
                          }, 0);
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-[#252525] text-sm"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">{m.title || 'Встреча'}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {m.date || '—'}
                          {m.time ? ` · ${m.time}` : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {matchedDocs.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">
                  <FileText className="w-4 h-4 text-amber-500" />
                  Документы ({matchedDocs.length})
                </h2>
                <ul className="space-y-1 rounded-xl border border-gray-200 dark:border-[#333] divide-y divide-gray-100 dark:divide-[#333] overflow-hidden bg-white dark:bg-[#1e1e1e]">
                  {matchedDocs.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => actions.handleDocClick(d)}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-[#252525] text-sm"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">{d.title}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{d.type}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </ModulePageShell>
  );
};
