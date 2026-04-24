import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProductionRouteOrder, ProductionRoutePipeline, ProductionRouteStage, User } from '../../types';
import { GitBranch, RefreshCw } from 'lucide-react';

function sortedStages(p: ProductionRoutePipeline | undefined): ProductionRouteStage[] {
  if (!p?.stages?.length) return [];
  return [...p.stages].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

function stageLabel(stages: ProductionRouteStage[], id: string): string {
  return stages.find((s) => s.id === id)?.label || id;
}

export function ProductionRouteBoard({
  pipelines,
  orders,
  users,
  currentUser,
  onRefresh,
  onCreateOrder,
  onHandOver,
  onResolveHandoff,
  onComplete,
  pollMs = 12000,
}: {
  pipelines: ProductionRoutePipeline[];
  orders: ProductionRouteOrder[];
  users: User[];
  currentUser: User;
  onRefresh: () => Promise<void>;
  onCreateOrder: (pipelineId: string, title: string) => Promise<void>;
  onHandOver: (orderId: string, notes?: string) => Promise<void>;
  onResolveHandoff: (
    handoffId: string,
    payload: { action: 'accept' | 'reject'; hasDefects?: boolean; defectNotes?: string | null }
  ) => Promise<void>;
  onComplete: (orderId: string) => Promise<void>;
  pollMs?: number;
}) {
  const [pipelineId, setPipelineId] = useState<string>(() => pipelines[0]?.id || '');
  const [busy, setBusy] = useState(false);
  // Keep a stable ref so the polling interval doesn't restart on every parent re-render
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);
  const [newTitle, setNewTitle] = useState('');
  const [resolveOpen, setResolveOpen] = useState<{
    handoffId: string;
    orderTitle: string;
    toStageLabel: string;
  } | null>(null);
  const [hasDefects, setHasDefects] = useState(false);
  const [defectNotes, setDefectNotes] = useState('');

  useEffect(() => {
    if (pipelineId || !pipelines[0]?.id) return;
    setPipelineId(pipelines[0].id);
  }, [pipelines, pipelineId]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        await onRefreshRef.current();
      } catch {
        /* ignore */
      }
    };
    const id = window.setInterval(tick, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pollMs]); // only recreate interval when poll interval changes, not on every onRefresh identity change

  const pipeline = useMemo(() => pipelines.find((p) => p.id === pipelineId), [pipelines, pipelineId]);
  const stages = useMemo(() => sortedStages(pipeline), [pipeline]);

  const ordersForPipeline = useMemo(
    () => orders.filter((o) => o.pipelineId === pipelineId && !o.isArchived),
    [orders, pipelineId]
  );

  const activeOrders = useMemo(() => ordersForPipeline.filter((o) => o.status === 'open'), [ordersForPipeline]);
  const doneOrders = useMemo(() => ordersForPipeline.filter((o) => o.status === 'done'), [ordersForPipeline]);

  const userName = useCallback(
    (id: string | null | undefined) => {
      if (!id) return '—';
      return users.find((u) => u.id === id)?.name || id.slice(0, 8);
    },
    [users]
  );

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const isLastStage = (stageId: string) => {
    if (!stages.length) return false;
    return stages[stages.length - 1].id === stageId;
  };

  const openResolve = (o: ProductionRouteOrder) => {
    const ph = o.pendingHandoff;
    if (!ph) return;
    setHasDefects(false);
    setDefectNotes('');
    setResolveOpen({
      handoffId: ph.id,
      orderTitle: o.title,
      toStageLabel: stageLabel(stages, ph.toStageId),
    });
  };

  if (!pipelines.length) {
    return (
      <div className="rounded-2xl border border-dashed border-amber-300/60 dark:border-amber-700/50 bg-amber-50/40 dark:bg-amber-950/20 p-6 text-sm text-gray-700 dark:text-gray-300">
        <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-white mb-2">
          <GitBranch size={18} className="text-amber-600" />
          Нет производственных маршрутов
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Создайте маршрут в <strong>Настройки → Производственные маршруты</strong> (этапы слева направо и ответственные по этапам).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-gray-500 dark:text-gray-400">Маршрут</label>
          <select
            value={pipelineId}
            onChange={(e) => setPipelineId(e.target.value)}
            className="text-sm rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-3 py-1.5 min-w-[200px]"
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(onRefresh)}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#2a2a2a] disabled:opacity-50"
            title="Обновить сейчас"
          >
            <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
            Обновить
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Название заказа…"
            className="text-sm rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-3 py-1.5 w-52"
          />
          <button
            type="button"
            disabled={busy || !newTitle.trim() || !pipelineId}
            onClick={() =>
              run(async () => {
                await onCreateOrder(pipelineId, newTitle.trim());
                setNewTitle('');
              })
            }
            className="text-sm px-3 py-1.5 rounded-lg bg-amber-600 text-white font-medium disabled:opacity-50"
          >
            Новый заказ
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400">
        Обновление каждые {Math.round(pollMs / 1000)} с · Вышли: {currentUser.name}
      </div>

      <div className="overflow-x-auto pb-2 -mx-1 px-1">
        <div className="flex gap-3 min-w-min">
          {stages.map((st) => (
            <div
              key={st.id}
              className={`shrink-0 w-[260px] rounded-2xl border border-gray-200 dark:border-[#333] overflow-hidden ${st.color || 'bg-gray-100 dark:bg-[#1e1e1e]'}`}
            >
              <div className="px-3 py-2 border-b border-black/5 dark:border-white/10 bg-white/60 dark:bg-black/20">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{st.label}</div>
                <div className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">
                  Ответственный: {userName(st.defaultAssigneeUserId)}
                </div>
              </div>
              <div className="p-2 space-y-2 min-h-[120px] max-h-[70vh] overflow-y-auto custom-scrollbar">
                {activeOrders
                  .filter((o) => o.currentStageId === st.id)
                  .map((o) => (
                    <div
                      key={o.id}
                      className="rounded-xl bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] p-3 shadow-sm"
                    >
                      <div className="font-medium text-sm text-gray-900 dark:text-white">{o.title}</div>
                      {o.notes ? <div className="text-xs text-gray-500 mt-1 line-clamp-2">{o.notes}</div> : null}
                      {o.pendingHandoff && o.pendingHandoff.status === 'pending_accept' ? (
                        <div className="mt-2 text-[11px] rounded-lg bg-amber-100/80 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 px-2 py-1.5">
                          Ожидает приёмки на «{stageLabel(stages, o.pendingHandoff.toStageId)}» · Сдал:{' '}
                          {userName(o.pendingHandoff.handedOverByUserId)}
                        </div>
                      ) : null}
                      <div className="mt-2 flex flex-col gap-1.5">
                        {o.pendingHandoff && o.pendingHandoff.status === 'pending_accept' ? (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              className="text-xs py-1.5 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50"
                              onClick={() => openResolve(o)}
                            >
                              Принять / отклонить приёмку
                            </button>
                          </>
                        ) : (
                          <>
                            {!isLastStage(st.id) ? (
                              <button
                                type="button"
                                disabled={busy}
                                className="text-xs py-1.5 rounded-lg bg-amber-600 text-white font-medium disabled:opacity-50"
                                onClick={() => run(() => onHandOver(o.id))}
                              >
                                Передать на следующий этап
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={busy}
                                className="text-xs py-1.5 rounded-lg bg-slate-700 text-white font-medium disabled:opacity-50"
                                onClick={() => run(() => onComplete(o.id))}
                              >
                                Завершить заказ
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {doneOrders.length > 0 && (
        <div className="rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] p-4">
          <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">Завершённые по этому маршруту</div>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            {doneOrders.map((o) => (
              <li key={o.id}>
                ✓ {o.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {resolveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal>
          <div className="bg-white dark:bg-[#252525] rounded-2xl border border-gray-200 dark:border-[#333] max-w-md w-full p-5 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Приёмка: {resolveOpen.orderTitle}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Этап приёмки: «{resolveOpen.toStageLabel}»</p>
            <label className="flex items-center gap-2 mt-4 text-sm text-gray-800 dark:text-gray-200">
              <input type="checkbox" checked={hasDefects} onChange={(e) => setHasDefects(e.target.checked)} />
              Есть дефекты / замечания
            </label>
            {hasDefects ? (
              <textarea
                value={defectNotes}
                onChange={(e) => setDefectNotes(e.target.value)}
                placeholder="Опишите дефекты…"
                rows={3}
                className="mt-2 w-full text-sm rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-3 py-2"
              />
            ) : null}
            <div className="flex flex-wrap gap-2 mt-5 justify-end">
              <button
                type="button"
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-[#333]"
                onClick={() => setResolveOpen(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={busy}
                className="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white disabled:opacity-50"
                onClick={() =>
                  run(async () => {
                    await onResolveHandoff(resolveOpen.handoffId, { action: 'reject' });
                    setResolveOpen(null);
                  })
                }
              >
                Отклонить передачу
              </button>
              <button
                type="button"
                disabled={busy}
                className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white disabled:opacity-50"
                onClick={() =>
                  run(async () => {
                    await onResolveHandoff(resolveOpen.handoffId, {
                      action: 'accept',
                      hasDefects,
                      defectNotes: hasDefects ? defectNotes.trim() || null : null,
                    });
                    setResolveOpen(null);
                  })
                }
              >
                Принять
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
