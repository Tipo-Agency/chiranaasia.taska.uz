/**
 * Выписки и сверка: список банковских выписок и строк.
 * Загрузка Excel и сверка по датам — в следующих итерациях (парсер в utils/bankStatementParser.ts).
 */
import React, { useEffect, useState } from 'react';
import { FileText, ChevronDown, ChevronRight, RefreshCw, Loader2 } from 'lucide-react';
import { financeEndpoint, type BankStatementApi } from '../../services/apiClient';

export const BankStatementsView: React.FC = () => {
  const [statements, setStatements] = useState<BankStatementApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await financeEndpoint.getBankStatements();
      setStatements(data);
    } catch {
      setStatements([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 p-4">
        <Loader2 size={18} className="animate-spin" />
        Загрузка выписок…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <FileText size={20} />
          Выписки и сверка
        </h3>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-[#252525] hover:bg-gray-200 dark:hover:bg-[#333] text-sm"
        >
          <RefreshCw size={14} />
          Обновить
        </button>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Список загруженных выписок. Загрузка Excel и сверка по датам будут добавлены (парсер — utils/bankStatementParser.ts).
      </p>
      {statements.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Выписок пока нет.</p>
      ) : (
        <div className="border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden">
          {statements.map((st) => (
            <div key={st.id} className="border-b border-gray-100 dark:border-[#333] last:border-b-0">
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === st.id ? null : st.id)}
                className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[#252525]"
              >
                {expandedId === st.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                <span className="font-medium text-gray-800 dark:text-white">{st.name || st.period || st.id}</span>
                <span className="text-sm text-gray-500">{st.createdAt}</span>
                {st.lines?.length != null && (
                  <span className="text-xs text-gray-400">({st.lines.length} строк)</span>
                )}
              </button>
              {expandedId === st.id && st.lines && st.lines.length > 0 && (
                <div className="bg-gray-50 dark:bg-[#252525] px-4 py-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 dark:text-gray-400">
                        <th className="pr-4 py-1">Дата</th>
                        <th className="pr-4 py-1">Описание</th>
                        <th className="pr-4 py-1">Тип</th>
                        <th className="py-1">Сумма</th>
                      </tr>
                    </thead>
                    <tbody>
                      {st.lines.map((line) => (
                        <tr key={line.id || line.lineDate + line.amount} className="border-t border-gray-200 dark:border-[#333]">
                          <td className="pr-4 py-1">{line.lineDate}</td>
                          <td className="pr-4 py-1 max-w-xs truncate">{line.description || '—'}</td>
                          <td className="pr-4 py-1">{line.lineType === 'in' ? 'Приход' : 'Расход'}</td>
                          <td className="py-1 font-mono">{line.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
