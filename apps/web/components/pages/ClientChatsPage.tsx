import React, { useMemo } from 'react';
import { Instagram, MessageCircle } from 'lucide-react';
import type { Deal, User } from '../../types';
import { PageLayout } from '../ui/PageLayout';
import { Container } from '../ui/Container';
import { MODULE_PAGE_GUTTER, ModulePageShell } from '../ui';

interface ClientChatsPageProps {
  deals: Deal[];
  users: User[];
  onOpenDeal: (deal: Deal) => void;
}

export const ClientChatsPage: React.FC<ClientChatsPageProps> = ({ deals, users, onOpenDeal }) => {
  const instagramDeals = useMemo(() => {
    return deals
      .filter((d) => !d.isArchived && d.source === 'instagram')
      .sort((a, b) => {
        const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return tb - ta;
      });
  }, [deals]);

  const nameForUser = (id?: string) => {
    if (!id) return '—';
    return users.find((u) => u.id === id)?.name || id;
  };

  const lastPreview = (d: Deal) => {
    const list = d.comments || [];
    if (list.length === 0) return 'Нет сообщений';
    const last = list[list.length - 1];
    const t = (last?.text || '').trim();
    return t.length > 120 ? `${t.slice(0, 117)}…` : t || '…';
  };

  return (
    <PageLayout>
      <Container className="max-w-5xl mx-auto">
        <ModulePageShell>
          <div className={`${MODULE_PAGE_GUTTER} pt-6 md:pt-8 pb-16`}>
            <div className="flex items-start gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-600/20 border border-pink-500/20">
                <Instagram className="text-pink-500" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Чаты с клиентами</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
                  Диалоги из Instagram: новая сделка создаётся при первом сообщении в Direct подключённого аккаунта.
                </p>
              </div>
            </div>
            <div className="pb-4">
            {instagramDeals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 dark:border-[#333] flex flex-col items-center justify-center py-16 px-6 text-center text-gray-500 dark:text-gray-400">
                <MessageCircle size={40} className="mb-3 opacity-50" />
                <p className="text-sm max-w-md">
                  Пока нет чатов из Instagram. Когда клиент напишет в Direct подключённого аккаунта, здесь появится
                  сделка, а переписка — во вкладке «Чат» в карточке.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {instagramDeals.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => onOpenDeal(d)}
                      className="w-full text-left rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] px-4 py-3 hover:border-pink-400/60 dark:hover:border-pink-500/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {d.title || 'Без названия'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Ответственный: {nameForUser(d.assigneeId)} · {d.contactName || d.telegramUsername || ''}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">
                            {lastPreview(d)}
                          </div>
                        </div>
                        <Instagram size={18} className="text-pink-500 shrink-0 mt-0.5" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            </div>
          </div>
        </ModulePageShell>
      </Container>
    </PageLayout>
  );
};
