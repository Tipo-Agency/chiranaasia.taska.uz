export interface Department {
  id: string;
  name: string;
  parentId?: string;
  headId?: string;
  description?: string;
  isArchived?: boolean;
  updatedAt?: string;
}

export interface EmployeeInfo {
  id: string;
  userId?: string;
  departmentId?: string;
  positionId?: string;
  orgPositionId?: string;
  fullName: string;
  status: string;
  hireDate?: string;
  birthDate?: string;
  isArchived?: boolean;
  updatedAt?: string;
}

export interface OrgPosition {
  id: string;
  title: string;
  departmentId?: string;
  managerPositionId?: string;
  holderUserId?: string;
  order?: number;
  isArchived?: boolean;
  updatedAt?: string;
  taskAssigneeMode?: 'round_robin' | 'all';
  lastTaskAssigneeUserId?: string;
}
