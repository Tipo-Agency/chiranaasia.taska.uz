
import React, { useState, useEffect, useRef } from 'react';
import { User, Role } from '../../types';
import { Camera, Save, AtSign, Mail, Phone, Send, KeyRound, Trash2, Lock, Upload, User as UserIcon } from 'lucide-react';
import { ModuleCreateIconButton } from '../ui/ModuleCreateIconButton';
import { uploadAvatar } from '../../services/localStorageService';
import { DEFAULT_AVATARS, getDefaultAvatarForId, getRandomDefaultAvatar } from '../../constants/avatars';

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
  
  // Password Change State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // User Mgmt State
  const [newUserName, setNewUserName] = useState('');
  const [newUserLogin, setNewUserLogin] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('123'); // Default password

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

      if (newPassword) {
        if (newPassword !== confirmPassword) {
          alert('Пароли не совпадают!');
          return;
        }
        // Передаём пароль в открытом виде — бэкенд сам захеширует
        updates.password = newPassword;
      }

      onUpdateProfile(updates);
      setNewPassword('');
      setConfirmPassword('');
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

  const handleAddUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newUserName.trim() || !newUserLogin.trim()) return alert('Имя и Логин обязательны');
      
      // Ensure password is set
      const passwordToSet = newUserPassword.trim() || '123';

      const newUser: User = {
          id: `u-${Date.now()}`,
          name: newUserName,
          login: newUserLogin,
          email: newUserEmail,
          // Передаём пароль в открытом виде — бэкенд сам захеширует
          password: passwordToSet,
          role: Role.EMPLOYEE,
          avatar: getRandomDefaultAvatar(),
          mustChangePassword: true
      };
      onUpdateUsers([...users, newUser]);
      setNewUserName(''); setNewUserLogin(''); setNewUserEmail(''); setNewUserPassword('123');
      alert(`Пользователь создан. Пароль: ${passwordToSet}`);
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

                {/* Password Change Section */}
                <div className="pt-6 border-t border-gray-100 dark:border-[#333]">
                    <h4 className="text-sm font-bold text-gray-800 dark:text-white mb-4 uppercase flex items-center gap-2">
                        <Lock size={16}/> Смена пароля
                    </h4>
                    <div className="grid grid-cols-2 gap-6">
                        <input 
                            type="password" 
                            value={newPassword} 
                            onChange={e => setNewPassword(e.target.value)} 
                            className="w-full bg-white dark:bg-[#252525] border border-gray-300 dark:border-[#333] rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100" 
                            placeholder="Новый пароль" 
                        />
                        <input 
                            type="password" 
                            value={confirmPassword} 
                            onChange={e => setConfirmPassword(e.target.value)} 
                            className="w-full bg-white dark:bg-[#252525] border border-gray-300 dark:border-[#333] rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100" 
                            placeholder="Повторите пароль" 
                        />
                    </div>
                </div>

                <button type="submit" className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2 transition-colors">
                    <Save size={18}/> Сохранить профиль
                </button>
            </form>
        </div>
      );
  }

  if (activeTab === 'users') {
      return (
        <div className="space-y-8 w-full max-w-none">
            {/* Функция заполнения тестовыми данными полностью удалена */}
            <div className="bg-gray-50 dark:bg-[#202020] p-6 rounded-xl border border-gray-200 dark:border-[#333]">
                <h3 className="text-base font-bold text-gray-800 dark:text-white mb-4">Добавить сотрудника</h3>
                <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Имя</label>
                        <input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Имя Фамилия" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Логин</label>
                        <input value={newUserLogin} onChange={e => setNewUserLogin(e.target.value)} placeholder="ivan" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Пароль</label>
                        <input value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} placeholder="123" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100" />
                    </div>
                    <ModuleCreateIconButton type="submit" accent="indigo" label="Создать пользователя" />
                </form>
            </div>
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
