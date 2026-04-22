export interface MessageAttachment {
  entityType: 'task' | 'deal' | 'client' | 'doc' | 'meeting' | 'content' | 'project' | 'table';
  entityId: string;
  label?: string;
}

export interface InboxMessage {
  id: string;
  senderId: string;
  recipientId: string | null;
  text: string;
  body?: string;
  attachments: MessageAttachment[];
  createdAt: string;
  read: boolean;
  isRead?: boolean;
  dealId?: string | null;
  funnelId?: string | null;
  direction?: string;
  channel?: string;
  mediaUrl?: string | null;
  externalMsgId?: string | null;
}

export interface NotificationSetting {
  telegramPersonal: boolean;
  telegramGroup: boolean;
}

export interface NotificationPreferences {
  calendarColors?: {
    client?: string;
    work?: string;
    project?: string;
    shoot?: string;
  };
  channels?: {
    in_app?: boolean;
    chat?: boolean;
    telegram?: boolean;
    email?: boolean;
  };
  quietHours?: {
    enabled?: boolean;
    start?: string;
    end?: string;
    timezone?: string;
  };
  types?: Record<
    string,
    {
      in_app?: boolean;
      chat?: boolean;
      telegram?: boolean;
      email?: boolean;
    }
  >;
  newTask: NotificationSetting;
  statusChange: NotificationSetting;
  taskAssigned: NotificationSetting;
  taskComment: NotificationSetting;
  taskDeadline: NotificationSetting;
  docCreated: NotificationSetting;
  docUpdated: NotificationSetting;
  docShared: NotificationSetting;
  meetingCreated: NotificationSetting;
  meetingReminder: NotificationSetting;
  meetingUpdated: NotificationSetting;
  postCreated: NotificationSetting;
  postStatusChanged: NotificationSetting;
  purchaseRequestCreated: NotificationSetting;
  purchaseRequestStatusChanged: NotificationSetting;
  financePlanUpdated: NotificationSetting;
  dealCreated: NotificationSetting;
  dealStatusChanged: NotificationSetting;
  clientCreated: NotificationSetting;
  contractCreated: NotificationSetting;
  employeeCreated: NotificationSetting;
  employeeUpdated: NotificationSetting;
  processStarted: NotificationSetting;
  processStepCompleted: NotificationSetting;
  processStepRequiresApproval: NotificationSetting;
  defaultFunnelId?: string;
  telegramGroupChatId?: string;
  telegramChatId?: string;
}
