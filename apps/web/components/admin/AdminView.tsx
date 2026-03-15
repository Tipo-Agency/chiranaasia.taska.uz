/**
 * Admin panel: DB browser, errors, load/stats, run tests.
 * Only visible and accessible for users with role ADMIN (enforced by API).
 */
import React, { useEffect, useState } from 'react';
import {
  Database,
  AlertCircle,
  Activity,
  Play,
  RefreshCw,
  Loader2,
  Send,
} from 'lucide-react';
import { adminEndpoint, systemEndpoint } from '../../services/apiClient';

type TabId = 'db' | 'errors' | 'load' | 'tests' | 'bot';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'db', label: 'База данных', icon: <Database size={18} /> },
  { id: 'errors', label: 'Ошибки', icon: <AlertCircle size={18} /> },
  { id: 'load', label: 'Нагрузка', icon: <Activity size={18} /> },
  { id: 'tests', label: 'Тесты', icon: <Play size={18} /> },
  { id: 'bot', label: 'Telegram бот', icon: <Send size={18} /> },
];

export const AdminView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('db');
  const [authError, setAuthError] = useState<string | null>(null);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#191919] text-gray-900 dark:text-gray-100">
      <div className="border-b border-gray-200 dark:border-[#333] px-4 py-3">
        <h1 className="text-xl font-semibold">Админ-панель</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Просмотр таблиц БД, логов, метрик и запуск автотестов
        </p>
      </div>
      <div className="flex flex-1 min-h-0">
        <nav className="w-48 border-r border-gray-200 dark:border-[#333] p-2 flex flex-col gap-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id); setAuthError(null); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#3337AD] text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#252525]'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
        <main className="flex-1 overflow-auto p-4">
          {authError && (
            <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
              {authError}
              <p className="mt-2 text-xs opacity-80">
                Войдите под учётной записью с ролью Администратор (логин и пароль), чтобы открыть админ-панель.
              </p>
            </div>
          )}
          {activeTab === 'db' && <DbTab onAuthError={setAuthError} />}
          {activeTab === 'errors' && <ErrorsTab onAuthError={setAuthError} />}
          {activeTab === 'load' && <LoadTab onAuthError={setAuthError} />}
          {activeTab === 'tests' && <TestsTab onAuthError={setAuthError} />}
          {activeTab === 'bot' && <BotTab onAuthError={setAuthError} />}
        </main>
      </div>
    </div>
  );
};

function DbTab({ onAuthError }: { onAuthError: (msg: string) => void }) {
  const [tables, setTables] = useState<Array<{ name: string; row_count?: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<{ columns: string[]; rows: Record<string, unknown>[]; total: number } | null>(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const loadTables = async () => {
    setLoading(true);
    onAuthError(null);
    try {
      const data = await adminEndpoint.getTables();
      setTables(data);
      if (data.length && !selectedTable) setSelectedTable(data[0].name);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка загрузки';
      if (String(msg).includes('401') || String(msg).includes('403')) onAuthError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  useEffect(() => {
    if (!selectedTable) return;
    setTableLoading(true);
    adminEndpoint
      .getTableData(selectedTable, page * pageSize, pageSize)
      .then((res) => {
        setTableData({ columns: res.columns, rows: res.rows, total: res.total });
      })
      .catch((e) => {
        if (String(e).includes('401') || String(e).includes('403')) onAuthError(String(e));
      })
      .finally(() => setTableLoading(false));
  }, [selectedTable, page]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <Loader2 size={20} className="animate-spin" />
        Загрузка списка таблиц…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">Таблицы БД</h2>
        <button
          type="button"
          onClick={loadTables}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-[#252525] hover:bg-gray-200 dark:hover:bg-[#333] text-sm"
        >
          <RefreshCw size={14} />
          Обновить
        </button>
      </div>
      <div className="flex gap-4">
        <ul className="w-56 border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden bg-gray-50 dark:bg-[#252525] max-h-[60vh] overflow-y-auto">
          {tables.map((t) => (
            <li key={t.name}>
              <button
                type="button"
                onClick={() => { setSelectedTable(t.name); setPage(0); }}
                className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm ${
                  selectedTable === t.name ? 'bg-[#3337AD] text-white' : 'hover:bg-gray-200 dark:hover:bg-[#333]'
                }`}
              >
                <span className="truncate">{t.name}</span>
                {t.row_count != null && (
                  <span className="text-xs opacity-70 ml-1">{t.row_count}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex-1 min-w-0">
          {!selectedTable ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">Выберите таблицу</p>
          ) : tableLoading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 size={18} className="animate-spin" />
              Загрузка…
            </div>
          ) : tableData ? (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                {selectedTable} — всего записей: {tableData.total}
              </p>
              <div className="border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden overflow-x-auto max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-100 dark:bg-[#252525] border-b border-gray-200 dark:border-[#333]">
                    <tr>
                      {tableData.columns.map((col) => (
                        <th key={col} className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.rows.map((row, i) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#252525]">
                        {tableData.columns.map((col) => (
                          <td key={col} className="px-3 py-2 max-w-xs truncate" title={String(row[col] ?? '')}>
                            {row[col] != null ? String(row[col]) : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {tableData.total > pageSize && (
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1 rounded border border-gray-300 dark:border-[#444] disabled:opacity-50 text-sm"
                  >
                    Назад
                  </button>
                  <span className="text-sm text-gray-500">
                    {page * pageSize + 1}–{Math.min((page + 1) * pageSize, tableData.total)} из {tableData.total}
                  </span>
                  <button
                    type="button"
                    disabled={(page + 1) * pageSize >= tableData.total}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1 rounded border border-gray-300 dark:border-[#444] disabled:opacity-50 text-sm"
                  >
                    Вперёд
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ErrorsTab({ onAuthError }: { onAuthError: (msg: string) => void }) {
  const [logs, setLogs] = useState<Array<{ id: number; created_at: string; level: string; message: string; path?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await systemEndpoint.getLogs({ limit: 100, level: levelFilter || undefined });
      setLogs(data);
    } catch (e) {
      if (String(e).includes('401') || String(e).includes('403')) onAuthError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [levelFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-lg">Ошибки и предупреждения (system_logs)</h2>
        <div className="flex items-center gap-2">
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-[#333] bg-white dark:bg-[#252525] px-3 py-1.5 text-sm"
          >
            <option value="">Все уровни</option>
            <option value="ERROR">ERROR</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="WARNING">WARNING</option>
          </select>
          <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-[#252525] text-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Обновить
          </button>
        </div>
      </div>
      {loading && logs.length === 0 ? (
        <div className="flex items-center gap-2 text-gray-500"><Loader2 size={18} className="animate-spin" /> Загрузка…</div>
      ) : logs.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm">Записей нет.</p>
      ) : (
        <div className="border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 dark:bg-[#252525] border-b border-gray-200 dark:border-[#333]">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-400">Время</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-400">Уровень</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-400">Сообщение</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-400">Путь</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-100 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#252525]">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{log.created_at ? new Date(log.created_at).toLocaleString() : '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      log.level === 'CRITICAL' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200' :
                      log.level === 'ERROR' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200' :
                      'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'
                    }`}>
                      {log.level}
                    </span>
                  </td>
                  <td className="px-4 py-2 max-w-md truncate" title={log.message}>{log.message}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{log.path || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LoadTab({ onAuthError }: { onAuthError: (msg: string) => void }) {
  const [health, setHealth] = useState<{ status: string; db: string; db_error?: string; version?: string } | null>(null);
  const [stats, setStats] = useState<{ tables: Array<{ table_name: string; row_count: number }>; db_size_mb?: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [h, s] = await Promise.all([adminEndpoint.getHealth(), adminEndpoint.getStats()]);
      setHealth(h);
      setStats(s);
    } catch (e) {
      if (String(e).includes('401') || String(e).includes('403')) onAuthError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading && !health) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 size={18} className="animate-spin" />
        Загрузка…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">Нагрузка и состояние</h2>
        <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-[#252525] text-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Обновить
        </button>
      </div>
      {health && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-4 rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#252525]">
            <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Health</h3>
            <p className="text-sm">
              <span className="text-gray-500 dark:text-gray-400">Статус:</span>{' '}
              <span className={health.status === 'ok' ? 'text-green-600 dark:text-green-400' : 'text-red-600'}>{health.status}</span>
            </p>
            <p className="text-sm">
              <span className="text-gray-500 dark:text-gray-400">БД:</span>{' '}
              <span className={health.db === 'ok' ? 'text-green-600 dark:text-green-400' : 'text-red-600'}>{health.db}</span>
              {health.db_error && <span className="block text-red-600 dark:text-red-400 text-xs mt-1">{health.db_error}</span>}
            </p>
            {health.version && <p className="text-sm text-gray-500">Версия API: {health.version}</p>}
          </div>
          {stats && stats.db_size_mb != null && (
            <div className="p-4 rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#252525]">
              <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Размер БД</h3>
              <p className="text-2xl font-semibold text-[#3337AD]">{stats.db_size_mb} MB</p>
            </div>
          )}
        </div>
      )}
      {stats && stats.tables.length > 0 && (
        <div>
          <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Записей по таблицам</h3>
          <div className="border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#252525] border-b border-gray-200 dark:border-[#333]">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-400">Таблица</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600 dark:text-gray-400">Записей</th>
                </tr>
              </thead>
              <tbody>
                {stats.tables.map((t) => (
                  <tr key={t.table_name} className="border-b border-gray-100 dark:border-[#333]">
                    <td className="px-4 py-2">{t.table_name}</td>
                    <td className="px-4 py-2 text-right font-mono">{t.row_count >= 0 ? t.row_count : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TestsTab({ onAuthError }: { onAuthError: (msg: string) => void }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; output: string; exit_code: number } | null>(null);

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await adminEndpoint.runTests();
      setResult(res);
    } catch (e) {
      setResult({ ok: false, output: String(e), exit_code: 1 });
      if (String(e).includes('401') || String(e).includes('403')) onAuthError(String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">Автотесты (pytest)</h2>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3337AD] text-white font-medium disabled:opacity-50"
        >
          {running ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
          {running ? 'Запуск…' : 'Запустить тесты'}
        </button>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Запускаются тесты из <code className="bg-gray-100 dark:bg-[#252525] px-1 rounded">apps/api/tests</code> (smoke: health, auth, tasks, system/logs).
      </p>
      {result && (
        <div className={`p-4 rounded-xl border overflow-hidden ${result.ok ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'}`}>
          <p className="font-medium mb-2">
            {result.ok ? 'Все тесты прошли' : `Код выхода: ${result.exit_code}`}
          </p>
          <pre className="text-xs overflow-x-auto overflow-y-auto max-h-[50vh] whitespace-pre-wrap font-mono bg-black/5 dark:bg-black/20 p-3 rounded">
            {result.output || '(нет вывода)'}
          </pre>
        </div>
      )}
    </div>
  );
}

function BotTab({ onAuthError }: { onAuthError: (msg: string) => void }) {
  const [status, setStatus] = useState<{
    telegram_configured: boolean;
    group_chat_id?: string;
    group_chat_id_set: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<'daily' | 'deal' | 'congrats' | null>(null);
  const [lastResult, setLastResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    setLastResult(null);
    try {
      const data = await adminEndpoint.getBotStatus();
      setStatus(data);
    } catch (e) {
      if (String(e).includes('401') || String(e).includes('403')) onAuthError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const sendTest = async (type: 'daily' | 'deal' | 'congrats') => {
    setSending(type);
    setLastResult(null);
    try {
      const res =
        type === 'daily'
          ? await adminEndpoint.testBotDailySummary()
          : type === 'deal'
            ? await adminEndpoint.testBotNewDeal()
            : await adminEndpoint.testBotCongrats();
      setLastResult({ ok: res.ok, error: res.error });
    } catch (e) {
      setLastResult({ ok: false, error: String(e) });
    } finally {
      setSending(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <Loader2 size={20} className="animate-spin" />
        Загрузка…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="font-semibold text-lg">Управление Telegram ботом</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Ежедневная сводка (9:00 Ташкент), новые заявки и поздравления по сделкам отправляются в группу. Ниже — статус и тестовая отправка.
      </p>

      <div className="p-4 rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#252525] space-y-2">
        <h3 className="font-medium text-gray-700 dark:text-gray-300">Статус</h3>
        <p className="text-sm">
          Токен бота (API): {status?.telegram_configured ? (
            <span className="text-green-600 dark:text-green-400">настроен</span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">не задан (TELEGRAM_BOT_TOKEN на сервере)</span>
          )}
        </p>
        <p className="text-sm">
          Группа для сводки: {status?.group_chat_id_set ? (
            <span className="text-green-600 dark:text-green-400">ID задан</span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">не задана (указать в настройках уведомлений в приложении или в боте)</span>
          )}
          {status?.group_chat_id && (
            <span className="ml-2 text-xs text-gray-500 font-mono">{status.group_chat_id}</span>
          )}
        </p>
      </div>

      <div>
        <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Тестовая отправка в группу</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Отправить тестовые сообщения в групповой чат (как при реальной рассылке).
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => sendTest('daily')}
            disabled={sending !== null || !status?.telegram_configured || !status?.group_chat_id_set}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3337AD] text-white text-sm font-medium disabled:opacity-50"
          >
            {sending === 'daily' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Тест: ежедневная сводка
          </button>
          <button
            type="button"
            onClick={() => sendTest('deal')}
            disabled={sending !== null || !status?.telegram_configured || !status?.group_chat_id_set}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3337AD] text-white text-sm font-medium disabled:opacity-50"
          >
            {sending === 'deal' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Тест: новая заявка
          </button>
          <button
            type="button"
            onClick={() => sendTest('congrats')}
            disabled={sending !== null || !status?.telegram_configured || !status?.group_chat_id_set}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3337AD] text-white text-sm font-medium disabled:opacity-50"
          >
            {sending === 'congrats' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Тест: поздравление
          </button>
        </div>
        {lastResult && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${lastResult.ok ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
            {lastResult.ok ? 'Сообщение отправлено в группу.' : `Ошибка: ${lastResult.error}`}
          </div>
        )}
      </div>
    </div>
  );
}
