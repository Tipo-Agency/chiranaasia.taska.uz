import React, { useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react';
import { FileText, ChevronDown, ChevronRight, RefreshCw, Loader2, Plus } from 'lucide-react';
import { financeEndpoint, type BankStatementApi, type IncomeReportApi } from '../../services/apiClient';
import { DateInput, ModuleSegmentedControl } from '../ui';
import { TaskSelect } from '../TaskSelect';
import { dedupeBankStatementFlatLines, parseBankStatementFile } from '../../utils/bankStatementParser';

export interface BankStatementsViewHandle {
  triggerUpload: () => void;
}

export const BankStatementsView = forwardRef<BankStatementsViewHandle>(function BankStatementsView(_, ref) {
  const [tab, setTab] = useState<'balance' | 'income' | 'expense' | 'commission' | 'reconciliation' | 'income-reports'>('balance');
  const [statements, setStatements] = useState<BankStatementApi[]>([]);
  const [incomeReports, setIncomeReports] = useState<IncomeReportApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [department, setDepartment] = useState('all');
  const [reportIncome, setReportIncome] = useState('');
  const [reportCommission, setReportCommission] = useState('');
  const [reportPeriod, setReportPeriod] = useState(new Date().toISOString().slice(0, 7));
  const uploadRef = useRef<HTMLInputElement>(null);

  const isSaldoLine = (desc?: string) => {
    const d = String(desc ?? '').toLowerCase();
    return (
      d.includes('сальдо') ||
      d.includes('остаток') ||
      d.includes('начало дня') ||
      d.includes('конец дня') ||
      d.includes('входящее') ||
      d.includes('исходящее')
    );
  };

  const isCommissionLine = (desc?: string) => {
    const d = String(desc ?? '').toLowerCase();
    return (
      d.includes('комис') ||
      d.includes('обслужив') ||
      d.includes('тариф') ||
      d.includes('за документ') ||
      d.includes('съёмк') ||
      d.includes('съемк') ||
      d.includes('плата')
    );
  };

  useImperativeHandle(ref, () => ({
    triggerUpload: () => uploadRef.current?.click(),
  }));

  const load = async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        financeEndpoint.getBankStatements(),
        financeEndpoint.getIncomeReports(),
      ]);
      setStatements(s);
      setIncomeReports(r);
    } catch {
      setStatements([]);
      setIncomeReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const flatLines = useMemo(() => {
    const lines: Array<{ statementName: string; statementId: string; lineDate: string; description?: string; amount: number; lineType: 'in' | 'out' }> = [];
    statements.forEach((s) => {
      s.lines?.forEach((line) => {
        lines.push({
          statementName: s.name || s.period || s.id,
          statementId: s.id,
          lineDate: line.lineDate,
          description: line.description,
          amount: Number(line.amount || 0),
          lineType: line.lineType,
        });
      });
    });
    return dedupeBankStatementFlatLines(lines).sort((a, b) => a.lineDate.localeCompare(b.lineDate));
  }, [statements]);

  const filteredLines = useMemo(() => {
    return flatLines.filter((l) => {
      if (startDate && l.lineDate < startDate) return false;
      if (endDate && l.lineDate > endDate) return false;
      return true;
    });
  }, [flatLines, startDate, endDate]);

  const incomeLines = useMemo(() => filteredLines.filter((l) => l.lineType === 'in' && !isSaldoLine(l.description)), [filteredLines]);
  const expenseLines = useMemo(() => filteredLines.filter((l) => l.lineType === 'out' && !isSaldoLine(l.description)), [filteredLines]);
  const commissionLines = useMemo(() => expenseLines.filter((l) => isCommissionLine(l.description)), [expenseLines]);

  const totals = useMemo(() => {
    const income = incomeLines.reduce((s, l) => s + l.amount, 0);
    const expense = expenseLines.reduce((s, l) => s + l.amount, 0);
    const commission = commissionLines.reduce((s, l) => s + l.amount, 0);
    return { income, expense, commission, balance: income - expense };
  }, [incomeLines, expenseLines, commissionLines]);

  const salesIncomeByDay = useMemo(() => {
    const report = incomeReports.find((r) => r.period === reportPeriod);
    return report?.data || {};
  }, [incomeReports, reportPeriod]);

  const reconciliationRows = useMemo(() => {
    const byDayBank = new Map<string, number>();
    incomeLines
      .filter((l) => l.lineType === 'in')
      .forEach((l) => byDayBank.set(l.lineDate, (byDayBank.get(l.lineDate) || 0) + l.amount));
    const days = Array.from(new Set([...Object.keys(salesIncomeByDay), ...Array.from(byDayBank.keys())])).sort();
    return days.map((day) => {
      const sales = Number(salesIncomeByDay[day] || 0);
      const bank = Number(byDayBank.get(day) || 0);
      return { day, sales, bank, delta: bank - sales };
    });
  }, [incomeLines, salesIncomeByDay]);

  const reconciliationTotal = useMemo(() => reconciliationRows.reduce((s, r) => s + r.delta, 0), [reconciliationRows]);

  const handleUpload = async (file: File) => {
    const parsed = await parseBankStatementFile(file);
    const period = parsed.period || new Date().toISOString().slice(0, 7);
    const statementKeyName = parsed.name || file.name;
    const existing = statements.find((s) => s.period === period && (s.name === statementKeyName || s.period === period));
    const nextId = existing?.id ?? `st-${period}`;
    const createdAt = existing?.createdAt ?? new Date().toISOString();
    const next: BankStatementApi = {
      id: nextId,
      name: parsed.name || file.name,
      period,
      createdAt,
      lines: parsed.lines,
    };
    const rest = existing ? statements.filter((s) => s.id !== existing.id) : statements;
    await financeEndpoint.updateBankStatements([...rest, next]);
    await load();
  };

  const saveIncomeReport = async () => {
    const income = Number(reportIncome || 0);
    const commission = Number(reportCommission || 0);
    const net = income - commission;
    const day = new Date().toISOString().slice(0, 10);
    const existing = incomeReports.find((r) => r.period === reportPeriod);
    const nextReport: IncomeReportApi = existing
      ? { ...existing, data: { ...existing.data, [day]: net }, updatedAt: new Date().toISOString() }
      : { id: `inc-${Date.now()}`, period: reportPeriod, data: { [day]: net }, createdAt: new Date().toISOString() };
    const rest = incomeReports.filter((r) => r.id !== nextReport.id);
    await financeEndpoint.updateIncomeReports([...rest, nextReport]);
    setReportIncome('');
    setReportCommission('');
    await load();
  };

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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <ModuleSegmentedControl
          variant="neutral"
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
          options={[
            { value: 'balance', label: 'Баланс и движение' },
            { value: 'income', label: 'Поступления' },
            { value: 'expense', label: 'Расходы' },
            { value: 'commission', label: 'Комиссия' },
            { value: 'reconciliation', label: 'Сверка' },
            { value: 'income-reports', label: 'Справки о доходах' },
          ]}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 dark:bg-[#252525] hover:bg-gray-200 dark:hover:bg-[#333] text-sm"
          >
            <RefreshCw size={14} />
            Обновить
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <DateInput value={startDate} onChange={setStartDate} placeholder="Период: с" />
        <DateInput value={endDate} onChange={setEndDate} placeholder="Период: по" />
        <TaskSelect
          value={department}
          onChange={setDepartment}
          options={[
            { value: 'all', label: 'Подразделение: все' },
            { value: 'sales', label: 'Продажи' },
            { value: 'marketing', label: 'Маркетинг' },
            { value: 'operations', label: 'Операционный отдел' },
          ]}
        />
      </div>

      {tab === 'balance' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-200 dark:border-[#333] p-4 bg-white dark:bg-[#252525]">
              <p className="text-xs text-gray-500">Приход</p>
              <p className="text-lg font-semibold text-emerald-600">{totals.income.toLocaleString('ru-RU')} UZS</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-[#333] p-4 bg-white dark:bg-[#252525]">
              <p className="text-xs text-gray-500">Расход</p>
              <p className="text-lg font-semibold text-rose-600">{totals.expense.toLocaleString('ru-RU')} UZS</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-[#333] p-4 bg-white dark:bg-[#252525]">
              <p className="text-xs text-gray-500">Сальдо периода</p>
              <p className={`text-lg font-semibold ${totals.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {totals.balance.toLocaleString('ru-RU')} UZS
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-200 dark:border-[#333] p-4 bg-white dark:bg-[#252525] md:col-span-1">
              <p className="text-xs text-gray-500">Комиссия</p>
              <p className="text-lg font-semibold text-amber-600">{totals.commission.toLocaleString('ru-RU')} UZS</p>
            </div>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Итоги: строки «итого/сальдо» из выписки не входят в приход/расход; при загрузке нескольких выписок с пересекающимися операциями одинаковые строки учитываются один раз.
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
        </>
      )}

      {tab === 'income' && (
        <div className="border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#202020] text-xs text-gray-500">
            Поступления (без строк с сальдо)
          </div>
          <div className="px-4 py-2 text-sm flex justify-end bg-white dark:bg-[#252525] border-b border-gray-100 dark:border-[#333]">
            Итого: {totals.income.toLocaleString('ru-RU')} UZS
          </div>
          <div className="bg-gray-50 dark:bg-[#252525] px-4 py-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 dark:text-gray-400">
                  <th className="pr-4 py-1">Дата</th>
                  <th className="pr-4 py-1">Описание</th>
                  <th className="py-1">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {incomeLines.length === 0 ? (
                  <tr>
                    <td className="py-3 text-sm text-gray-500" colSpan={3}>
                      Нет данных за выбранный период
                    </td>
                  </tr>
                ) : (
                  incomeLines.map((l) => (
                    <tr key={l.statementId + '-' + l.lineDate + '-' + l.amount + '-' + (l.description || '').slice(0, 16)} className="border-t border-gray-200 dark:border-[#333]">
                      <td className="pr-4 py-1">{l.lineDate}</td>
                      <td className="pr-4 py-1 max-w-xs truncate">{l.description || '—'}</td>
                      <td className="py-1 font-mono">{l.amount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'expense' && (
        <div className="border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#202020] text-xs text-gray-500">
            Расходы (без строк с сальдо)
          </div>
          <div className="px-4 py-2 text-sm flex justify-end bg-white dark:bg-[#252525] border-b border-gray-100 dark:border-[#333]">
            Итого: {totals.expense.toLocaleString('ru-RU')} UZS
          </div>
          <div className="bg-gray-50 dark:bg-[#252525] px-4 py-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 dark:text-gray-400">
                  <th className="pr-4 py-1">Дата</th>
                  <th className="pr-4 py-1">Описание</th>
                  <th className="py-1">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {expenseLines.length === 0 ? (
                  <tr>
                    <td className="py-3 text-sm text-gray-500" colSpan={3}>
                      Нет данных за выбранный период
                    </td>
                  </tr>
                ) : (
                  expenseLines.map((l) => (
                    <tr key={l.statementId + '-' + l.lineDate + '-' + l.amount + '-' + (l.description || '').slice(0, 16)} className="border-t border-gray-200 dark:border-[#333]">
                      <td className="pr-4 py-1">{l.lineDate}</td>
                      <td className="pr-4 py-1 max-w-xs truncate">{l.description || '—'}</td>
                      <td className="py-1 font-mono">{l.amount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'commission' && (
        <div className="border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#202020] text-xs text-gray-500">
            Комиссия (выделяется по описанию)
          </div>
          <div className="px-4 py-2 text-sm flex justify-end bg-white dark:bg-[#252525] border-b border-gray-100 dark:border-[#333]">
            Итого: {totals.commission.toLocaleString('ru-RU')} UZS
          </div>
          <div className="bg-gray-50 dark:bg-[#252525] px-4 py-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 dark:text-gray-400">
                  <th className="pr-4 py-1">Дата</th>
                  <th className="pr-4 py-1">Описание</th>
                  <th className="py-1">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {commissionLines.length === 0 ? (
                  <tr>
                    <td className="py-3 text-sm text-gray-500" colSpan={3}>
                      Нет комиссий за выбранный период
                    </td>
                  </tr>
                ) : (
                  commissionLines.map((l) => (
                    <tr key={l.statementId + '-' + l.lineDate + '-' + l.amount + '-' + (l.description || '').slice(0, 16)} className="border-t border-gray-200 dark:border-[#333]">
                      <td className="pr-4 py-1">{l.lineDate}</td>
                      <td className="pr-4 py-1 max-w-xs truncate">{l.description || '—'}</td>
                      <td className="py-1 font-mono">{l.amount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'reconciliation' && (
        <div className="border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#202020] text-xs text-gray-500">
            Сверка подключений продаж и банковской выписки по дням. Положительное сальдо = по банку больше, отрицательное = недобор.
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 dark:text-gray-400">
                <th className="px-4 py-2">Дата</th>
                <th className="px-4 py-2">Продажи</th>
                <th className="px-4 py-2">Банк (приход)</th>
                <th className="px-4 py-2">Δ Сальдо</th>
              </tr>
            </thead>
            <tbody>
              {reconciliationRows.map((r) => (
                <tr key={r.day} className="border-t border-gray-200 dark:border-[#333]">
                  <td className="px-4 py-2">{r.day}</td>
                  <td className="px-4 py-2">{r.sales.toLocaleString('ru-RU')}</td>
                  <td className="px-4 py-2">{r.bank.toLocaleString('ru-RU')}</td>
                  <td className={`px-4 py-2 font-semibold ${r.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{r.delta.toLocaleString('ru-RU')}</td>
                </tr>
              ))}
              <tr className="border-t border-gray-300 dark:border-[#444] bg-gray-50 dark:bg-[#202020]">
                <td className="px-4 py-2 font-semibold">Итого</td>
                <td />
                <td />
                <td className={`px-4 py-2 font-semibold ${reconciliationTotal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {reconciliationTotal.toLocaleString('ru-RU')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === 'income-reports' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <TaskSelect
              value={reportPeriod}
              onChange={setReportPeriod}
              options={Array.from(new Set([new Date().toISOString().slice(0, 7), ...incomeReports.map((r) => r.period)]))
                .sort()
                .map((p) => ({ value: p, label: p }))}
            />
            <input
              value={reportIncome}
              onChange={(e) => setReportIncome(e.target.value)}
              placeholder="Поступило (UZS)"
              className="rounded-lg border border-gray-300 dark:border-[#333] bg-white dark:bg-[#252525] px-3 py-2 text-sm"
            />
            <input
              value={reportCommission}
              onChange={(e) => setReportCommission(e.target.value)}
              placeholder="Комиссия (UZS)"
              className="rounded-lg border border-gray-300 dark:border-[#333] bg-white dark:bg-[#252525] px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={saveIncomeReport}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 text-sm"
            >
              <Plus size={14} />
              Добавить справку
            </button>
          </div>
          <div className="border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#202020]">
                <tr className="text-left text-gray-600 dark:text-gray-400">
                  <th className="px-4 py-2">Дата</th>
                  <th className="px-4 py-2">Чистый доход (после комиссии)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(salesIncomeByDay)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([day, value]) => (
                    <tr key={day} className="border-t border-gray-200 dark:border-[#333]">
                      <td className="px-4 py-2">{day}</td>
                      <td className="px-4 py-2">{Number(value).toLocaleString('ru-RU')} UZS</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <input
        ref={uploadRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          await handleUpload(file);
          e.currentTarget.value = '';
        }}
      />
    </div>
  );
});
