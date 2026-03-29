import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Instagram, Send, ExternalLink } from 'lucide-react';
import type { Deal, User, Comment } from '../../types';
import { PageLayout } from '../ui/PageLayout';
import { api } from '../../backend/api';
import { devWarn } from '../../utils/devLog';

interface ClientChatsPageProps {
  deals: Deal[];
  users: User[];
  currentUser: User;
  onSaveDeal: (deal: Deal) => void;
  /** Открыть ту же сделку в воронке (карточка CRM) */
  onOpenInFunnel?: (deal: Deal) => void;
}

function formatThreadTitle(d: Deal): string {
  const raw = (d.title || '').trim();
  if (raw) return raw;
  return 'Instagram';
}

function formatCommentTime(iso?: string): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export const ClientChatsPage: React.FC<ClientChatsPageProps> = ({
  deals,
  users,
  currentUser,
  onSaveDeal,
  onOpenInFunnel,
}) => {
  const threads = useMemo(() => {
    return deals
      .filter((d) => !d.isArchived && d.source === 'instagram')
      .sort((a, b) => {
        const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return tb - ta;
      });
  }, [deals]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!threads.length) {
      setActiveId(null);
      return;
    }
    if (!activeId || !threads.some((t) => t.id === activeId)) {
      setActiveId(threads[0].id);
    }
  }, [threads, activeId]);

  const active = useMemo(
    () => (activeId ? deals.find((d) => d.id === activeId && d.source === 'instagram' && !d.isArchived) : undefined),
    [deals, activeId]
  );

  const sortedComments = useMemo(() => {
    const list = [...(active?.comments || [])];
    return list.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ta - tb;
    });
  }, [active?.comments]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeId, sortedComments.length, sending]);

  const getAuthorLabel = (c: Comment) => {
    if (c.type === 'instagram_in' || c.type === 'telegram_in') {
      if (c.authorId?.startsWith('ig_user:')) return 'В Direct';
    }
    const u = users.find((x) => x.id === c.authorId);
    return u?.name || 'Вы';
  };

  const isMine = (c: Comment) =>
    c.authorId === currentUser.id || c.type === 'telegram_out' || c.type === 'instagram_out';

  const lastPreview = (d: Deal) => {
    const list = d.comments || [];
    if (!list.length) return 'Нет сообщений';
    const last = list[list.length - 1];
    const t = (last?.text || '').trim();
    return t.length > 72 ? `${t.slice(0, 69)}…` : t || '…';
  };

  const canSend = Boolean(active?.telegramChatId?.startsWith('ig:'));

  const handleSend = async () => {
    if (!active || !input.trim() || !canSend) return;
    setSending(true);
    try {
      const updated = (await api.integrationsMeta.sendInstagram({ dealId: active.id, text: input.trim() })) as Deal;
      onSaveDeal({ ...active, ...updated });
      setInput('');
    } catch (e) {
      devWarn('[Instagram chat] send failed:', e);
    } finally {
      setSending(false);
    }
  };

  return (
    <PageLayout className="flex-1 min-h-0" contentClassName="flex flex-1 flex-col min-h-0 overflow-hidden p-0">
      <div className="flex flex-1 min-h-0 gap-0 border-t border-gray-200 dark:border-[#333] bg-white dark:bg-[#191919]">
        {/* Список диалогов */}
        <aside className="w-full max-w-[100vw] sm:w-[min(100%,320px)] shrink-0 border-r border-gray-200 dark:border-[#333] flex flex-col min-h-0 bg-gray-50/80 dark:bg-[#141414]">
          <div className="shrink-0 px-3 py-3 border-b border-gray-200 dark:border-[#333] flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-600/15">
              <Instagram className="text-pink-500" size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">Instagram</h1>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Входящие из Direct</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
            {threads.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                Пока никто не писал в Direct подключённых аккаунтов.
              </div>
            ) : (
              <ul className="py-1">
                {threads.map((d) => {
                  const selected = d.id === activeId;
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(d.id)}
                        className={`w-full text-left px-3 py-2.5 flex gap-2 transition-colors border-b border-transparent ${
                          selected
                            ? 'bg-white dark:bg-[#252525] border-b-gray-200 dark:border-b-[#333]'
                            : 'hover:bg-gray-100/90 dark:hover:bg-[#1f1f1f]'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500/30 to-purple-600/25 flex items-center justify-center shrink-0">
                          <Instagram size={16} className="text-pink-600 dark:text-pink-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {formatThreadTitle(d)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{lastPreview(d)}</div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Окно переписки */}
        <section className="flex-1 flex flex-col min-w-0 min-h-0 bg-white dark:bg-[#1a1a1a]">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400 px-6 text-center">
              Выберите диалог слева или дождитесь первого сообщения в Instagram Direct.
            </div>
          ) : (
            <>
              <header className="shrink-0 px-4 py-3 border-b border-gray-200 dark:border-[#333] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate">{formatThreadTitle(active)}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">Переписка из Instagram</div>
                </div>
                {onOpenInFunnel && (
                  <button
                    type="button"
                    onClick={() => onOpenInFunnel(active)}
                    className="shrink-0 flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400 hover:underline px-2 py-1 rounded-lg hover:bg-violet-500/10"
                  >
                    <ExternalLink size={14} />
                    Воронка
                  </button>
                )}
              </header>

              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 py-3 space-y-3 custom-scrollbar min-h-0 bg-gray-50/50 dark:bg-[#141414]"
              >
                {sortedComments.length === 0 ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">Сообщений пока нет</div>
                ) : (
                  sortedComments.map((c) => {
                    const mine = isMine(c);
                    return (
                      <div key={c.id} className={`max-w-[88%] ${mine ? 'ml-auto' : ''}`}>
                        <div
                          className={`rounded-2xl px-3 py-2 text-sm ${
                            mine
                              ? 'bg-[#3337AD] text-white'
                              : 'bg-white dark:bg-[#2a2a2a] text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-[#404040]'
                          }`}
                        >
                          <div
                            className={`mb-1 text-[11px] ${
                              mine ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            {getAuthorLabel(c)}
                            {formatCommentTime(c.createdAt) ? ` · ${formatCommentTime(c.createdAt)}` : ''}
                          </div>
                          <div className="whitespace-pre-wrap break-words">{c.text}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="shrink-0 p-3 border-t border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a]">
                {!canSend ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400/90 text-center py-2">
                    К этой записи нет привязки Instagram — ответ из CRM недоступен.
                  </p>
                ) : (
                  <div className="flex gap-2 items-end">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void handleSend();
                        }
                      }}
                      placeholder="Написать в Instagram…"
                      disabled={sending}
                      className="flex-1 border border-gray-300 dark:border-[#404040] rounded-xl px-3 py-2.5 min-h-[44px] text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSend()}
                      disabled={sending || !input.trim()}
                      className="shrink-0 h-11 w-11 flex items-center justify-center rounded-xl bg-[#3337AD] text-white disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Отправить"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </PageLayout>
  );
};
