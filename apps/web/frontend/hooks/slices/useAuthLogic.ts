
import { useState, useEffect } from 'react';
import { User } from '../../../types';
import { api } from '../../../backend/api';
import { storageService } from '../../../services/storageService';

export const useAuthLogic = (showNotification: (msg: string) => void) => {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

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

  const login = (user: User) => {
    setCurrentUser(user);
    storageService.setActiveUserId(user.id);
    showNotification(`Добро пожаловать, ${user.name}`);
  };

  const logout = () => {
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
    setUsers(activeUsers);
    // Сохраняем через API в локальное хранилище (всех, включая архивных)
    api.users.updateAll(usersWithTimestamp);
    // Refresh current user if data changed
    if (currentUser) {
        const u = usersWithTimestamp.find(curr => curr.id === currentUser.id);
        // Если текущий пользователь был архивирован или удален, выходим
        if (u && !u.isArchived) {
          setCurrentUser(u);
        } else {
          setCurrentUser(null);
          storageService.clearActiveUserId();
        }
    }
  };

  const updateProfile = (updatedUser: User) => {
    const updatedUsers = users.map(u => u.id === updatedUser.id ? updatedUser : u);
    setUsers(updatedUsers);
    api.users.updateAll(updatedUsers);
    setCurrentUser(updatedUser);
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
