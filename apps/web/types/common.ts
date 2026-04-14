export enum Role {
  ADMIN = 'ADMIN',
  EMPLOYEE = 'EMPLOYEE',
}

export enum ViewMode {
  TABLE = 'table',
  KANBAN = 'kanban',
  GANTT = 'gantt',
}

export interface StatusOption {
  id: string;
  name: string;
  color: string;
  isArchived?: boolean;
  updatedAt?: string;
}

export interface PriorityOption {
  id: string;
  name: string;
  color: string;
  isArchived?: boolean;
  updatedAt?: string;
}

export type EntityType = 'task' | 'idea' | 'feature' | 'purchase_request';
