
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User } from '../../types';
import { Save, KeyRound, Trash2, Upload, User as UserIcon, Phone, AtSign, Mail, Send, Calendar, Copy, RefreshCw } from 'lucide-react';
import { Button, Input, StandardModal } from '../ui';
import { uploadAvatar } from '../../services/localStorageService';
import { getDefaultAvatarForId } from '../../constants/avatars';
import { api } from '../../backend/api';

interface ProfileSettingsProps {
  currentUser: User;
  users: User[];
  onUpdateProfile: (user: User) => void;
  onUpdateUsers: (users: User[]) => void;
  activeTab: string;
  // onFillMockData удален
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ currentUser, users, onUpdateProfile, onUpdateUsers, activeTab }) => {
  // Profile State
  const [profileName, setProfileName] = useState(currentUser.name);
  const [profileEmail, setProfileEmail] = useState(currentUser.email || '');
  const [profileLogin, setProfileLogin] = useState(currentUser.login || '');
  const [profilePhone, setProfilePhone] = useState(currentUser.phone || '');
  const [profileTelegram, setProfileTelegram] = useState(currentUser.telegram || '');
  const [profileAvatar, setProfileAvatar] = useState(currentUser.avatar || '');
  
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const calendarSubscribeUrl = useMemo(() => {
    if (currentUser.calendarExportUrl) return currentUser.calendarExportUrl;
    const t = currentUser.calendarExportToken;
    if (!t || typeof window === 'undefined') return null;
    return `${window.location.origin}/api/calendar/feed/${t}.ics`;
  }, [currentUser.calendarExportUrl, currentUser.calendarExportToken]);

  useEffect(() => {
      setProfileName(currentUser.name);
      setProfileLogin(currentUser.login || '');
      setProfileEmail(currentUser.email || '');
      setProfilePhone(currentUser.phone || '');
      setProfileTelegram(currentUser.telegram || '');
      setProfileAvatar(currentUser.avatar || '');
  }, [currentUser]);

  const handleSaveProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      
      const updates: User = {
          ...currentUser,
          name: profileName,
          login: profileLogin,
          email: profileEmail,
          phone: profilePhone,
          telegram: profileTelegram,
          avatar: profileAvatar
      };

      onUpdateProfile(updates);
  };

  const handleChangeAvatar = () => {
      avatarInputRef.current?.click();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Проверяем тип файла
      if (!file.type.startsWith('image/')) {
          alert('Пожалуйста, выберите изображение');
          return;
      }

      // Проверяем размер файла (макс 5MB)
      if (file.size > 5 * 1024 * 1024) {
          alert('Размер файла не должен превышать 5MB');
          return;
      }

      setIsUploadingAvatar(true);
      try {
          const result = await uploadAvatar(file, currentUser.id);
          setProfileAvatar(result.url);
          // Сохраняем сразу после загрузки
          const updates: User = {
              ...currentUser,
              avatar: result.url
          };
          onUpdateProfile(updates);
      } catch (error) {
          console.error('Ошибка загрузки аватара:', error);
          alert('Ошибка при загрузке аватара. Попробуйте еще раз.');
      } finally {
          setIsUploadingAvatar(false);
          // Сбрасываем input
          if (avatarInputRef.current) {
              avatarInputRef.current.value = '';
          }
      }
  };

  const handleDeleteUser = async (id: string) => {
      if (id === currentUser.id) {
          alert('Нельзя удалить текущего пользователя');
          return;
      }
      if (confirm('Удалить пользователя? Это действие нельзя отменить.')) {
          const now = new Date().toISOString();
          const updatedUsers = users.map(u => 
              u.id === id 
                  ? { ...u, isArchived: true, updatedAt: now } 
                  : { ...u, updatedAt: u.updatedAt || now }
          );
          onUpdateUsers(updatedUsers);
      }
  };
  
  const handleResetPassword = async (id: string) => {
      if(confirm('Сбросить пароль на "123"?')) {
          onUpdateUsers(users.map(u => u.id === id ? { ...u, password: '123', mustChangePassword: true } : u));
          alert('Пароль сброшен.');
      }
  };

  const handleToggleMustChange = (id: string, next: boolean) => {
    onUpdateUsers(users.map((u) => (u.id === id ? { ...u, mustChangePassword: next } : u)));
  };

  const handleEnsureCalendarLink = async () => {
    setCalendarBusy(true);
    try {
      await api.calendar.ensureExportToken({});
      const me = (await api.users.getMe()) as User;
      onUpdateProfile({ ...currentUser, ...me });
    } catch {
      alert('Не удалось получить ссылку для календаря. Проверьте сеть и авторизацию.');
    } finally {
      setCalendarBusy(false);
    }
  };

  const handleRotateCalendarLink = async () => {
    if (!confirm('Сгенерировать новую ссылку? Подписка в Google Calendar по старому URL перестанет обновляться.')) return;
    setCalendarBusy(true);
    try {
      await api.calendar.ensureExportToken({ rotate: true });
      const me = (await api.users.getMe()) as User;
      onUpdateProfile({ ...currentUser, ...me });
    } catch {
      alert('Не удалось обновить ссылку.');
    } finally {
      setCalendarBusy(false);
    }
  };

  const submitPasswordChange = () => {
    const p1 = newPassword.trim();
    const p2 = confirmPassword.trim();
    if (!p1) return;
    if (p1 !== p2) {
      alert('Пароли не совпадают!');
      return;
    }
    onUpdateProfile({ ...currentUser, password: p1, mustChangePassword: false });
    setPasswordModalOpen(false);
    setNewPassword('');
    setConfirmPassword('');
  };

  if (activeTab === 'profile') {
      return (
        <div className="space-y-8 w-full max-w-none">
            <div className="flex items-center gap-6 mb-8">
                    <div className="relative group">
                    <input
                        type="file"
                        ref={avatarInputRef}
                        onChange={handleAvatarUpload}
                        accept="image/*"
                        className="hidden"
                    />
                    <div className="relative group cursor-pointer" onClick={handleChangeAvatar}>
                        <img 
                            src={profileAvatar || getDefaultAvatarForId(currentUser.id)} 
                            className="w-24 h-24 rounded-full border-4 border-gray-100 dark:border-[#333] object-cover object-center" 
                            alt="Avatar"
                        />
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            {isUploadingAvatar ? (
                                <div className="text-white text-xs">Загрузка...</div>
                            ) : (
                                <Upload size={24} className="text-white" />
                            )}
                        </div>
                    </div>
                </div>
                <div>
                    <h3 className="font-bold text-2xl text-gray-900 dark:text-white">{currentUser.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 uppercase font-medium">{currentUser.role}</p>
                </div>
            </div>
            
            <form onSubmit={handleSaveProfile} className="space-y-8">
                {/* Personal Info */}
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Имя</label>
                            <div className="flex items-center rounded-lg border border-gray-300 dark:border-[#333] bg-white dark:bg-[#252525] overflow-hidden">
                                <span className="flex items-center justify-center w-12 h-11 bg-gray-50 dark:bg-[#202020] text-gray-500 border-r border-gray-200 dark:border-[#333]">
                                    <UserIcon size={16} />
                                </span>
                                <input
                                    value={profileName}
                                    onChange={e => setProfileName(e.target.value)}
                                    className="flex-1 h-11 px-4 text-sm text-gray-900 dark:text-gray-100 bg-transparent border-none outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Телефон</label>
                            <div className="flex items-center rounded-lg border border-gray-300 dark:border-[#333] bg-white dark:bg-[#252525] overflow-hidden">
                                <span className="flex items-center justify-center w-12 h-11 bg-gray-50 dark:bg-[#202020] text-gray-500 border-r border-gray-200 dark:border-[#333]">
                                    <Phone size={16} />
                                </span>
                                <input
                                    value={profilePhone}
                                    onChange={e => setProfilePhone(e.target.value)}
                                    className="flex-1 h-11 px-4 text-sm text-gray-900 dark:text-gray-100 bg-transparent border-none outline-none"
                                    placeholder="+998..."
                                />
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Логин <span className="text-red-500">*</span></label>
                            <div className="flex items-center rounded-lg border border-gray-300 dark:border-[#333] bg-white dark:bg-[#252525] overflow-hidden">
                                <span className="flex items-center justify-center w-12 h-11 bg-gray-50 dark:bg-[#202020] text-gray-500 border-r border-gray-200 dark:border-[#333]">
                                    <AtSign size={16} />
                                </span>
                                <input
                                    required
                                    value={profileLogin}
                                    onChange={e => setProfileLogin(e.target.value)}
                                    className="flex-1 h-11 px-4 text-sm text-gray-900 dark:text-gray-100 bg-transparent border-none outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Email</label>
                            <div className="flex items-center rounded-lg border border-gray-300 dark:border-[#333] bg-white dark:bg-[#252525] overflow-hidden">
                                <span className="flex items-center justify-center w-12 h-11 bg-gray-50 dark:bg-[#202020] text-gray-500 border-r border-gray-200 dark:border-[#333]">
                                    <Mail size={16} />
                                </span>
                                <input
                                    value={profileEmail}
                                    onChange={e => setProfileEmail(e.target.value)}
                                    className="flex-1 h-11 px-4 text-sm text-gray-900 dark:text-gray-100 bg-transparent border-none outline-none"
                                />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Telegram (Username)</label>
                        <div className="flex items-center rounded-lg border border-gray-300 dark:border-[#333] bg-white dark:bg-[#252525] overflow-hidden">
                            <span className="flex items-center justify-center w-12 h-11 bg-gray-50 dark:bg-[#202020] text-gray-500 border-r border-gray-200 dark:border-[#333]">
                                <Send size={16} />
                            </span>
                            <input
                                value={profileTelegram}
                                onChange={e => setProfileTelegram(e.target.value)}
                                className="flex-1 h-11 px-4 text-sm text-gray-900 dark:text-gray-100 bg-transparent border-none outline-none"
                                placeholder="@username"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-[#202020] p-5 rounded-xl border border-gray-200 dark:border-[#333] space-y-3">
                  <div className="flex items-start gap-3">
                    <Calendar className="text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" size={20} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-gray-900 dark:text-white">Google Calendar</div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                        Подписка по ссылке (iCal): события календаря, где вы участник, попадут в выбранный календарь Google. В Google: «Другие календари» → «Добавить» → «По URL» — вставьте ссылку ниже.
                      </p>
                      {calendarSubscribeUrl ? (
                        <div className="mt-3 flex flex-col sm:flex-row gap-2">
                          <input
                            readOnly
                            value={calendarSubscribeUrl}
                            className="flex-1 min-w-0 border border-gray-200 dark:border-[#444] rounded-lg px-3 py-2 text-xs bg-white dark:bg-[#1a1a1a] text-gray-800 dark:text-gray-200 font-mono"
                          />
                          <div className="flex gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => navigator.clipboard?.writeText(calendarSubscribeUrl).catch(() => {})}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white"
                            >
                              <Copy size={14} /> Копировать
                            </button>
                            <button
                              type="button"
                              disabled={calendarBusy}
                              onClick={() => void handleRotateCalendarLink()}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-gray-300 dark:border-[#555] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#333] disabled:opacity-50"
                              title="Новый секретный URL"
                            >
                              <RefreshCw size={14} /> Новый URL
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={calendarBusy}
                          onClick={() => void handleEnsureCalendarLink()}
                          className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
                        >
                          Получить ссылку для подписки
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <button type="submit" className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2 transition-colors">
                    <Save size={18}/> Сохранить профиль
                </button>
            </form>

            <div className="bg-gray-50 dark:bg-[#202020] p-5 rounded-xl border border-gray-200 dark:border-[#333]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">Пароль</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Смена пароля отдельной операцией — профиль можно сохранять без этого.
                  </div>
                </div>
                <Button onClick={() => setPasswordModalOpen(true)} variant="secondary">
                  <KeyRound size={16} /> Изменить пароль
                </Button>
              </div>
            </div>

            <StandardModal
              isOpen={passwordModalOpen}
              onClose={() => {
                setPasswordModalOpen(false);
                setNewPassword('');
                setConfirmPassword('');
              }}
              title="Изменить пароль"
              size="sm"
              footer={
                <div className="flex items-center justify-end gap-2">
                  <Button variant="secondary" onClick={() => setPasswordModalOpen(false)}>
                    Отмена
                  </Button>
                  <Button onClick={submitPasswordChange} disabled={!newPassword.trim() || newPassword.trim() !== confirmPassword.trim()}>
                    Сохранить
                  </Button>
                </div>
              }
            >
              <div className="space-y-3">
                <Input label="Новый пароль" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                <Input
                  label="Повторите пароль"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </StandardModal>
        </div>
      );
  }

  if (activeTab === 'users') {
      return (
        <div className="space-y-8 w-full max-w-none">
            <div className="space-y-3">
                {users.filter(user => !user.isArchived).map(user => (
                    <div key={user.id} className="flex items-center justify-between p-4 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl hover:shadow-sm transition-shadow">
                        <div className="flex items-center gap-4">
                            <img 
                                src={user.avatar || getDefaultAvatarForId(user.id)} 
                                className="w-10 h-10 rounded-full object-cover object-center" 
                                alt=""
                            />
                            <div>
                                <div className="font-bold text-sm text-gray-900 dark:text-white">{user.name}</div>
                                <div className="text-xs text-gray-500">Логин: {user.login}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mr-2 select-none">
                              <input
                                type="checkbox"
                                checked={!!user.mustChangePassword}
                                onChange={(e) => handleToggleMustChange(user.id, e.target.checked)}
                              />
                              Запросить смену пароля
                            </label>
                            <button onClick={() => handleResetPassword(user.id)} className="p-2 text-gray-400 hover:text-orange-500 rounded-lg bg-gray-50 dark:bg-[#303030]" title="Сбросить пароль"><KeyRound size={18}/></button>
                            <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg bg-gray-50 dark:bg-[#303030]" title="Удалить"><Trash2 size={18}/></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      );
  }

  return null;
};
