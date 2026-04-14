import type { EntityType } from './common';

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  text: string;
  createdAt: string;
  isSystem?: boolean;
  attachmentId?: string;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  name: string;
  url: string;
  type: string;
  uploadedAt: string;
  docId?: string;
  attachmentType?: 'file' | 'doc';
  storagePath?: string;
}

export interface Task {
  id: string;
  entityType: EntityType;
  tableId: string;
  title: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  assigneeIds?: string[];
  projectId: string | null;
  startDate: string;
  endDate: string;
  description?: string;
  isArchived?: boolean;
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
  contentPostId?: string;
  processId?: string;
  processInstanceId?: string;
  stepId?: string;
  dealId?: string;
  source?: string;
  category?: string;
  taskId?: string;
  parentTaskId?: string | null;
  createdByUserId?: string;
  createdAt?: string;
  requesterId?: string;
  departmentId?: string;
  categoryId?: string;
  amount?: number;
  decisionDate?: string;
  updatedAt?: string;
  /** Optimistic locking: ожидаемая версия для PATCH (см. API). */
  version?: number;
  linkedFeatureId?: string;
  linkedIdeaId?: string;
}
