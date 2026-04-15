import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { FinancialPlanning, PurchaseRequest } from '../../types';
import { financeEndpoint } from '../../services/apiClient';
import { Loader2, Link2, Save } from 'lucide-react';

export interface FpExpenseLine {
  id: string;
  lineDate: string;
  amount: number;
  description?: string;
  statementName: string;
}

export interface FinanceReconciliationGroup {
  id: string;
  lineIds: string[];
  requestId: string | null;
  manualResolved: boolean;
}

function parseReqAmountUzs(r: PurchaseRequest): number {
  const s = String(r.amount ?? '0').replace(/\s/g, '').replace(/,/g, '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function approvedFpRequestIds(plannings: FinancialPlanning[]): Set<string> {
  const ids = new Set<string>();
  for (const p of plannings) {
    if (p.isArchived || p.status !== 'approved') continue;
    for (const rid of p.requestIds || []) {
      if (rid) ids.add(String(rid));
    }
  }
  return ids;
}

export function FpExpenseVerificationTab({
  expenseLines,
  requests,
  plannings,
  onRefreshRequests,
}: {
  expenseLines: FpExpenseLine[];
  requests: PurchaseRequest[];
  plannings: FinancialPlanning[];
  onRefreshRequests?: () => void;
}) {
  const [groups, setGroups] = useState<FinanceReconciliationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [linkRequestId, setLinkRequestId] = useState('');

  const fpIds = useMemo(() => approvedFpRequestIds(plannings), [plannings]);

  const fpRequests = useMemo(() => {
    return requests.filter(
      (r) =>
        !r.isArchived &&
        fpIds.has(r.id) &&
        (r.status === 'approved' || r.status === 'paid')
    );
  }, [requests, fpIds]);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await financeEndpoint.getExpenseReconciliationGroups();
      setGroups(
        (raw as FinanceReconciliationGroup[]).map((g) => ({
          id: g.id,
          lineIds: [...(g.lineIds || [])],
          requestId: g.requestId ?? null,
          manualResolved: Boolean(g.manualResolved),
        }))
      );
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const lineById = useMemo(() => new Map(expenseLines.map((l) => [l.id, l])), [expenseLines]);

  const linesInGroups = useMemo(() => {
    const s = new Set<string>();
    for (const g of groups) for (const id of g.lineIds) s.add(id);
    return s;
  }, [groups]);

  const groupSum = (g: FinanceReconciliationGroup) =>
    g.lineIds.reduce((acc, lid) => acc + (lineById.get(lid)?.amount || 0), 0);

  const requestRowMeta = useMemo(() => {
    return fpRequests.map((req) => {
      const gs = groups.filter((g) => g.requestId === req.id);
      const sum = gs.reduce((a, g) => a + groupSum(g), 0);
      const expected = parseReqAmountUzs(req);
      const delta = sum - expected;
      const tight = Math.abs(delta) < 0.01;
      const anyManual = gs.some((g) => g.manualResolved);
      const paidAuto = req.status === 'paid' && gs.length === 0 && sum < 0.01;
      let tone: 'ok' | 'warn' | 'bad' = 'ok';
      if (anyManual && tight) tone = 'warn';
      else if (!tight && req.status === 'approved') tone = 'bad';
      else if (tight || paidAuto) tone = 'ok';
      return { req, gs, sum, expected, delta, tight, anyManual, paidAuto, tone };
    });
  }, [fpRequests, groups, lineById]);

  const toggleLine = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLinkToRequest = () => {
    if (!linkRequestId || selected.size === 0) return;
    const gid = `frg-${Date.now()}`;
    setGroups((prev) => [
      ...prev,
      {
        id: gid,
        lineIds: Array.from(selected),
        requestId: linkRequestId,
        manualResolved: true,
      },
    ]);
    setSelected(new Set());
    setLinkRequestId('');
  };

  const handleSaveGroups = async () => {
    setSaving(true);
    try {
      await financeEndpoint.updateExpenseReconciliationGroups(groups);
      onRefreshRequests?.();
    } finally {
      setSaving(false);
    }
  };

  const rowToneClass = (tone: 'ok' | 'warn' | 'bad') => {
    if (tone === 'bad') return 'bg-red-50/80 dark:bg-red-950/25 border-red-200 dark:border-red-900/50';
    if (tone === 'warn') return 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40';
    return 'bg-white dark:bg-[#252525] border-gray-200 dark:border-[#333]';
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 p-4">
        <Loader2 size={18} className="animate-spin" />
        Загрузка групп сверки…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-3xl">
        Сопоставление расходов по выписке (без комиссий) с заявками из <strong>утверждённого</strong> бюджета.
        После загрузки выписки заявки с совпадением суммы (и при указании — ИНН и дата счёта в назначении) могут автоматически
        перейти в «Оплачено». Здесь можно объединить несколько строк выписки с одной заявкой (частичные платежи) и отметить
        ручную сверку.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">Выберите строки выписки →</span>
        <select
          value={linkRequestId}
          onChange={(e) => setLinkRequestId(e.target.value)}
          className="rounded-lg border border-gray-200 dark:border-[#444] bg-white dark:bg-[#252525] text-sm px-2 py-1.5 min-w-[200px]"
        >
          <option value="">Заявка для привязки…</option>
          {fpRequests.map((r) => (
            <option key={r.id} value={r.id}>
              {(r.title || r.id).slice(0, 60)} — {parseReqAmountUzs(r).toLocaleString('ru-RU')} UZS
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!linkRequestId || selected.size === 0}
          onClick={handleLinkToRequest}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-40"
        >
          <Link2 size={16} />
          Привязать выбранные
        </button>
        <button
          type="button"
          onClick={() => void handleSaveGroups()}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-[#555] text-sm font-medium"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Сохранить группы
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-[#333] overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-[#202020] text-xs text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-3 py-2">Заявка</th>
              <th className="px-3 py-2 text-right">По заявке</th>
              <th className="px-3 py-2 text-right">По выписке</th>
              <th className="px-3 py-2 text-right">Δ</th>
              <th className="px-3 py-2">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
            {requestRowMeta.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400 text-xs">
                  Нет заявок в утверждённом бюджете (или все исключены).
                </td>
              </tr>
            ) : (
              requestRowMeta.map(({ req, sum, expected, delta, tight, anyManual, paidAuto, tone }) => (
                <tr key={req.id} className={`border-l-4 ${tone === 'bad' ? 'border-l-red-500' : tone === 'warn' ? 'border-l-amber-500' : 'border-l-emerald-500'}`}>
                  <td className={`px-3 py-2 ${rowToneClass(tone)}`}>
                    <div className="font-medium text-gray-900 dark:text-white">{req.title || req.id}</div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400">
                      {req.counterpartyInn && <>ИНН {req.counterpartyInn} · </>}
                      {req.invoiceNumber && <>№ {req.invoiceNumber} · </>}
                      {req.invoiceDate && <>от {req.invoiceDate}</>}
                    </div>
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${rowToneClass(tone)}`}>{expected.toLocaleString('ru-RU')}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${rowToneClass(tone)}`}>
                    {sum > 0 ? sum.toLocaleString('ru-RU') : paidAuto ? '—' : '0'}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${rowToneClass(tone)}`}>
                    {sum > 0 || !paidAuto ? delta.toLocaleString('ru-RU') : '—'}
                  </td>
                  <td className={`px-3 py-2 text-xs ${rowToneClass(tone)}`}>
                    {tight || paidAuto ? (
                      <span className="text-emerald-600 dark:text-emerald-400">Сходится</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">Расхождение</span>
                    )}
                    {anyManual && tight && (
                      <span className="block text-amber-700 dark:text-amber-300">Ручная группировка</span>
                    )}
                    {paidAuto && <span className="block text-gray-500">Оплачено автоматически</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h4 className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase mb-2">Расходы выписки (для выбора)</h4>
        <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-200 dark:border-[#333] divide-y divide-gray-100 dark:divide-[#333]">
          {expenseLines.length === 0 ? (
            <div className="p-4 text-xs text-gray-500">Нет строк расходов в выбранном периоде.</div>
          ) : (
            expenseLines.map((l) => (
              <label
                key={l.id}
                className={`flex items-start gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2a2a2a] ${
                  linesInGroups.has(l.id) ? 'opacity-60' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(l.id)}
                  disabled={linesInGroups.has(l.id)}
                  onChange={() => toggleLine(l.id)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-gray-900 dark:text-gray-100">{l.lineDate}</div>
                  <div className="text-gray-600 dark:text-gray-400 line-clamp-2">{l.description || '—'}</div>
                  <div className="text-[10px] text-gray-400">{l.statementName}</div>
                </div>
                <div className="font-semibold tabular-nums text-gray-900 dark:text-white">{l.amount.toLocaleString('ru-RU')}</div>
              </label>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
