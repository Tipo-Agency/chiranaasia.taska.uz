export interface ContentPost {
  id: string;
  tableId: string;
  topic: string;
  description?: string;
  date: string;
  platform: string[];
  format: 'post' | 'reel' | 'story' | 'article' | 'video';
  status: 'idea' | 'copywriting' | 'design' | 'approval' | 'scheduled' | 'published';
  copy?: string;
  mediaUrl?: string;
  isArchived?: boolean;
  updatedAt?: string;
}

export interface TableCollection {
  id: string;
  name: string;
  type: 'tasks' | 'docs' | 'meetings' | 'content-plan' | 'backlog' | 'functionality';
  icon: string;
  color?: string;
  isSystem?: boolean;
  isArchived?: boolean;
  isPublic?: boolean;
  updatedAt?: string;
}

export interface Folder {
  id: string;
  tableId: string;
  name: string;
  parentFolderId?: string;
  isArchived?: boolean;
}

export interface Doc {
  id: string;
  tableId: string;
  folderId?: string;
  title: string;
  type: 'link' | 'internal';
  url?: string;
  content?: string;
  tags: string[];
  isArchived?: boolean;
  updatedAt?: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  action: string;
  details: string;
  timestamp: string;
  read: boolean;
}

export interface BacklogPage {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
}

export interface FunctionalityPage {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
}

export interface FunctionalityCategory {
  id: string;
  name: string;
  description?: string;
  defaultFeatures?: string[];
}

export interface DefaultFeature {
  id: string;
  categoryId: string;
  title: string;
  description?: string;
  order: number;
}

export interface ContentPlanPage {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
  publicLink?: string;
}
