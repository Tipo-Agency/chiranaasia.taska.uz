export type ProductionOrderStatus = 'queued' | 'in_progress' | 'paused' | 'done';
export type ProductionOrderPriority = 'low' | 'normal' | 'high' | 'urgent';
export type ProductionOperationStatus = 'queued' | 'in_progress' | 'blocked' | 'done';

export interface ProductionOrder {
  id: string;
  title: string;
  clientName?: string;
  departmentId?: string;
  assigneeUserIds: string[];
  status: ProductionOrderStatus;
  priority: ProductionOrderPriority;
  plannedQty: number;
  producedQty: number;
  defectQty: number;
  dueDate?: string;
  createdAt: string;
  updatedAt?: string;
  isArchived?: boolean;
}

export interface ProductionOperation {
  id: string;
  orderId: string;
  title: string;
  workcenter?: string;
  assigneeUserIds: string[];
  status: ProductionOperationStatus;
  plannedMinutes: number;
  spentMinutes: number;
  sequence: number;
  dependsOnOperationIds: string[];
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt?: string;
  isArchived?: boolean;
}

export interface ProductionShiftLog {
  id: string;
  date: string;
  userId: string;
  orderId?: string;
  operationId?: string;
  minutes: number;
  comment?: string;
  createdAt: string;
}

