import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Instagram, Send, MessageCircle, Globe, UserRound } from 'lucide-react';
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
  /** Если используется внутри модального/встроенного контейнера (без внешнего PageLayout) */
  layout?: 'page' | 'embedded';
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

/** Круглый «аватар» канала — как иконки в чате сотрудников */
function SourceChannelAvatar({
  source,
  selected,
  titleHint,
}: {
  source?: Deal['source'];
  selected: boolean;
  titleHint?: string;
}) {
  const s = (source || 'manual') as NonNullable<Deal['source']>;
  const letter = (titleHint || '?').trim().charAt(0).toUpperCase() || '?';
  const ring = selected ? 'ring-white/35' : 'ring-gray-200 dark:ring-[#444]';
  const base = `flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-2 ${ring}`;

  if (s === 'instagram') {
    return (
      <div className={`${base} ${selected ? 'bg-white/20 text-white' : 'bg-pink-500/15 text-pink-600 dark:text-pink-300'}`}>
        <Instagram size={18} strokeWidth={2} />
      </div>
    );
  }
  if (s === 'telegram') {
    return (
      <div className={`${base} ${selected ? 'bg-white/20 text-white' : 'bg-sky-500/15 text-sky-600 dark:text-sky-300'}`}>
        <MessageCircle size={18} strokeWidth={2} />
      </div>
    );
  }
  if (s === 'site') {
    return (
      <div className={`${base} ${selected ? 'bg-white/20 text-white' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'}`}>
        <Globe size={18} strokeWidth={2} />
      </div>
    );
  }
  if (s === 'recommendation' || s === 'vk') {
    return (
      <div className={`${base} ${selected ? 'bg-white/20 text-white' : 'bg-amber-500/15 text-amber-700 dark:text-amber-200'} text-[11px] font-bold`}>
        {SOURCE_META[s]?.short || '?'}
      </div>
    );
  }
  return (
    <div
      className={`${base} ${
        selected ? 'bg-white/20 text-white' : 'bg-[#3337AD]/12 text-[#3337AD] dark:text-[#8b8ee0]'
      } text-xs font-semibold`}
    >
      {letter.match(/[A-ZА-ЯЁ0-9]/i) ? letter : <UserRound size={18} strokeWidth={2} />}
    </div>
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
  layout = 'page',
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
  const [tgPersonal, setTgPersonal] = useState<{ connected: boolean; apiConfigured: boolean } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    void api.integrationsTelegramPersonal
      .status()
      .then((s) => setTgPersonal({ connected: s.connected, apiConfigured: s.apiConfigured }))
      .catch(() => setTgPersonal({ connected: false, apiConfigured: false }));
  }, []);

  useEffect(() => {
    if (!active || active.source !== 'telegram' || !tgPersonal?.connected) return;
    let cancelled = false;
    void api.integrationsTelegramPersonal
      .syncMessages(active.id)
      .then((up) => {
        if (!cancelled) onSaveDeal(up as Deal);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active?.id, active?.source, tgPersonal?.connected]);

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
      const un = String(d.telegramUsername || '').trim();
      const peerOk =
        (id.length > 0 && /^-?\d+$/.test(id)) || (un.length > 0 && !un.startsWith('ig:'));
      if (tgPersonal?.connected && peerOk) return true;
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
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        return;
      }
      if (active.source === 'telegram' && canSendExternal(active)) {
        const updated = (await (tgPersonal?.connected
          ? api.integrationsTelegramPersonal.sendDeal(active.id, { text })
          : api.integrationsTelegram.sendToLead({ dealId: active.id, text }))) as Deal;
        onSaveDeal({ ...active, ...updated });
        setInput('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
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
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
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

  const footerNotice = !active
    ? ''
    : active.source === 'instagram' && !canSendExternal(active)
      ? 'Нет привязки Instagram Direct — только внутренние заметки.'
      : active.source === 'telegram' && !canSendExternal(active)
        ? tgPersonal?.connected
          ? 'У сделки нет Telegram username или числового chat id.'
          : 'Нет chat id, бот выключен или не подключён личный Telegram в профиле.'
        : active.source === 'instagram' && canSendExternal(active)
          ? 'Сообщение уйдёт клиенту в Instagram.'
          : active.source === 'telegram' && canSendExternal(active)
            ? 'Сообщение уйдёт в Telegram.'
            : active.source === 'site' ||
                active.source === 'manual' ||
                active.source === 'recommendation' ||
                active.source === 'vk'
              ? 'Внешний чат недоступен — сохраняются только внутренние заметки по сделке.'
              : '';

  const shellOuter =
    layout === 'page'
      ? 'rounded-none border-t border-gray-200/90 dark:border-[#333]'
      : 'rounded-none';

  const content = (
    <div
      className={`flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-gradient-to-b from-gray-50/95 to-white dark:from-[#1c1c1c] dark:to-[#252525] ${shellOuter}`}
    >
      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden">
        <aside className="flex w-full max-w-[100vw] shrink-0 flex-col border-r border-gray-200/80 dark:border-[#333] bg-white/50 dark:bg-[#1f1f1f]/80 sm:w-56 md:w-60 min-h-0">
          <div className="shrink-0 border-b border-gray-100 p-2 dark:border-[#333]">
            <div className="rounded-xl border border-gray-200/90 bg-white/90 p-1 dark:border-[#3a3a3a] dark:bg-[#262626]">
              <div className="flex flex-wrap gap-1">
              {filterTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setChannelFilter(t.id)}
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
                    channelFilter === t.id
                      ? 'bg-[#3337AD] text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#333]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-2">
            {threads.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                Нет лидов по фильтру. Сообщения из Instagram, Telegram и заявки с сайта появятся здесь.
              </p>
            ) : (
              <div className="space-y-0.5">
                {threads.map((d) => {
                  const selected = d.id === activeId;
                  const title = formatThreadTitle(d);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setActiveId(d.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                        selected
                          ? 'bg-[#3337AD] text-white shadow-md'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-[#2a2a2a]'
                      }`}
                    >
                      <SourceChannelAvatar source={d.source} selected={selected} titleHint={title} />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate font-medium ${selected ? '' : 'text-gray-900 dark:text-gray-100'}`}>{title}</span>
                        <span className={`mt-0.5 block truncate text-xs ${selected ? 'text-white/75' : 'text-gray-500 dark:text-gray-400'}`}>
                          {lastPreview(d)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-white/40 dark:bg-[#222]/50">
          {!active ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-[#333]">
                <MessageCircle size={28} />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Выберите диалог</p>
              <p className="mt-1 max-w-xs text-xs text-gray-500 dark:text-gray-400">
                Слева список лидов в том же стиле, что и чат с коллегами. Переписка и заметки откроются здесь.
              </p>
            </div>
          ) : (
            <>
              <div className="flex shrink-0 items-center gap-2 border-b border-gray-200/80 px-3 py-2 backdrop-blur-sm dark:border-[#333] dark:bg-[#252525]/80">
                <SourceChannelAvatar source={active.source} selected={false} titleHint={formatThreadTitle(active)} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">{formatThreadTitle(active)}</div>
                  <div className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                    {active.source === 'instagram' && 'Instagram Direct'}
                    {active.source === 'telegram' && 'Telegram'}
                    {active.source === 'site' && 'Заявка с сайта'}
                    {active.source &&
                      !['instagram', 'telegram', 'site'].includes(active.source) &&
                      (SOURCE_META[active.source]?.label || active.source)}
                    {funnelNameForDeal(active, salesFunnels) ? ` · ${funnelNameForDeal(active, salesFunnels)}` : ''}
                  </div>
                </div>
              </div>

              <div
                ref={scrollRef}
                className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4"
              >
                {sortedComments.length === 0 ? (
                  <div className="flex h-full min-h-[200px] flex-col items-center justify-center px-4 py-8 text-center">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-[#333]">
                      <MessageCircle size={28} className="text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Пока тихо</p>
                    <p className="mt-1 max-w-sm text-xs text-gray-500 dark:text-gray-400">
                      Когда придут сообщения из канала или вы добавите заметку, они появятся здесь так же, как в корпоративном чате.
                    </p>
                  </div>
                ) : (
                  sortedComments.map((c) => {
                    const mine = isMine(c);
                    const outgoing = c.type === 'instagram_out' || c.type === 'telegram_out';
                    return (
                      <div key={c.id} className={`max-w-[min(88%,520px)] ${mine ? 'ml-auto' : ''}`}>
                        <div
                          className={`rounded-2xl px-3 py-2 text-sm ${
                            mine
                              ? outgoing
                                ? 'bg-[#3337AD] text-white'
                                : 'bg-slate-600 text-white dark:bg-slate-700'
                              : 'border border-gray-200 bg-white text-gray-800 dark:border-[#404040] dark:bg-[#2a2a2a] dark:text-gray-200'
                          }`}
                        >
                          <div className={`mb-1 text-[11px] ${mine ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
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

              <div className="shrink-0 border-t border-gray-200/80 bg-white/90 px-2 pb-3 pt-2 dark:border-[#333] dark:bg-[#252525]/95 sm:px-3">
                {footerNotice ? (
                  <p
                    className={`mb-2 px-1 text-center text-[11px] leading-snug ${
                      active.source === 'instagram' && !canSendExternal(active)
                        ? 'text-amber-700 dark:text-amber-300/90'
                        : active.source === 'telegram' && !canSendExternal(active)
                          ? 'text-amber-700 dark:text-amber-300/90'
                          : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {footerNotice}
                  </p>
                ) : null}
                <div className="flex items-end gap-2">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      const el = e.target;
                      el.style.height = 'auto';
                      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder={inputHint(active)}
                    disabled={sending}
                    rows={1}
                    className="min-h-[44px] max-h-[120px] min-w-0 flex-1 resize-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm leading-relaxed text-gray-900 shadow-inner outline-none focus:border-[#3337AD]/50 focus:ring-2 focus:ring-[#3337AD]/30 dark:border-[#444] dark:bg-[#191919] dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={sending || !input.trim()}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#3337AD] text-white shadow-md transition-colors hover:bg-[#292b8a] disabled:cursor-not-allowed disabled:opacity-40"
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
    </div>
  );

  if (layout === 'embedded') {
    return content;
  }

  return (
    <PageLayout className="flex-1 min-h-0" contentClassName="flex flex-1 flex-col min-h-0 overflow-hidden p-0">
      {content}
    </PageLayout>
  );
};
