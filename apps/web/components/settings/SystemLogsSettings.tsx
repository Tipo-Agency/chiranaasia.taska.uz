/**
 * System logs (errors) viewer for Settings. Fetches GET /api/system/logs.
 */
import React, { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { systemEndpoint } from '../../services/apiClient';

export const SystemLogsSettings: React.FC = () => {
  const [logs, setLogs] = useState<Array<{ id: number; created_at: string; level: string; message: string; logger_name?: string; path?: string; request_id?: string; payload?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<string>('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await systemEndpoint.getLogs({ limit: 50, level: levelFilter || undefined });
      setLogs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки логов');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [levelFilter]);

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
          <AlertCircle size={20} className="text-amber-500" />
          Логи системы (ошибки и предупреждения)
        </h3>
        <div className="flex items-center gap-2">
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-[#333] bg-white dark:bg-[#252525] px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100"
          >
            <option value="">Все уровни</option>
            <option value="ERROR">ERROR</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="WARNING">WARNING</option>
          </select>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-[#252525] hover:bg-gray-200 dark:hover:bg-[#333] text-sm font-medium text-gray-700 dark:text-gray-200 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Обновить
          </button>
        </div>
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {loading && logs.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Загрузка…</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Записей нет.</p>
      ) : (
        <div className="border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden bg-white dark:bg-[#191919]">
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
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
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        log.level === 'CRITICAL' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200' :
                        log.level === 'ERROR' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200' :
                        'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'
                      }`}>
                        {log.level}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-800 dark:text-gray-200 max-w-md truncate" title={log.message}>{log.message}</td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs">{log.path || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
