import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Mail,
  RefreshCw,
  Send,
  User,
  XCircle,
} from 'lucide-react';
import { api } from '../../backend/api';
import type { TelegramBotInfo, TelegramBotUser, TelegramDeliveryStats } from '../../services/apiClient';

// ─── helpers ────────────────────────────────────────────────────────────────

function StatusBadge({ ok, label }: { ok: boolean | null; label: string }) {
  if (ok === null)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
        {label}
      </span>
    );
  return ok ? (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
      <CheckCircle2 size={12} />
      {label}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-red-500 dark:text-red-400 font-medium">
      <XCircle size={12} />
      {label}
    </span>
  );
}

function StatCell({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-xl font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-[11px] text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export const TelegramBotSettings: React.FC = () => {
  const [botInfo, setBotInfo] = useState<TelegramBotInfo | null>(null);
  const [stats, setStats] = useState<TelegramDeliveryStats | null>(null);
  const [users, setUsers] = useState<TelegramBotUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);

  // test message
  const [testChatId, setTestChatId] = useState('');
  const [testText, setTestText] = useState('Тестовое уведомление от Taska');
  const [testResult, setTestResult] = useState<{ ok: boolean; error: string | null } | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  // user telegram_user_id editing
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  // show/collapse connected users
  const [showOnlyConnected, setShowOnlyConnected] = useState(false);

  const loadBotInfo = useCallback(async () => {
    setLoading(true);
    try {
      const info = await api.telegramBot.getInfo();
      setBotInfo(info);
    } catch {
      setBotInfo({ configured: false, ok: false, bot_id: null, username: null, first_name: null, can_join_groups: null, error: 'Ошибка запроса' });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      setStats(await api.telegramBot.getStats());
    } catch {
      /* ignore */
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      setUsers(await api.telegramBot.getUsers());
    } catch {
      /* ignore */
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBotInfo();
    loadStats();
    loadUsers();
  }, [loadBotInfo, loadStats, loadUsers]);

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testChatId.trim()) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await api.telegramBot.sendTest(testChatId.trim(), testText);
      setTestResult(res);
    } catch {
      setTestResult({ ok: false, error: 'Ошибка запроса' });
    } finally {
      setTestLoading(false);
    }
  };

  const handleStartEdit = (user: TelegramBotUser) => {
    setEditingUserId(user.id);
    setEditingValue(user.telegram_user_id ?? '');
  };

  const handleSaveEdit = async (userId: string) => {
    setSavingUserId(userId);
    try {
      await api.telegramBot.setUserTelegramId(userId, editingValue.trim() || null);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, telegram_user_id: editingValue.trim() || null } : u
        )
      );
      setEditingUserId(null);
    } catch {
      /* ignore */
    } finally {
      setSavingUserId(null);
    }
  };

  const visibleUsers = showOnlyConnected
    ? users.filter((u) => u.telegram_user_id || u.telegram_chat_id)
    : users;

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* ── Bot Status ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center shrink-0">
              <Bot size={20} className="text-sky-500" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">Telegram Bot</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Токен из переменной окружения <code className="font-mono bg-gray-100 dark:bg-[#333] px-1 rounded">TELEGRAM_BOT_TOKEN</code>
              </div>
            </div>
          </div>
          <button
            onClick={loadBotInfo}
            disabled={loading}
            className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#333] disabled:opacity-40"
            title="Обновить"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <div className="col-span-full text-sm text-gray-400 dark:text-gray-500">Загрузка…</div>
          ) : botInfo ? (
            <>
              <div>
                <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Статус</div>
                <StatusBadge
                  ok={botInfo.configured ? botInfo.ok : false}
                  label={
                    !botInfo.configured
                      ? 'Не настроен'
                      : botInfo.ok
                      ? 'Подключён'
                      : 'Ошибка токена'
                  }
                />
              </div>
              <div>
                <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Бот</div>
                <span className="text-sm text-gray-800 dark:text-gray-200">
                  {botInfo.username ? (
                    <a
                      href={`https://t.me/${botInfo.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-600 dark:text-sky-400 hover:underline"
                    >
                      @{botInfo.username}
                    </a>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </span>
              </div>
              <div>
                <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Имя</div>
                <span className="text-sm text-gray-800 dark:text-gray-200">
                  {botInfo.first_name || <span className="text-gray-400">—</span>}
                </span>
              </div>
              <div>
                <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Группы</div>
                <span className="text-sm text-gray-800 dark:text-gray-200">
                  {botInfo.can_join_groups === true
                    ? 'бот может быть добавлен в группы'
                    : botInfo.can_join_groups === false
                      ? 'только личные чаты (политика BotFather)'
                      : '—'}
                </span>
              </div>
              {botInfo.error && (
                <div className="col-span-full flex items-center gap-2 text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40 rounded-xl px-3 py-2">
                  <AlertCircle size={13} className="shrink-0" />
                  {botInfo.error}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* ── Delivery Stats ─────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-sm font-bold text-gray-900 dark:text-white">Статистика доставок</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Текущее состояние очереди уведомлений.
            </div>
          </div>
          <button
            onClick={loadStats}
            disabled={statsLoading}
            className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#333] disabled:opacity-40"
            title="Обновить"
          >
            <RefreshCw size={14} className={statsLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {stats ? (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Send size={13} className="text-sky-500" />
                <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Telegram</span>
              </div>
              <div className="grid grid-cols-5 gap-2 bg-gray-50 dark:bg-[#1e1e1e] rounded-xl px-4 py-3">
                <StatCell value={stats.telegram_pending} label="Ожидает" color="text-amber-500" />
                <StatCell value={stats.telegram_sending} label="Отправляется" color="text-blue-500" />
                <StatCell value={stats.telegram_sent} label="Доставлено" color="text-emerald-500" />
                <StatCell value={stats.telegram_retry} label="Повтор" color="text-orange-500" />
                <StatCell value={stats.telegram_dead} label="Ошибка" color="text-red-500" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Mail size={13} className="text-violet-500" />
                <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Email</span>
              </div>
              <div className="grid grid-cols-3 gap-2 bg-gray-50 dark:bg-[#1e1e1e] rounded-xl px-4 py-3">
                <StatCell value={stats.email_pending} label="Ожидает" color="text-amber-500" />
                <StatCell value={stats.email_sent} label="Доставлено" color="text-emerald-500" />
                <StatCell value={stats.email_dead} label="Ошибка" color="text-red-500" />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-400 dark:text-gray-500">{statsLoading ? 'Загрузка…' : 'Нет данных'}</div>
        )}
      </div>

      {/* ── Test Message ───────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-4 sm:p-6">
        <div className="text-sm font-bold text-gray-900 dark:text-white mb-1">Тестовое сообщение</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-4 space-y-3 leading-relaxed">
          <p>
            Проверьте, что бот работает: укажите <strong>chat_id</strong> и нажмите «Отправить». В личке с ботом ваш id —
            положительное число; чтобы его увидеть, отправьте боту{' '}
            <code className="font-mono bg-gray-100 dark:bg-[#333] px-1 rounded">/start</code>.
          </p>
          <div className="rounded-xl border border-sky-200/80 dark:border-sky-800/50 bg-sky-50/60 dark:bg-sky-950/30 px-3 py-2.5">
            <div className="text-[11px] font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wide mb-1">Группы и супергруппы</div>
            <p className="text-gray-600 dark:text-gray-300">
              ID группы/супергруппы/канала обычно <strong>отрицательный</strong>, у супергрупп часто формат{' '}
              <code className="font-mono bg-white/80 dark:bg-[#252525] px-1 rounded">-100…</code> (как в подсказке поля).
              Добавьте бота в группу и при необходимости выдайте право отправлять сообщения, затем вставьте сюда{' '}
              <strong>chat_id группы</strong> — так проверяют рассылку в командный чат.
            </p>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Таблица «Пользователи» ниже — это <strong>личные</strong> Telegram ID сотрудников для пуш-уведомлений в личку, а не
              настройка «одной группы компании». Отдельного поля «группа организации» в системе пока нет; группу можно
              проверять только через тест сюда по chat_id.
            </p>
          </div>
        </div>
        <form onSubmit={handleTest} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Chat ID</div>
              <input
                required
                type="text"
                value={testChatId}
                onChange={(e) => setTestChatId(e.target.value)}
                placeholder="123456789 или -100123456789"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100 placeholder-gray-400"
              />
            </div>
            <div>
              <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Текст сообщения</div>
              <input
                type="text"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={testLoading || !testChatId.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              <Send size={14} />
              {testLoading ? 'Отправка…' : 'Отправить'}
            </button>
            {testResult && (
              <span
                className={`text-sm font-medium ${testResult.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}
              >
                {testResult.ok ? '✓ Доставлено' : `✕ ${testResult.error || 'Ошибка'}`}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* ── Users ──────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-[#333] flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-gray-900 dark:text-white">
              Пользователи
              {users.length > 0 && (
                <span className="ml-2 text-[11px] font-normal text-gray-400">
                  {users.filter((u) => u.telegram_user_id || u.telegram_chat_id).length} из {users.length} подключены
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Telegram ID нужен для личных push-уведомлений. Бот устанавливает его автоматически при /start, или можно задать вручную.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowOnlyConnected((v) => !v)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                showOnlyConnected
                  ? 'border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400'
                  : 'border-gray-200 dark:border-[#333] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#303030]'
              }`}
            >
              Только подключённые
            </button>
            <button
              onClick={loadUsers}
              disabled={usersLoading}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#333] disabled:opacity-40"
              title="Обновить"
            >
              <RefreshCw size={14} className={usersLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-[#2a2a2a]">
          {usersLoading && visibleUsers.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-400 dark:text-gray-500 text-center">Загрузка…</div>
          ) : visibleUsers.length === 0 ? (
            <div className="px-4 py-8 text-sm text-gray-400 dark:text-gray-500 text-center">
              {showOnlyConnected ? 'Нет подключённых пользователей' : 'Нет пользователей'}
            </div>
          ) : (
            visibleUsers.map((user) => {
              const isEditing = editingUserId === user.id;
              const isSaving = savingUserId === user.id;
              const isConnected = !!(user.telegram_user_id || user.telegram_chat_id);

              return (
                <div key={user.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${
                        isConnected
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                          : 'bg-gray-100 dark:bg-[#333] text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {user.name}
                        {user.telegram_username && (
                          <span className="ml-1.5 text-xs font-normal text-sky-500">@{user.telegram_username}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                        {user.login && <span>{user.login}</span>}
                        {user.login && user.email && <span className="mx-1">·</span>}
                        {user.email && <span>{user.email}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isEditing ? (
                      <>
                        <input
                          autoFocus
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(user.id);
                            if (e.key === 'Escape') setEditingUserId(null);
                          }}
                          placeholder="Telegram User ID"
                          className="w-40 border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1 text-xs bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100"
                        />
                        <button
                          onClick={() => handleSaveEdit(user.id)}
                          disabled={isSaving}
                          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 disabled:opacity-50"
                        >
                          {isSaving ? '…' : 'Сохранить'}
                        </button>
                        <button
                          onClick={() => setEditingUserId(null)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Отмена
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="text-right">
                          {user.telegram_user_id ? (
                            <div className="text-xs font-mono text-gray-700 dark:text-gray-300">
                              ID: {user.telegram_user_id}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400 dark:text-gray-500">Не подключён</div>
                          )}
                          {user.telegram_chat_id && (
                            <div className="text-[11px] font-mono text-gray-400 dark:text-gray-500">
                              chat: {user.telegram_chat_id}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleStartEdit(user)}
                          className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-gray-200 dark:border-[#444] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#303030] transition-colors"
                        >
                          {user.telegram_user_id ? 'Изменить' : 'Задать'}
                        </button>
                        {user.telegram_user_id && (
                          <button
                            onClick={() => {
                              setTestChatId(user.telegram_user_id!);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-gray-200 dark:border-[#444] text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
                            title="Заполнить Chat ID для теста"
                          >
                            Тест
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── How to connect ─────────────────────────────────────── */}
      <div className="bg-sky-50 dark:bg-sky-900/10 border border-sky-200 dark:border-sky-800/40 rounded-2xl p-4 sm:p-5">
        <div className="text-sm font-bold text-sky-800 dark:text-sky-300 mb-2">Как подключить пользователя?</div>
        <ol className="space-y-1.5 text-sm text-sky-700 dark:text-sky-400">
          <li className="flex gap-2"><span className="font-bold shrink-0">1.</span>Пользователь открывает бота в Telegram и отправляет <code className="font-mono bg-sky-100 dark:bg-sky-900/30 px-1 rounded">/start</code>. Бот автоматически привязывает Telegram ID.</li>
          <li className="flex gap-2"><span className="font-bold shrink-0">2.</span>Если пользователь не хочет использовать бота — вы можете вручную задать его Telegram User ID в таблице выше.</li>
          <li className="flex gap-2"><span className="font-bold shrink-0">3.</span>После привязки включите канал <strong>Telegram</strong> в настройках уведомлений пользователя.</li>
        </ol>
      </div>
    </div>
  );
};
