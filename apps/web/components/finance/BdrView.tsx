/**
 * БДР — бюджет доходов и расходов.
 * Планирование по месяцам, кварталам или за год. Строки с произвольными названиями (доходы/расходы), суммы по периодам.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Bdr, BdrRow } from '../../types';
import { Trash2, Save, TrendingUp, TrendingDown, Check, Pencil } from 'lucide-react';
import { ModuleCreateIconButton } from '../ui/ModuleCreateIconButton';
import { TaskSelect } from '../TaskSelect';

const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

function getMonthsForYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

function getQuartersForYear(year: number): { key: string; label: string; months: string[] }[] {
  return [
    { key: 'Q1', label: 'Q1', months: [`${year}-01`, `${year}-02`, `${year}-03`] },
    { key: 'Q2', label: 'Q2', months: [`${year}-04`, `${year}-05`, `${year}-06`] },
    { key: 'Q3', label: 'Q3', months: [`${year}-07`, `${year}-08`, `${year}-09`] },
    { key: 'Q4', label: 'Q4', months: [`${year}-10`, `${year}-11`, `${year}-12`] },
  ];
}

interface BdrViewProps {
  bdr: Bdr | null;
  onLoadBdr: (year?: string) => Promise<void>;
  onSaveBdr: (payload: { year: string; rows: BdrRow[] }) => Promise<void>;
}

export const BdrView: React.FC<BdrViewProps> = ({ bdr, onLoadBdr, onSaveBdr }) => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [viewMode, setViewMode] = useState<'month' | 'quarter' | 'year'>('month');
  const [rows, setRows] = useState<BdrRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  /** ID строки в режиме редактирования; null — все в режиме просмотра */
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [savingRowId, setSavingRowId] = useState<string | null>(null);

  const yearStr = String(year);

  // Загружаем БДР только при смене года (не при каждом ре-рендере родителя, иначе onLoadBdr сбрасывает локальные добавленные строки)
  useEffect(() => {
    onLoadBdr(yearStr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearStr]);

  useEffect(() => {
    if (bdr && bdr.year === yearStr) {
      setRows(Array.isArray(bdr.rows) ? bdr.rows.map(r => ({
        id: r.id,
        name: r.name || '',
        type: (r.type === 'expense' ? 'expense' : 'income') as 'income' | 'expense',
        amounts: typeof r.amounts === 'object' && r.amounts !== null ? { ...r.amounts } : {},
      })) : []);
      setDirty(false);
      setEditingRowId(null);
    }
  }, [bdr, yearStr]);

  const periods = useMemo(() => {
    if (viewMode === 'month') {
      return getMonthsForYear(year).map(m => ({ key: m, label: MONTHS[parseInt(m.slice(5), 10) - 1], months: [m] }));
    }
    if (viewMode === 'quarter') {
      return getQuartersForYear(year);
    }
    return [{ key: 'year', label: 'Год', months: getMonthsForYear(year) }];
  }, [year, viewMode]);

  const updateRowAmount = (rowId: string, periodKey: string, value: number) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const next = { ...r, amounts: { ...r.amounts } };
      const period = periods.find(p => p.key === periodKey);
      const monthKeys = period?.months || [periodKey];
      const n = monthKeys.length || 1;
      monthKeys.forEach(m => { next.amounts[m] = Math.round((value / n) * 100) / 100; });
      return next;
    }));
    setDirty(true);
  };

  const getCellValue = (row: BdrRow, period: { months: string[] }): number => {
    const sum = period.months.reduce((s, m) => s + (row.amounts[m] ?? 0), 0);
    return Math.round(sum * 100) / 100;
  };

  const addRow = (type: 'income' | 'expense') => {
    const newRow: BdrRow = {
      id: `bdr-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: type === 'income' ? 'Новый доход' : 'Новый расход',
      type,
      amounts: {},
    };
    setRows(prev => [...prev, newRow]);
    setDirty(true);
    setEditingRowId(newRow.id);
  };

  const updateRowName = (rowId: string, name: string) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, name } : r));
    setDirty(true);
  };

  const removeRow = (rowId: string) => {
    setRows(prev => prev.filter(r => r.id !== rowId));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveBdr({ year: yearStr, rows });
      setDirty(false);
      setEditingRowId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRow = async (rowId: string) => {
    setSavingRowId(rowId);
    try {
      await onSaveBdr({ year: yearStr, rows });
      setDirty(false);
      setEditingRowId(null);
    } finally {
      setSavingRowId(null);
    }
  };

  const incomeRows = rows.filter(r => r.type === 'income');
  const expenseRows = rows.filter(r => r.type === 'expense');
  const totalIncomeByPeriod = (period: { months: string[] }) =>
    incomeRows.reduce((s, r) => s + getCellValue(r, period), 0);
  const totalExpenseByPeriod = (period: { months: string[] }) =>
    expenseRows.reduce((s, r) => s + getCellValue(r, period), 0);
  const profitByPeriod = (period: { months: string[] }) => totalIncomeByPeriod(period) - totalExpenseByPeriod(period);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Год:</label>
          <div className="w-36">
            <TaskSelect
              value={String(year)}
              onChange={(v) => setYear(parseInt(v, 10))}
              options={[currentYear - 1, currentYear, currentYear + 1].map((y) => ({ value: String(y), label: String(y) }))}
            />
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">|</span>
          <div className="flex rounded-lg border border-gray-200 dark:border-[#333] p-0.5 bg-gray-100 dark:bg-[#252525]">
            {(['month', 'quarter', 'year'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md ${viewMode === mode ? 'bg-white dark:bg-[#191919] shadow text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}
              >
                {mode === 'month' ? 'По месяцам' : mode === 'quarter' ? 'По кварталам' : 'За год'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="text-xs text-amber-600 dark:text-amber-400">Есть несохранённые изменения</span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3337AD] text-white text-sm font-medium disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-[#333]">
              <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300 w-48 min-w-[180px]">Статья</th>
              {periods.map(p => (
                <th key={p.key} className="text-right py-3 px-2 font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {p.label}
                </th>
              ))}
              <th className="w-20 text-center text-gray-500 dark:text-gray-400 font-normal text-xs">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-emerald-50/50 dark:bg-emerald-900/10 border-b border-gray-100 dark:border-[#2a2a2a]">
              <td className="py-2 px-3 font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <TrendingUp size={14} /> Доходы
              </td>
              {periods.map(p => (
                <td key={p.key} className="py-2 px-2 text-right text-gray-500 dark:text-gray-400">
                  {totalIncomeByPeriod(p).toLocaleString('ru-RU')}
                </td>
              ))}
              <td />
            </tr>
            {incomeRows.map(row => {
              const isEditing = editingRowId === row.id;
              const isSavingRow = savingRowId === row.id;
              return (
                <tr key={row.id} className="border-b border-gray-100 dark:border-[#2a2a2a] hover:bg-gray-50 dark:hover:bg-[#2a2a2a]">
                  <td className="py-1.5 px-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateRowName(row.id, e.target.value)}
                        className="w-full bg-gray-50 dark:bg-[#333] border border-gray-200 dark:border-[#444] rounded px-2 py-0.5 text-gray-900 dark:text-gray-100 text-sm"
                        placeholder="Название дохода"
                      />
                    ) : (
                      <span className="text-gray-900 dark:text-gray-100">{row.name || '—'}</span>
                    )}
                  </td>
                  {periods.map(period => (
                    <td key={period.key} className="py-1.5 px-2 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          value={getCellValue(row, period) || ''}
                          onChange={(e) => updateRowAmount(row.id, period.key, parseFloat(e.target.value) || 0)}
                          className="w-24 text-right bg-gray-50 dark:bg-[#333] border border-gray-200 dark:border-[#444] rounded px-2 py-1 text-gray-900 dark:text-gray-100 text-sm [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder="0"
                        />
                      ) : (
                        <span className="text-gray-700 dark:text-gray-300">{(getCellValue(row, period) || 0).toLocaleString('ru-RU')}</span>
                      )}
                    </td>
                  ))}
                  <td className="py-1.5 px-1 whitespace-nowrap">
                    {isEditing ? (
                      <>
                        <button type="button" onClick={() => handleSaveRow(row.id)} disabled={isSavingRow} className="p-1.5 text-[#3337AD] hover:bg-[#3337AD]/10 rounded" title="Сохранить"><Check size={16} /></button>
                        <button type="button" onClick={() => removeRow(row.id)} className="p-1 text-gray-400 hover:text-red-500" title="Удалить"><Trash2 size={14} /></button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => setEditingRowId(row.id)} className="p-1 text-gray-400 hover:text-[#3337AD]" title="Редактировать"><Pencil size={14} /></button>
                        <button type="button" onClick={() => removeRow(row.id)} className="p-1 text-gray-400 hover:text-red-500" title="Удалить"><Trash2 size={14} /></button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-rose-50/50 dark:bg-rose-900/10 border-b border-gray-100 dark:border-[#2a2a2a]">
              <td className="py-2 px-3 font-medium text-rose-700 dark:text-rose-400 flex items-center gap-1">
                <TrendingDown size={14} /> Расходы
              </td>
              {periods.map(p => (
                <td key={p.key} className="py-2 px-2 text-right text-gray-500 dark:text-gray-400">
                  {totalExpenseByPeriod(p).toLocaleString('ru-RU')}
                </td>
              ))}
              <td />
            </tr>
            {expenseRows.map(row => {
              const isEditing = editingRowId === row.id;
              const isSavingRow = savingRowId === row.id;
              return (
                <tr key={row.id} className="border-b border-gray-100 dark:border-[#2a2a2a] hover:bg-gray-50 dark:hover:bg-[#2a2a2a]">
                  <td className="py-1.5 px-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateRowName(row.id, e.target.value)}
                        className="w-full bg-gray-50 dark:bg-[#333] border border-gray-200 dark:border-[#444] rounded px-2 py-0.5 text-gray-900 dark:text-gray-100 text-sm"
                        placeholder="Название расхода"
                      />
                    ) : (
                      <span className="text-gray-900 dark:text-gray-100">{row.name || '—'}</span>
                    )}
                  </td>
                  {periods.map(period => (
                    <td key={period.key} className="py-1.5 px-2 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          value={getCellValue(row, period) || ''}
                          onChange={(e) => updateRowAmount(row.id, period.key, parseFloat(e.target.value) || 0)}
                          className="w-24 text-right bg-gray-50 dark:bg-[#333] border border-gray-200 dark:border-[#444] rounded px-2 py-1 text-gray-900 dark:text-gray-100 text-sm [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder="0"
                        />
                      ) : (
                        <span className="text-gray-700 dark:text-gray-300">{(getCellValue(row, period) || 0).toLocaleString('ru-RU')}</span>
                      )}
                    </td>
                  ))}
                  <td className="py-1.5 px-1 whitespace-nowrap">
                    {isEditing ? (
                      <>
                        <button type="button" onClick={() => handleSaveRow(row.id)} disabled={isSavingRow} className="p-1.5 text-[#3337AD] hover:bg-[#3337AD]/10 rounded" title="Сохранить"><Check size={16} /></button>
                        <button type="button" onClick={() => removeRow(row.id)} className="p-1 text-gray-400 hover:text-red-500" title="Удалить"><Trash2 size={14} /></button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => setEditingRowId(row.id)} className="p-1 text-gray-400 hover:text-[#3337AD]" title="Редактировать"><Pencil size={14} /></button>
                        <button type="button" onClick={() => removeRow(row.id)} className="p-1 text-gray-400 hover:text-red-500" title="Удалить"><Trash2 size={14} /></button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-indigo-50/60 dark:bg-indigo-900/20 border-t border-gray-200 dark:border-[#333]">
              <td className="py-2.5 px-3 font-semibold text-indigo-700 dark:text-indigo-300">Прибыль (Доходы - Расходы)</td>
              {periods.map((p) => {
                const val = profitByPeriod(p);
                return (
                  <td key={p.key} className={`py-2.5 px-2 text-right font-semibold ${val >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                    {val.toLocaleString('ru-RU')}
                  </td>
                );
              })}
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <ModuleCreateIconButton accent="emerald" label="Добавить доход" onClick={() => addRow('income')} />
        <ModuleCreateIconButton accent="rose" label="Добавить расход" onClick={() => addRow('expense')} />
      </div>
    </div>
  );
};
