import { useEffect, useMemo, useState } from 'react';
import type {
  ProductionOperation,
  ProductionOperationStatus,
  ProductionOrder,
  ProductionOrderPriority,
  ProductionOrderStatus,
  ProductionShiftLog,
} from './types';

const STORAGE_KEY = 'production_model_v1';

interface ProductionModel {
  orders: ProductionOrder[];
  operations: ProductionOperation[];
  shiftLogs: ProductionShiftLog[];
}

function safeParse(raw: string | null): ProductionModel | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ProductionModel;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      operations: Array.isArray(parsed.operations) ? parsed.operations : [],
      shiftLogs: Array.isArray(parsed.shiftLogs) ? parsed.shiftLogs : [],
    };
  } catch {
    return null;
  }
}

function seedModel(): ProductionModel {
  const now = new Date().toISOString();
  const orders: ProductionOrder[] = [
      {
        id: 'prod-1',
        title: 'Партия упаковки №101',
        status: 'queued',
        priority: 'high',
        assigneeUserIds: [],
        plannedQty: 5000,
        producedQty: 0,
        defectQty: 0,
        createdAt: now,
      },
      {
        id: 'prod-2',
        title: 'Сборка стенда “Весна”',
        status: 'in_progress',
        priority: 'normal',
        assigneeUserIds: [],
        plannedQty: 120,
        producedQty: 54,
        defectQty: 2,
        createdAt: now,
      },
    ];
  const operations: ProductionOperation[] = [
    {
      id: 'op-1',
      orderId: 'prod-2',
      title: 'Лазерная резка',
      workcenter: 'Цех A',
      assigneeUserIds: [],
      status: 'done',
      plannedMinutes: 180,
      spentMinutes: 175,
      sequence: 1,
      dependsOnOperationIds: [],
      createdAt: now,
      finishedAt: now,
    },
    {
      id: 'op-2',
      orderId: 'prod-2',
      title: 'Сборка',
      workcenter: 'Цех B',
      assigneeUserIds: [],
      status: 'in_progress',
      plannedMinutes: 240,
      spentMinutes: 120,
      sequence: 2,
      dependsOnOperationIds: ['op-1'],
      createdAt: now,
      startedAt: now,
    },
  ];
  return { orders, operations, shiftLogs: [] };
}

export function useProductionStore() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [operations, setOperations] = useState<ProductionOperation[]>([]);
  const [shiftLogs, setShiftLogs] = useState<ProductionShiftLog[]>([]);

  useEffect(() => {
    const parsed = safeParse(localStorage.getItem(STORAGE_KEY));
    if (parsed) {
      setOrders(parsed.orders);
      setOperations(parsed.operations);
      setShiftLogs(parsed.shiftLogs);
      return;
    }
    const seeded = seedModel();
    setOrders(seeded.orders);
    setOperations(seeded.operations);
    setShiftLogs(seeded.shiftLogs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  }, []);

  const persist = (
    nextOrders: ProductionOrder[],
    nextOperations: ProductionOperation[] = operations,
    nextShiftLogs: ProductionShiftLog[] = shiftLogs
  ) => {
    setOrders(nextOrders);
    setOperations(nextOperations);
    setShiftLogs(nextShiftLogs);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ orders: nextOrders, operations: nextOperations, shiftLogs: nextShiftLogs })
    );
  };

  const stats = useMemo(() => {
    const active = orders.filter((o) => !o.isArchived);
    const overdue = active.filter((o) => o.status !== 'done' && o.dueDate && o.dueDate < new Date().toISOString().slice(0, 10)).length;
    const plannedMinutes = operations.filter((o) => !o.isArchived).reduce((s, o) => s + (o.plannedMinutes || 0), 0);
    const spentMinutes = operations.filter((o) => !o.isArchived).reduce((s, o) => s + (o.spentMinutes || 0), 0);
    return {
      total: active.length,
      queued: active.filter((o) => o.status === 'queued').length,
      inProgress: active.filter((o) => o.status === 'in_progress').length,
      paused: active.filter((o) => o.status === 'paused').length,
      done: active.filter((o) => o.status === 'done').length,
      overdue,
      plannedMinutes,
      spentMinutes,
    };
  }, [orders, operations]);

  const setStatus = (id: string, status: ProductionOrderStatus) => {
    persist(
      orders.map((o) =>
        o.id === id
          ? {
              ...o,
              status,
              updatedAt: new Date().toISOString(),
            }
          : o
      )
    );
  };

  const createOrder = (payload: Partial<ProductionOrder> & { title: string }) => {
    const now = new Date().toISOString();
    const next: ProductionOrder = {
      id: `prod-${Date.now()}`,
      title: payload.title.trim(),
      clientName: payload.clientName,
      departmentId: payload.departmentId,
      assigneeUserIds: payload.assigneeUserIds || [],
      status: (payload.status as ProductionOrderStatus) || 'queued',
      priority: (payload.priority as ProductionOrderPriority) || 'normal',
      plannedQty: Number(payload.plannedQty || 0),
      producedQty: Number(payload.producedQty || 0),
      defectQty: Number(payload.defectQty || 0),
      dueDate: payload.dueDate,
      createdAt: now,
      updatedAt: now,
      isArchived: false,
    };
    persist([next, ...orders]);
    return next;
  };

  const updateOrder = (id: string, patch: Partial<ProductionOrder>) => {
    persist(orders.map((o) => (o.id === id ? { ...o, ...patch, updatedAt: new Date().toISOString() } : o)));
  };

  const createOperation = (payload: Partial<ProductionOperation> & { orderId: string; title: string }) => {
    const now = new Date().toISOString();
    const listForOrder = operations.filter((x) => x.orderId === payload.orderId && !x.isArchived);
    const next: ProductionOperation = {
      id: `op-${Date.now()}`,
      orderId: payload.orderId,
      title: payload.title.trim(),
      workcenter: payload.workcenter || '',
      assigneeUserIds: payload.assigneeUserIds || [],
      status: (payload.status as ProductionOperationStatus) || 'queued',
      plannedMinutes: Number(payload.plannedMinutes || 0),
      spentMinutes: Number(payload.spentMinutes || 0),
      sequence: payload.sequence ?? listForOrder.length + 1,
      dependsOnOperationIds: payload.dependsOnOperationIds || [],
      createdAt: now,
      updatedAt: now,
      isArchived: false,
    };
    persist(orders, [next, ...operations]);
    return next;
  };

  const updateOperation = (id: string, patch: Partial<ProductionOperation>) => {
    persist(
      orders,
      operations.map((o) => (o.id === id ? { ...o, ...patch, updatedAt: new Date().toISOString() } : o))
    );
  };

  const logShift = (payload: Omit<ProductionShiftLog, 'id' | 'createdAt'>) => {
    const row: ProductionShiftLog = {
      id: `shift-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...payload,
    };
    const nextLogs = [row, ...shiftLogs];
    // Build updated operations inline so both logs and operation time are persisted atomically.
    // Calling updateOperation separately would call persist(orders, operations, shiftLogs) with
    // the OLD shiftLogs, overwriting the new log entry we just added.
    const now = new Date().toISOString();
    const nextOperations = payload.operationId
      ? operations.map((o) =>
          o.id === payload.operationId
            ? { ...o, spentMinutes: (o.spentMinutes || 0) + (payload.minutes || 0), updatedAt: now }
            : o
        )
      : operations;
    persist(orders, nextOperations, nextLogs);
    return row;
  };

  return {
    orders,
    operations,
    shiftLogs,
    stats,
    setStatus,
    createOrder,
    updateOrder,
    createOperation,
    updateOperation,
    logShift,
  };
}

