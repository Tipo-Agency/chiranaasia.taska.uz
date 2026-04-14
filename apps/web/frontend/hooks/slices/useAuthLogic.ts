
import { useState, useEffect } from 'react';
import { User } from '../../../types';
import { api } from '../../../backend/api';
import {
  authEndpoint,
  ensureAuthCsrfCookie,
  setApiErrorNotifier,
  setApiUnauthorizedHandler,
} from '../../../services/apiClient';
import { storageService } from '../../../services/storageService';
import { getDefaultAvatarForId } from '../../../constants/avatars';
import { resetMustChangePasswordPromptFlag } from '../../../utils/authUiOnce';

export const useAuthLogic = (showNotification: (msg: string) => void) => {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const withAvatarFallback = (u: User): User => ({
    ...u,
    avatar: u.avatar || getDefaultAvatarForId(u.id),
  });

  // Restore session on load (or when users are loaded)
  useEffect(() => {
      if (users.length > 0 && !currentUser) {
          const storedId = storageService.getActiveUserId();
          if (storedId) {
              const foundUser = users.find(u => u.id === storedId);
              if (foundUser) {
                  setCurrentUser(foundUser);
                  // Optionally sync updated user data from cloud
              }
          }
      }
  }, [users, currentUser]);

  useEffect(() => {
    void ensureAuthCsrfCookie();
  }, []);

  useEffect(() => {
    setApiUnauthorizedHandler(() => {
      void authEndpoint.logout();
      setCurrentUser(null);
      storageService.clearActiveUserId();
      showNotification('Сессия истекла — войдите снова');
    });
    setApiErrorNotifier((msg) => showNotification(msg));
    return () => {
      setApiUnauthorizedHandler(null);
      setApiErrorNotifier(null);
    };
  }, [showNotification]);

  // Подтянуть права роли после перезагрузки (сессия в HttpOnly cookies)
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    (async () => {
      try {
        const me = (await api.users.getMe()) as User;
        if (!cancelled && me?.id === currentUser.id) {
          setCurrentUser(withAvatarFallback({ ...currentUser, ...me }));
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  const login = (user: User) => {
    setCurrentUser(withAvatarFallback(user));
    storageService.setActiveUserId(user.id);
    resetMustChangePasswordPromptFlag(user.id);
    showNotification(`Добро пожаловать, ${user.name}`);
  };

  const logout = () => {
    void authEndpoint.logout();
    setCurrentUser(null);
    storageService.clearActiveUserId();
  };

  const updateUsers = (newUsers: User[]) => {
    const now = new Date().toISOString();
    // Устанавливаем updatedAt для всех пользователей при обновлении
    // ВАЖНО: При удалении пользователя используется мягкое удаление (isArchived: true)
    const usersWithTimestamp = newUsers.map(u => ({
      ...u,
      updatedAt: u.updatedAt || now
    }));
    // Фильтруем архивных пользователей перед установкой в state
    const activeUsers = usersWithTimestamp.filter(u => !u.isArchived);
    setUsers(
      activeUsers.map((u) => {
        const base = withAvatarFallback(u);
        if (currentUser && u.id === currentUser.id && (!base.permissions?.length) && currentUser.permissions?.length) {
          return { ...base, permissions: currentUser.permissions };
        }
        return base;
      })
    );
    // Сохраняем через API в локальное хранилище (всех, включая архивных)
    api.users.updateAll(usersWithTimestamp);
    // Refresh current user if data changed
    if (currentUser) {
        const u = usersWithTimestamp.find(curr => curr.id === currentUser.id);
        // Если текущий пользователь был архивирован или удален, выходим
        if (u && !u.isArchived) {
          setCurrentUser(withAvatarFallback(u as User));
        } else {
          setCurrentUser(null);
          storageService.clearActiveUserId();
        }
    }
  };

  const updateProfile = (updatedUser: User) => {
    const updatedUsers = users.map(u => u.id === updatedUser.id ? updatedUser : u);
    setUsers(updatedUsers.map(withAvatarFallback));
    api.users.updateAll(updatedUsers);
    setCurrentUser(withAvatarFallback(updatedUser));
    setIsProfileOpen(false);
    showNotification('Профиль обновлен');
  };

  return {
    state: { users, currentUser, isProfileOpen },
    setters: { setUsers },
    actions: { 
        login, 
        logout, 
        updateUsers, 
        updateProfile, 
        openProfile: () => setIsProfileOpen(true), 
        closeProfile: () => setIsProfileOpen(false) 
    }
  };
};
