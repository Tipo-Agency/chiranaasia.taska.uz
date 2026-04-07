import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import type { Department, User } from '../../types';
import { ModuleSegmentedControl } from '../ui';

type PayrollSubTab = 'timesheet' | 'conditions' | 'calc' | 'departments';

type PayrollKpiRule = {
  id: string;
  title: string;
  amount: number;
};

type PayrollUserConditions = {
  departmentId?: string;
  baseSalary: number; // оклад за месяц
  planDays: number; // норма дней в месяце
  kpiRules: PayrollKpiRule[];
};

type PayrollUserTimesheet = {
  workedDays: number;
};

type PayrollUserAdjustments = {
  bonus: number;
  deduction: number;
  advance: number;
  kpiAppliedIds: string[]; // какие KPI засчитаны в этом месяце
};

type PayrollMonthData = {
  byUserId: Record<
    string,
    {
      conditions?: PayrollUserConditions;
      timesheet?: PayrollUserTimesheet;
      adjustments?: PayrollUserAdjustments;
    }
  >;
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return (JSON.parse(raw) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function lsKey(kind: 'conditions' | 'month', period: string) {
  return `payroll:${kind}:${period}`;
}

function numberOr0(x: unknown): number {
  const n = typeof x === 'number' ? x : Number(x);
  return Number.isFinite(n) ? n : 0;
}

function clampInt(n: number, min: number, max: number) {
  const v = Math.round(numberOr0(n));
  return Math.max(min, Math.min(max, v));
}

export type PayrollViewHandle = {
  copyFromPrevMonth: () => void;
};

type PayrollViewProps = {
  users: User[];
  departments: Department[];
  initialPeriod: string; // yyyy-mm
  /** Период из родителя (шапка «Фильтры») */
  controlledPeriod?: { value: string; onChange: (v: string) => void };
  /** Скрыть месяц/копирование и горизонтальные вкладки — они в шапке; вкладки слева */
  hideTopChrome?: boolean;
};

export const PayrollView = forwardRef<PayrollViewHandle, PayrollViewProps>(function PayrollView(
  { users, departments, initialPeriod, controlledPeriod, hideTopChrome = false },
  ref
) {
  const staff = useMemo(() => users.filter((u) => !u.isArchived), [users]);
  const deptById = useMemo(() => {
    const entries = departments
      .filter((d) => !d.isArchived)
      .map((d) => [d.id, d] as const);
    return new Map<string, Department>(entries);
  }, [departments]);

  const deptList = useMemo(() => Array.from(deptById.values()) as Department[], [deptById]);

  const [subTab, setSubTab] = useState<PayrollSubTab>('calc');
  const [internalPeriod, setInternalPeriod] = useState(initialPeriod);
  useEffect(() => {
    if (!controlledPeriod) setInternalPeriod(initialPeriod);
  }, [initialPeriod, controlledPeriod]);

  const period = controlledPeriod?.value ?? internalPeriod;
  const setPeriod = useCallback(
    (v: string) => {
      if (controlledPeriod) controlledPeriod.onChange(v);
      else setInternalPeriod(v);
    },
    [controlledPeriod]
  );

  const [defaultConditionsByUserId, setDefaultConditionsByUserId] = useState<Record<string, PayrollUserConditions>>({});
  const [monthData, setMonthData] = useState<PayrollMonthData>({ byUserId: {} });

  useEffect(() => {
    setDefaultConditionsByUserId(safeParse(localStorage.getItem(lsKey('conditions', period)), {}));
    setMonthData(safeParse(localStorage.getItem(lsKey('month', period)), { byUserId: {} }));
  }, [period]);

  const persistConditions = (next: Record<string, PayrollUserConditions>) => {
    setDefaultConditionsByUserId(next);
    localStorage.setItem(lsKey('conditions', period), JSON.stringify(next));
  };

  const persistMonth = useCallback(
    (next: PayrollMonthData) => {
      setMonthData(next);
      localStorage.setItem(lsKey('month', period), JSON.stringify(next));
    },
    [period]
  );

  const getUserBundle = (userId: string) => monthData.byUserId[userId] || {};

  const getEffectiveConditions = (userId: string): PayrollUserConditions => {
    const fromMonth = getUserBundle(userId).conditions;
    const fromDefault = defaultConditionsByUserId[userId];
    const base: PayrollUserConditions = fromMonth || fromDefault || { baseSalary: 0, planDays: 22, kpiRules: [] };
    return {
      departmentId: base.departmentId,
      baseSalary: numberOr0(base.baseSalary),
      planDays: clampInt(base.planDays, 1, 31),
      kpiRules: Array.isArray(base.kpiRules) ? base.kpiRules.map((r) => ({ ...r, amount: numberOr0(r.amount) })) : [],
    };
  };

  const getTimesheet = (userId: string): PayrollUserTimesheet => {
    const t = getUserBundle(userId).timesheet || { workedDays: 0 };
    return { workedDays: clampInt(t.workedDays, 0, 31) };
  };

  const getAdjustments = (userId: string): PayrollUserAdjustments => {
    const a = getUserBundle(userId).adjustments || { bonus: 0, deduction: 0, advance: 0, kpiAppliedIds: [] };
    return {
      bonus: numberOr0(a.bonus),
      deduction: numberOr0(a.deduction),
      advance: numberOr0(a.advance),
      kpiAppliedIds: Array.isArray(a.kpiAppliedIds) ? a.kpiAppliedIds.map(String) : [],
    };
  };

  const compute = (userId: string) => {
    const c = getEffectiveConditions(userId);
    const t = getTimesheet(userId);
    const a = getAdjustments(userId);
    const ratio = c.planDays > 0 ? Math.min(1, t.workedDays / c.planDays) : 0;
    const baseAccrued = Math.round(c.baseSalary * ratio);
    const kpiAccrued = c.kpiRules
      .filter((r) => a.kpiAppliedIds.includes(r.id))
      .reduce((s, r) => s + numberOr0(r.amount), 0);
    const gross = baseAccrued + numberOr0(a.bonus) + kpiAccrued;
    const net = gross - numberOr0(a.deduction) - numberOr0(a.advance);
    return { baseAccrued, kpiAccrued, gross, net };
  };

  const updateMonthUser = (userId: string, patch: Partial<PayrollMonthData['byUserId'][string]>) => {
    persistMonth({
      byUserId: {
        ...monthData.byUserId,
        [userId]: { ...getUserBundle(userId), ...patch },
      },
    });
  };

  const copyFromPrevMonth = useCallback(() => {
    const [y, m] = period.split('-').map((x) => Number(x));
    if (!y || !m) return;
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
    const prevMonth = safeParse<PayrollMonthData>(localStorage.getItem(lsKey('month', prev)), { byUserId: {} });
    const next: PayrollMonthData = { byUserId: {} };
    staff.forEach((u) => {
      const p = prevMonth.byUserId[u.id] || {};
      next.byUserId[u.id] = {
        timesheet: p.timesheet,
        adjustments: p.adjustments,
      };
    });
    persistMonth(next);
    alert(`Скопировано из ${prev}`);
  }, [period, staff, persistMonth]);

  useImperativeHandle(ref, () => ({ copyFromPrevMonth }), [copyFromPrevMonth]);

  const tabs = useMemo(
    () => [
      { value: 'timesheet' as const, label: 'Табель' },
      { value: 'conditions' as const, label: 'Условия' },
      { value: 'calc' as const, label: 'Расчёт' },
      { value: 'departments' as const, label: 'Подразделения' },
    ],
    []
  );

  const totals = useMemo(() => {
    return staff.reduce(
      (acc, u) => {
        const c = getEffectiveConditions(u.id);
        const t = getTimesheet(u.id);
        const a = getAdjustments(u.id);
        const r = compute(u.id);
        acc.baseSalary += c.baseSalary;
        acc.workedDays += t.workedDays;
        acc.bonus += a.bonus;
        acc.deduction += a.deduction;
        acc.advance += a.advance;
        acc.net += r.net;
        return acc;
      },
      { baseSalary: 0, workedDays: 0, bonus: 0, deduction: 0, advance: 0, net: 0 }
    );
  }, [staff, monthData, defaultConditionsByUserId]);

  const totalsByDepartment = useMemo(() => {
    const map = new Map<string, { name: string; net: number; users: number }>();
    staff.forEach((u) => {
      const c = getEffectiveConditions(u.id);
      const depId = c.departmentId || '__none__';
      const name = depId === '__none__' ? 'Без подразделения' : deptById.get(depId)?.name || 'Подразделение';
      const row = map.get(depId) || { name, net: 0, users: 0 };
      const r = compute(u.id);
      row.net += r.net;
      row.users += 1;
      map.set(depId, row);
    });
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.net - a.net);
  }, [staff, monthData, defaultConditionsByUserId, deptById]);

  const tabNav = (
    <>
      {tabs.map((t) => {
        const on = subTab === t.value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => setSubTab(t.value)}
            className={`w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition-colors border ${
              on
                ? 'bg-white dark:bg-[#2a2a2a] border-gray-200 dark:border-[#444] text-gray-900 dark:text-white shadow-sm'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1f1f1f]'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </>
  );

  const tablesBlock = (
    <>
      {subTab === 'conditions' && (
        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#202020] text-xs text-gray-600 dark:text-gray-400">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Сотрудник</th>
                  <th className="text-left px-4 py-3 font-semibold">Подразделение</th>
                  <th className="text-right px-4 py-3 font-semibold">Оклад (мес.)</th>
                  <th className="text-right px-4 py-3 font-semibold">Норма дней</th>
                  <th className="text-left px-4 py-3 font-semibold">КПИ (правила)</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((u) => {
                  const c = getEffectiveConditions(u.id);
                  const saved = defaultConditionsByUserId[u.id] || { baseSalary: 0, planDays: 22, kpiRules: [] };
                  const deptId = c.departmentId || '';
                  return (
                    <tr key={u.id} className="border-t border-gray-100 dark:border-[#333]">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">{u.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{u.roleName || u.roleSlug || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={deptId}
                          onChange={(e) => {
                            const next = {
                              ...defaultConditionsByUserId,
                              [u.id]: { ...saved, departmentId: e.target.value || undefined },
                            };
                            persistConditions(next);
                          }}
                          className="h-9 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] pl-3 pr-9 text-sm text-gray-900 dark:text-gray-100 max-w-[240px]"
                        >
                          <option value="">Без подразделения</option>
                          {deptList.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={String(numberOr0(c.baseSalary))}
                          onChange={(e) => {
                            const next = {
                              ...defaultConditionsByUserId,
                              [u.id]: { ...saved, baseSalary: numberOr0(e.target.value) },
                            };
                            persistConditions(next);
                          }}
                          className="w-32 ml-auto block h-9 text-right rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-2 text-sm text-gray-900 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={String(clampInt(c.planDays, 1, 31))}
                          onChange={(e) => {
                            const next = {
                              ...defaultConditionsByUserId,
                              [u.id]: { ...saved, planDays: clampInt(Number(e.target.value || 0), 1, 31) },
                            };
                            persistConditions(next);
                          }}
                          className="w-24 ml-auto block h-9 text-right rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-2 text-sm text-gray-900 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {(c.kpiRules || []).map((r) => (
                            <span
                              key={r.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#1a1a1a] px-2 py-1 text-xs text-gray-700 dark:text-gray-200"
                              title={r.title}
                            >
                              {r.title}
                              <span className="text-gray-500 dark:text-gray-400">{numberOr0(r.amount).toLocaleString('ru-RU')}</span>
                            </span>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const title = prompt('Название KPI (например, Закрыл 10 сделок)')?.trim();
                              if (!title) return;
                              const amt = Number(prompt('Сумма начисления (UZS)') || '0');
                              const nextRule: PayrollKpiRule = { id: `kpi-${Date.now()}`, title, amount: numberOr0(amt) };
                              const next = {
                                ...defaultConditionsByUserId,
                                [u.id]: { ...saved, kpiRules: [...(saved.kpiRules || []), nextRule] },
                              };
                              persistConditions(next);
                            }}
                            className="h-8 px-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2a2a2a]"
                          >
                            + KPI
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'timesheet' && (
        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#202020] text-xs text-gray-600 dark:text-gray-400">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Сотрудник</th>
                  <th className="text-right px-4 py-3 font-semibold">Норма дней</th>
                  <th className="text-right px-4 py-3 font-semibold">Отработано</th>
                  <th className="text-right px-4 py-3 font-semibold">Доля</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((u) => {
                  const c = getEffectiveConditions(u.id);
                  const t = getTimesheet(u.id);
                  const ratio = c.planDays > 0 ? Math.min(1, t.workedDays / c.planDays) : 0;
                  return (
                    <tr key={u.id} className="border-t border-gray-100 dark:border-[#333]">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">{u.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{deptById.get(c.departmentId || '')?.name || 'Без подразделения'}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{c.planDays}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={String(t.workedDays)}
                          onChange={(e) => updateMonthUser(u.id, { timesheet: { workedDays: clampInt(Number(e.target.value || 0), 0, 31) } })}
                          className="w-24 ml-auto block h-9 text-right rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-2 text-sm text-gray-900 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-200">{(ratio * 100).toFixed(0)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'calc' && (
        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#202020] text-xs text-gray-600 dark:text-gray-400">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Сотрудник</th>
                  <th className="text-right px-4 py-3 font-semibold">Начислено (оклад)</th>
                  <th className="text-right px-4 py-3 font-semibold">KPI</th>
                  <th className="text-right px-4 py-3 font-semibold">Бонус</th>
                  <th className="text-right px-4 py-3 font-semibold">Штраф</th>
                  <th className="text-right px-4 py-3 font-semibold">Аванс</th>
                  <th className="text-right px-4 py-3 font-semibold">К выплате</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((u) => {
                  const a = getAdjustments(u.id);
                  const c = getEffectiveConditions(u.id);
                  const r = compute(u.id);
                  return (
                    <tr key={u.id} className="border-t border-gray-100 dark:border-[#333]">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">{u.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{deptById.get(c.departmentId || '')?.name || 'Без подразделения'}</div>
                        {c.kpiRules.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {c.kpiRules.map((k) => {
                              const on = a.kpiAppliedIds.includes(k.id);
                              return (
                                <button
                                  key={k.id}
                                  type="button"
                                  onClick={() => {
                                    const next = on
                                      ? a.kpiAppliedIds.filter((x) => x !== k.id)
                                      : [...a.kpiAppliedIds, k.id];
                                    updateMonthUser(u.id, { adjustments: { ...a, kpiAppliedIds: next } });
                                  }}
                                  className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                                    on
                                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900/20 dark:border-white/10'
                                      : 'bg-white dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-200 border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#2a2a2a]'
                                  }`}
                                  title={`${k.title}: ${numberOr0(k.amount).toLocaleString('ru-RU')}`}
                                >
                                  {k.title}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{r.baseAccrued.toLocaleString('ru-RU')}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{r.kpiAccrued.toLocaleString('ru-RU')}</td>
                      {(['bonus', 'deduction', 'advance'] as const).map((k) => (
                        <td key={k} className="px-4 py-3">
                          <input
                            type="number"
                            value={String(a[k])}
                            onChange={(e) => updateMonthUser(u.id, { adjustments: { ...a, [k]: numberOr0(e.target.value) } })}
                            className="w-28 ml-auto block h-9 text-right rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-2 text-sm text-gray-900 dark:text-gray-100"
                          />
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">{r.net.toLocaleString('ru-RU')}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-[#202020] border-t border-gray-200 dark:border-[#333]">
                <tr className="text-sm">
                  <td className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Итого</td>
                  <td className="px-4 py-3 text-right font-semibold">{totals.baseSalary.toLocaleString('ru-RU')}</td>
                  <td className="px-4 py-3 text-right font-semibold">—</td>
                  <td className="px-4 py-3 text-right font-semibold">{totals.bonus.toLocaleString('ru-RU')}</td>
                  <td className="px-4 py-3 text-right font-semibold">{totals.deduction.toLocaleString('ru-RU')}</td>
                  <td className="px-4 py-3 text-right font-semibold">{totals.advance.toLocaleString('ru-RU')}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">{totals.net.toLocaleString('ru-RU')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {subTab === 'departments' && (
        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-4">
          <div className="text-sm font-semibold text-gray-900 dark:text-white">ЗП по подразделениям</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Сумма “к выплате” по всем сотрудникам в подразделении.</div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {totalsByDepartment.map((d) => (
              <div key={d.id} className="rounded-2xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#1a1a1a] p-4">
                <div className="text-xs text-gray-500 dark:text-gray-400">{d.users} чел.</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{d.name}</div>
                <div className="mt-2 text-lg font-bold text-gray-900 dark:text-white">{Math.round(d.net).toLocaleString('ru-RU')} UZS</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );

  if (hideTopChrome) {
    return (
      <div className="flex flex-col lg:flex-row gap-4 items-start min-h-0 flex-1 w-full">
        <nav
          className="w-full lg:w-44 shrink-0 flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0 -mx-1 px-1 lg:mx-0 lg:px-0"
          aria-label="Разделы ЗП"
        >
          {tabNav}
        </nav>
        <div className="flex-1 min-w-0 space-y-3 w-full">{tablesBlock}</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Месяц</label>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="h-9 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-3 text-sm text-gray-900 dark:text-gray-100"
            />
            <button
              type="button"
              onClick={copyFromPrevMonth}
              className="h-9 px-3 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2a2a2a]"
              title="Скопировать табель и начисления из прошлого месяца"
            >
              Копировать месяц
            </button>
          </div>
        </div>
        <div className="mt-3">
          <ModuleSegmentedControl<PayrollSubTab>
            size="sm"
            variant="neutral"
            value={subTab}
            onChange={(v) => setSubTab(v as PayrollSubTab)}
            options={tabs}
          />
        </div>
      </div>
      {tablesBlock}
    </div>
  );
});

