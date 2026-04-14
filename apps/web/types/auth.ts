import type { Role } from './common';

export interface AppRole {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isSystem: boolean;
  sortOrder: number;
  permissions: string[];
}

export interface User {
  id: string;
  name: string;
  /** Устарело: используйте roleName и permissions */
  role?: Role;
  roleId?: string;
  roleSlug?: string;
  roleName?: string;
  /** Права текущего пользователя (после логина / /auth/me) */
  permissions?: string[];
  avatar?: string;
  login?: string;
  email?: string;
  phone?: string;
  telegram?: string;
  telegramUserId?: string;
  password?: string;
  mustChangePassword?: boolean;
  isArchived?: boolean;
  updatedAt?: string;
  calendarExportToken?: string | null;
  calendarExportUrl?: string | null;
}
