import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Instagram, Send, ExternalLink, MessageCircle, Globe, Sparkles } from 'lucide-react';
import type { Deal, User, Comment, SalesFunnel } from '../../types';
import { PageLayout } from '../ui/PageLayout';
import { api } from '../../backend/api';
import { devWarn } from '../../utils/devLog';
import { isFunnelDeal } from '../../utils/dealModel';

interface ClientChatsPageProps {
  deals: Deal[];
  users: User[];
  currentUser: User;
  salesFunnels?: SalesFunnel[];
  onSaveDeal: (deal: Deal) => void;
  /** Открыть ту же сделку в воронке (карточка CRM) */
  onOpenInFunnel?: (deal: Deal) => void;
}

/** Фильтр списка диалогов по каналу привлечения */
type ChannelFilter = 'all' | 'instagram' | 'telegram' | 'site' | 'other';

const SOURCE_META: Record<
  NonNullable<Deal['source']>,
  { label: string; short: string; className: string }
> = {
  instagram: {
    label: 'Instagram',
    short: 'IG',
    className: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/25',
  },
  telegram: {
    label: 'Telegram',
    short: 'TG',
    className: 'bg-sky-500/15 text-sky-800 dark:text-sky-200 border-sky-500/25',
  },
  site: {
    label: 'Сайт',
    short: 'WEB',
    className: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/25',
  },
  manual: {
    label: 'Вручную',
    short: '···',
    className: 'bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-500/20',
  },
  recommendation: {
    label: 'Рекомендация',
    short: 'Рек',
    className: 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/25',
  },
  vk: {
    label: 'VK',
    short: 'VK',
    className: 'bg-blue-500/15 text-blue-800 dark:text-blue-200 border-blue-500/25',
  },
};

function formatThreadTitle(d: Deal): string {
  const raw = (d.title || '').trim();
  if (raw) return raw;
  return 'Сделка';
}

function formatCommentTime(iso?: string): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function matchChannelFilter(d: Deal, f: ChannelFilter): boolean {
  if (f === 'all') return true;
  const s = (d.source || 'manual') as NonNullable<Deal['source']>;
  if (f === 'other') {
    return !['instagram', 'telegram', 'site'].includes(s);
  }
  return s === f;
}

function SourceBadge({ source }: { source?: Deal['source'] }) {
  const s = (source || 'manual') as NonNullable<Deal['source']>;
  const meta = SOURCE_META[s] || SOURCE_META.manual;
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${meta.className}`}
      title={meta.label}
    >
      {meta.short}
    </span>
  );
}

function funnelNameForDeal(deal: Deal, funnels: SalesFunnel[] | undefined): string | null {
  if (!deal.funnelId || !funnels?.length) return null;
  return funnels.find((f) => f.id === deal.funnelId)?.name || null;
}

export const ClientChatsPage: React.FC<ClientChatsPageProps> = ({
  deals,
  users,
  currentUser,
  salesFunnels = [],
  onSaveDeal,
  onOpenInFunnel,
}) => {
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');

  const threads = useMemo(() => {
    return deals
      .filter((d) => !d.isArchived && isFunnelDeal(d) && matchChannelFilter(d, channelFilter))
      .sort((a, b) => {
        const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return tb - ta;
      });
  }, [deals, channelFilter]);

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

  const active = useMemo(() => {
    if (!activeId) return undefined;
    return deals.find((d) => d.id === activeId && !d.isArchived && isFunnelDeal(d));
  }, [deals, activeId]);

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
      if (c.authorId?.startsWith('ig_user:')) return 'Клиент (Direct)';
      if (c.authorId === 'tg_user') return 'Клиент (Telegram)';
    }
    const u = users.find((x) => x.id === c.authorId);
    return u?.name || 'Вы';
  };

  const isMine = (c: Comment) =>
    c.authorId === currentUser.id ||
    c.type === 'telegram_out' ||
    c.type === 'instagram_out';

  const lastPreview = (d: Deal) => {
    const list = d.comments || [];
    if (!list.length) return 'Нет сообщений';
    const last = list[list.length - 1];
    const t = (last?.text || '').trim();
    return t.length > 72 ? `${t.slice(0, 69)}…` : t || '…';
  };

  const canSendExternal = (d: Deal | undefined): boolean => {
    if (!d) return false;
    if (d.source === 'instagram') return Boolean(d.telegramChatId?.startsWith('ig:'));
    if (d.source === 'telegram') {
      const id = String(d.telegramChatId || '').trim();
      return id.length > 0 && /^-?\d+$/.test(id);
    }
    return false;
  };

  const inputHint = (d: Deal | undefined): string => {
    if (!d) return '';
    if (d.source === 'instagram') return 'Написать в Instagram…';
    if (d.source === 'telegram') return 'Написать в Telegram…';
    if (d.source === 'site') return 'Внутренняя заметка (клиент с сайта не видит)…';
    return 'Внутренняя заметка по сделке…';
  };

  const handleSend = async () => {
    if (!active || !input.trim()) return;
    const text = input.trim();
    setSending(true);
    try {
      if (active.source === 'instagram' && active.telegramChatId?.startsWith('ig:')) {
        const updated = (await api.integrationsMeta.sendInstagram({ dealId: active.id, text })) as Deal;
        onSaveDeal({ ...active, ...updated });
        setInput('');
        return;
      }
      if (active.source === 'telegram' && canSendExternal(active)) {
        const updated = (await api.integrationsTelegram.sendToLead({ dealId: active.id, text })) as Deal;
        onSaveDeal({ ...active, ...updated });
        setInput('');
        return;
      }
      const c: Comment = {
        id: `note-${Date.now()}`,
        text,
        authorId: currentUser.id,
        createdAt: new Date().toISOString(),
        type: 'internal',
      };
      const nextComments = [...(active.comments || []), c];
      onSaveDeal({
        ...active,
        comments: nextComments,
        updatedAt: new Date().toISOString(),
      });
      setInput('');
    } catch (e) {
      devWarn('[Диалоги] send failed:', e);
    } finally {
      setSending(false);
    }
  };

  const filterTabs: { id: ChannelFilter; label: string }[] = [
    { id: 'all', label: 'Все' },
    { id: 'instagram', label: 'Instagram' },
    { id: 'telegram', label: 'Telegram' },
    { id: 'site', label: 'Сайт' },
    { id: 'other', label: 'Прочее' },
  ];

  return (
    <PageLayout className="flex-1 min-h-0" contentClassName="flex flex-1 flex-col min-h-0 overflow-hidden p-0">
      <div className="flex flex-1 min-h-0 gap-0 border-t border-gray-200 dark:border-[#333] bg-white dark:bg-[#191919]">
        <aside className="w-full max-w-[100vw] sm:w-[min(100%,340px)] shrink-0 border-r border-gray-200 dark:border-[#333] flex flex-col min-h-0 bg-gray-50/80 dark:bg-[#141414]">
          <div className="shrink-0 px-3 py-3 border-b border-gray-200 dark:border-[#333]">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-[#3337AD]/20 to-violet-600/15">
                <MessageCircle className="text-[#3337AD]" size={20} />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">Диалоги</h1>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Центр коммуникаций с лидами</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {filterTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setChannelFilter(t.id)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    channelFilter === t.id
                      ? 'bg-[#3337AD] text-white'
                      : 'bg-white dark:bg-[#252525] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-[#404040] hover:border-[#3337AD]/50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
            {threads.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                Нет сделок по выбранному каналу. Лиды появятся после сообщений из Instagram, Telegram или заявок с сайта.
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
                        <div className="shrink-0 pt-0.5">
                          <SourceBadge source={d.source} />
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

        <section className="flex-1 flex flex-col min-w-0 min-h-0 bg-white dark:bg-[#1a1a1a]">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400 px-6 text-center">
              Выберите диалог слева или смените фильтр канала.
            </div>
          ) : (
            <>
              <header className="shrink-0 px-4 py-3 border-b border-gray-200 dark:border-[#333] flex items-center justify-between gap-2">
                <div className="min-w-0 flex items-center gap-2">
                  <SourceBadge source={active.source} />
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">{formatThreadTitle(active)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1.5 flex-wrap">
                      {active.source === 'instagram' && (
                        <>
                          <Instagram size={12} className="text-pink-500 shrink-0" />
                          <span>Instagram Direct</span>
                        </>
                      )}
                      {active.source === 'telegram' && (
                        <span>Telegram</span>
                      )}
                      {active.source === 'site' && (
                        <>
                          <Globe size={12} className="text-emerald-500 shrink-0" />
                          <span>Заявка с сайта</span>
                        </>
                      )}
                      {active.source && !['instagram', 'telegram', 'site'].includes(active.source) && (
                        <>
                          <Sparkles size={12} className="text-amber-500 shrink-0" />
                          <span>{SOURCE_META[active.source]?.label || active.source}</span>
                        </>
                      )}
                      {funnelNameForDeal(active, salesFunnels) ? (
                        <span className="text-gray-400 dark:text-gray-500">
                          · {funnelNameForDeal(active, salesFunnels)}
                        </span>
                      ) : null}
                    </div>
                  </div>
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
                    const outgoing = c.type === 'instagram_out' || c.type === 'telegram_out';
                    return (
                      <div key={c.id} className={`max-w-[88%] ${mine ? 'ml-auto' : ''}`}>
                        <div
                          className={`rounded-2xl px-3 py-2 text-sm ${
                            mine
                              ? outgoing
                                ? 'bg-[#3337AD] text-white'
                                : 'bg-slate-600 text-white dark:bg-slate-700'
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
                {active.source === 'instagram' && !canSendExternal(active) && (
                  <p className="text-xs text-amber-600 dark:text-amber-400/90 text-center py-2 mb-2">
                    Нет привязки Instagram Direct — ответ клиенту из CRM недоступен, можно оставить внутренние заметки.
                  </p>
                )}
                {active.source === 'telegram' && !canSendExternal(active) && (
                  <p className="text-xs text-amber-600 dark:text-amber-400/90 text-center py-2 mb-2">
                    Нет Telegram chat id у сделки или бот воронки выключен — проверьте настройки.
                  </p>
                )}
                {(active.source === 'site' || active.source === 'manual' || active.source === 'recommendation' || active.source === 'vk') && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2 mb-2">
                    Внешний чат недоступен для этого источника — сохраняются только внутренние заметки по сделке.
                  </p>
                )}
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
                    placeholder={inputHint(active)}
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
              </div>
            </>
          )}
        </section>
      </div>
    </PageLayout>
  );
};
