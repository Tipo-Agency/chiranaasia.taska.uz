export type TriggerType =
  | 'task_created'
  | 'task_status_changed'
  | 'task_assigned'
  | 'task_comment'
  | 'task_deadline'
  | 'doc_created'
  | 'doc_updated'
  | 'doc_shared'
  | 'meeting_created'
  | 'meeting_reminder'
  | 'meeting_updated'
  | 'post_created'
  | 'post_status_changed'
  | 'purchase_request_created'
  | 'purchase_request_status_changed'
  | 'finance_plan_updated'
  | 'deal_created'
  | 'deal_status_changed'
  | 'client_created'
  | 'contract_created'
  | 'employee_created'
  | 'employee_updated'
  | 'process_started'
  | 'process_step_completed'
  | 'process_step_requires_approval';

export type ActionType = 'telegram_message' | 'approval_request' | 'assign_task' | 'change_status';

export interface TelegramButtonConfig {
  text: string;
  action: 'approve' | 'reject' | 'defer' | 'view' | 'custom';
  url?: string;
  callbackData?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  isActive: boolean;
  module: 'tasks' | 'docs' | 'meetings' | 'content' | 'finance' | 'crm' | 'employees' | 'bpm';
  trigger: TriggerType;
  conditions: {
    moduleId?: string;
    statusTo?: string;
    statusFrom?: string;
    priority?: string;
    departmentId?: string;
    categoryId?: string;
  };
  action: {
    type: ActionType;
    template?: string;
    buttons?: TelegramButtonConfig[];
    targetUser: 'assignee' | 'creator' | 'admin' | 'specific' | 'manager';
    specificUserId?: string;
    approvalType?: 'purchase_request' | 'process_step' | 'document' | 'deal';
    approvalEntityId?: string;
  };
  isArchived?: boolean;
}
