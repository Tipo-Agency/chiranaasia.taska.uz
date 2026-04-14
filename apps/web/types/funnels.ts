export interface FunnelStage {
  id: string;
  label: string;
  color: string;
  taskTemplate?: {
    enabled?: boolean;
    title?: string;
    assigneeMode?: 'deal_assignee' | 'specific_user';
    assigneeUserId?: string;
  };
}

export interface InstagramSourceConfig {
  enabled: boolean;
  instagramAccountId?: string;
  accessToken?: string;
  pageId?: string;
  lastSyncAt?: string;
}

export interface TelegramSourceConfig {
  enabled: boolean;
  botToken?: string;
  webhookUrl?: string;
  lastSyncAt?: string;
  useWebhook?: boolean;
  webhookRegistered?: boolean;
  webhookSecretSet?: boolean;
}

export interface SiteSourceConfig {
  enabled: boolean;
  defaultStageId?: string;
  defaultAssigneeId?: string;
  keyLast4?: string;
}

export interface FunnelSourceConfig {
  instagram?: InstagramSourceConfig;
  telegram?: TelegramSourceConfig;
  site?: SiteSourceConfig;
}

export interface FunnelNotificationTemplates {
  dealAssigned?: {
    title?: string;
    chatBody?: string;
    telegramHtml?: string;
  };
}

export interface SalesFunnel {
  id: string;
  name: string;
  title?: string;
  color?: string;
  ownerUserId?: string;
  stages: FunnelStage[];
  sources?: FunnelSourceConfig;
  notificationTemplates?: FunnelNotificationTemplates;
  createdAt?: string;
  updatedAt?: string;
  isArchived?: boolean;
}
