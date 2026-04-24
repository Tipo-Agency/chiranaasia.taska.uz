
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { User } from '../../types';
import { Save, KeyRound, Trash2, Upload, User as UserIcon, Phone, AtSign, Mail, Send, Calendar, Copy, RefreshCw, MessageCircle, Inbox } from 'lucide-react';
import { Button, Input, StandardModal, SystemAlertDialog, SystemConfirmDialog } from '../ui';
import { uploadAvatar } from '../../services/localStorageService';
import { getDefaultAvatarForId } from '../../constants/avatars';
import { api } from '../../backend/api';
import { ensureAuthCsrfCookie } from '../../services/apiClient';
import { getChatDefaultTab, setChatDefaultTab, type ChatMainTab } from '../../utils/chatPreference';
import { generateTempUserPassword } from '../../utils/tempUserPassword';

const MAIL_OAUTH_ERROR_MESSAGES: Record<string, string> = {
  missing_code: 'Google не вернул код авторизации. Попробуйте ещё раз.',
  invalid_state: 'Сессия устарела или подделана. Откройте «Подключить» снова.',
  token_exchange: 'Не удалось обменять код на токен. Проверьте redirect URI и секреты OAuth.',
  no_access_token: 'Google не выдал access token.',
  userinfo: 'Не удалось получить email из Google.',
  no_email: 'В аккаунте Google не найден email.',
  upsert_failed: 'Не удалось сохранить привязку в базе.',
  save: 'Ошибка сохранения привязки.',
  access_denied: 'Доступ отклонён в окне Google.',
};

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
  const [defaultChatTab, setDefaultChatTab] = useState<ChatMainTab>(() => getChatDefaultTab(currentUser.id));

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [tgPhone, setTgPhone] = useState('');
  const [tgCode, setTgCode] = useState('');
  const [tgPassword, setTgPassword] = useState('');
  const [tgNeedPassword, setTgNeedPassword] = useState(false);
  const [tgBusy, setTgBusy] = useState(false);
  const [tgStatus, setTgStatus] = useState<{
    connected: boolean;
    apiConfigured: boolean;
    phoneMasked?: string | null;
  } | null>(null);
  const [mailOAuthStatus, setMailOAuthStatus] = useState<{
    configured: boolean;
    connected: boolean;
    provider?: string | null;
    accountEmail?: string | null;
  } | null>(null);
  const [mailBusy, setMailBusy] = useState(false);
  const [mailInboxOpen, setMailInboxOpen] = useState(false);
  const [mailMessages, setMailMessages] = useState<
    Array<{ id: string; subject?: string; from?: string; date?: string; snippet?: string }>
  >([]);
  const [mailMessagesBusy, setMailMessagesBusy] = useState(false);
  const [mailTo, setMailTo] = useState('');
  const [mailSubject, setMailSubject] = useState('');
  const [mailBody, setMailBody] = useState('');
  const [mailSendBusy, setMailSendBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // System dialogs state
  const [alertState, setAlertState] = useState<{ open: boolean; title: string; message: string }>({ open: false, title: '', message: '' });
  const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; message: string; onConfirm?: () => void; danger?: boolean }>({ open: false, title: '', message: '' });

  const showAlert = (title: string, message: string) => setAlertState({ open: true, title, message });
  const closeAlert = () => setAlertState((s) => ({ ...s, open: false }));
  const showConfirm = (title: string, message: string, onConfirm: () => void, danger = false) =>
    setConfirmState({ open: true, title, message, onConfirm, danger });
  const closeConfirm = () => setConfirmState((s) => ({ ...s, open: false }));

  useEffect(() => {
    void api.integrationsTelegramPersonal
      .status()
      .then((s) => setTgStatus({ connected: s.connected, apiConfigured: s.apiConfigured, phoneMasked: s.phoneMasked }))
      .catch(() => setTgStatus({ connected: false, apiConfigured: false }));
  }, []);

  useEffect(() => {
    void api.mailIntegration
      .status()
      .then((s) => setMailOAuthStatus(s))
      .catch(() => setMailOAuthStatus({ configured: false, connected: false }));
  }, []);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search);
    const connected = q.get('mail_connected');
    const errRaw = q.get('mail_error');
    if (connected === '1') {
      showAlert('Почта', 'Gmail успешно подключён.');
      void api.mailIntegration.status().then((s) => setMailOAuthStatus(s));
    }
    if (errRaw) {
      const human = MAIL_OAUTH_ERROR_MESSAGES[errRaw] ?? errRaw;
      showAlert('Ошибка подключения почты', human);
    }
    if (connected === '1' || errRaw) {
      const u = new URL(window.location.href);
      u.searchParams.delete('mail_connected');
      u.searchParams.delete('mail_error');
      const next = u.pathname + (u.search ? u.search : '') + u.hash;
      window.history.replaceState(null, '', next);
    }
  }, []);

  const handleMailConnect = async () => {
    setMailBusy(true);
    try {
      await ensureAuthCsrfCookie();
      const { url } = await api.mailIntegration.googleAuthorize();
      window.location.href = url;
    } catch {
      showAlert('Почта', 'Не удалось начать вход через Google. Проверьте, что OAuth настроен на сервере.');
    } finally {
      setMailBusy(false);
    }
  };

  const handleMailDisconnect = () => {
    showConfirm('Отключить Gmail?', 'Отправка и чтение писем из Taska для этого аккаунта будут недоступны.', async () => {
      closeConfirm();
      setMailBusy(true);
      try {
        await ensureAuthCsrfCookie();
        await api.mailIntegration.disconnect();
        const s = await api.mailIntegration.status();
        setMailOAuthStatus(s);
        setMailMessages([]);
        setMailInboxOpen(false);
      } catch {
        showAlert('Почта', 'Не удалось отключить интеграцию.');
      } finally {
        setMailBusy(false);
      }
    });
  };

  const handleLoadMailMessages = async () => {
    if (mailMessagesBusy) return;
    setMailMessagesBusy(true);
    try {
      const list = await api.mail.messages(15);
      setMailMessages(Array.isArray(list) ? list : []);
    } catch {
      showAlert('Почта', 'Не удалось загрузить список писем. Проверьте подключение Gmail.');
    } finally {
      setMailMessagesBusy(false);
    }
  };

  const handleSendMail = async (e: React.FormEvent) => {
    e.preventDefault();
    const to = mailTo.trim();
    if (!to) {
      showAlert('Почта', 'Укажите адрес получателя.');
      return;
    }
    setMailSendBusy(true);
    try {
      await ensureAuthCsrfCookie();
      await api.mail.send({ to, subject: mailSubject, body: mailBody });
      showAlert('Почта', 'Сообщение отправлено.');
      setMailSubject('');
      setMailBody('');
      if (mailInboxOpen) void handleLoadMailMessages();
    } catch {
      showAlert('Почта', 'Не удалось отправить письмо.');
    } finally {
      setMailSendBusy(false);
    }
  };

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
      setDefaultChatTab(getChatDefaultTab(currentUser.id));
  }, [currentUser]);

  const handleSaveProfile = async (e: React.FormEvent) => {
      e.preventDefault();

      const { password: _dropPwd, ...userWithoutPwd } = currentUser;
      const updates: User = {
          ...userWithoutPwd,
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

      if (!file.type.startsWith('image/')) {
          showAlert('Неверный формат', 'Пожалуйста, выберите изображение');
          return;
      }

      if (file.size > 5 * 1024 * 1024) {
          showAlert('Файл слишком большой', 'Размер файла не должен превышать 5MB');
          return;
      }

      setIsUploadingAvatar(true);
      try {
          const result = await uploadAvatar(file, currentUser.id);
          setProfileAvatar(result.url);
          const { password: _dropPwd, ...userWithoutPwd } = currentUser;
          const updates: User = {
              ...userWithoutPwd,
              avatar: result.url
          };
          onUpdateProfile(updates);
      } catch (error) {
          console.error('Ошибка загрузки аватара:', error);
          showAlert('Ошибка загрузки', 'Ошибка при загрузке аватара. Попробуйте ещё раз.');
      } finally {
          setIsUploadingAvatar(false);
          if (avatarInputRef.current) {
              avatarInputRef.current.value = '';
          }
      }
  };

  const handleDeleteUser = (id: string) => {
      if (id === currentUser.id) {
          showAlert('Ошибка', 'Нельзя удалить текущего пользователя');
          return;
      }
      showConfirm(
        'Удалить пользователя',
        'Это действие нельзя отменить. Пользователь будет архивирован.',
        () => {
          const now = new Date().toISOString();
          const updatedUsers = users.map(u =>
              u.id === id
                  ? { ...u, isArchived: true, updatedAt: now }
                  : { ...u, updatedAt: u.updatedAt || now }
          );
          onUpdateUsers(updatedUsers);
        },
        true
      );
  };

  const handleResetPassword = (id: string) => {
    showConfirm(
      'Сбросить пароль',
      'Сгенерировать временный пароль? Пользователь должен сменить его при входе.',
      () => {
        void (async () => {
          const temp = generateTempUserPassword();
          try {
            const payload = users.map((u) => {
              const row: Record<string, unknown> = {
                id: u.id,
                name: u.name,
                roleId: u.roleId,
                login: u.login ?? '',
                email: u.email,
                phone: u.phone,
                telegram: u.telegram,
                telegramUserId: u.telegramUserId,
                avatar: u.avatar,
                isArchived: u.isArchived ?? false,
                mustChangePassword: u.mustChangePassword ?? false,
              };
              if (u.id === id) {
                row.password = temp;
                row.mustChangePassword = true;
              }
              return row;
            });
            await api.users.updateAll(payload);
            onUpdateUsers(
              users.map((u) => (u.id === id ? { ...u, mustChangePassword: true, password: undefined } : u))
            );
            try {
              await navigator.clipboard.writeText(temp);
            } catch {
              /* ignore */
            }
            showAlert(
              'Пароль сброшен',
              `Временный пароль (скопирован в буфер): ${temp}. Пользователь должен сменить его при входе.`
            );
          } catch {
            showAlert('Ошибка', 'Не удалось сбросить пароль. Проверьте права access.users и сеть.');
          }
        })();
      }
    );
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
      showAlert('Ошибка', 'Не удалось получить ссылку для календаря. Проверьте сеть и авторизацию.');
    } finally {
      setCalendarBusy(false);
    }
  };

  const handleTgSendCode = async () => {
    const p = tgPhone.trim();
    if (!p) {
      showAlert('Укажите номер', 'Укажите номер в международном формате, например +998901234567');
      return;
    }
    setTgBusy(true);
    try {
      await api.integrationsTelegramPersonal.sendCode({ phone: p });
      showAlert('Готово', 'Код отправлен в Telegram.');
    } catch {
      showAlert('Ошибка', 'Не удалось отправить код. Проверьте номер и настройки API на сервере.');
    } finally {
      setTgBusy(false);
    }
  };

  const handleTgSignIn = async () => {
    setTgBusy(true);
    try {
      const r = await api.integrationsTelegramPersonal.signIn({ phone: tgPhone.trim(), code: tgCode.trim() });
      if (r.needPassword) {
        setTgNeedPassword(true);
        return;
      }
      setTgNeedPassword(false);
      setTgCode('');
      const s = await api.integrationsTelegramPersonal.status();
      setTgStatus({ connected: s.connected, apiConfigured: s.apiConfigured, phoneMasked: s.phoneMasked });
      showAlert('Готово', 'Telegram подключён.');
    } catch {
      showAlert('Ошибка', 'Неверный код или сессия устарела. Запросите код снова.');
    } finally {
      setTgBusy(false);
    }
  };

  const handleTgPassword = async () => {
    const p = tgPassword.trim();
    if (!p) return;
    setTgBusy(true);
    try {
      await api.integrationsTelegramPersonal.password({ password: p });
      setTgNeedPassword(false);
      setTgPassword('');
      const s = await api.integrationsTelegramPersonal.status();
      setTgStatus({ connected: s.connected, apiConfigured: s.apiConfigured, phoneMasked: s.phoneMasked });
      showAlert('Готово', 'Telegram подключён.');
    } catch {
      showAlert('Ошибка', 'Неверный пароль 2FA.');
    } finally {
      setTgBusy(false);
    }
  };

  const handleTgDisconnect = () => {
    showConfirm(
      'Отключить Telegram',
      'Отключить личный Telegram? Понадобится войти снова.',
      () => {
        void (async () => {
          setTgBusy(true);
          try {
            await api.integrationsTelegramPersonal.disconnect();
            const s = await api.integrationsTelegramPersonal.status();
            setTgStatus({ connected: s.connected, apiConfigured: s.apiConfigured, phoneMasked: s.phoneMasked });
            setTgCode('');
            setTgPassword('');
            setTgNeedPassword(false);
          } catch {
            showAlert('Ошибка', 'Не удалось отключить.');
          } finally {
            setTgBusy(false);
          }
        })();
      },
      true
    );
  };

  const handleRotateCalendarLink = () => {
    showConfirm(
      'Новый URL подписки',
      'Сгенерировать новую ссылку? Подписка в Google Calendar по старому URL перестанет обновляться.',
      () => {
        void (async () => {
          setCalendarBusy(true);
          try {
            await api.calendar.ensureExportToken({ rotate: true });
            const me = (await api.users.getMe()) as User;
            onUpdateProfile({ ...currentUser, ...me });
          } catch {
            showAlert('Ошибка', 'Не удалось обновить ссылку.');
          } finally {
            setCalendarBusy(false);
          }
        })();
      }
    );
  };

  const handleRevokeCalendarLink = () => {
    showConfirm(
      'Отозвать ссылку',
      'Отозвать ссылку? Подписка в Google Calendar по этому URL перестанет работать.',
      () => {
        void (async () => {
          setCalendarBusy(true);
          try {
            await api.calendar.ensureExportToken({ revoke: true });
            const me = (await api.users.getMe()) as User;
            onUpdateProfile({ ...currentUser, ...me });
          } catch {
            showAlert('Ошибка', 'Не удалось отозвать ссылку.');
          } finally {
            setCalendarBusy(false);
          }
        })();
      },
      true
    );
  };

  const submitPasswordChange = () => {
    const p1 = newPassword.trim();
    const p2 = confirmPassword.trim();
    if (!p1) return;
    if (p1 !== p2) return; // button is disabled when passwords don't match — defensive guard
    onUpdateProfile({ ...currentUser, password: p1, mustChangePassword: false });
    setPasswordModalOpen(false);
    setNewPassword('');
    setConfirmPassword('');
  };

  const dialogs = (
    <>
      <SystemAlertDialog
        open={alertState.open}
        title={alertState.title}
        message={alertState.message}
        onClose={closeAlert}
      />
      <SystemConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        onCancel={closeConfirm}
        onConfirm={() => { closeConfirm(); confirmState.onConfirm?.(); }}
        danger={confirmState.danger}
      />
    </>
  );

  if (activeTab === 'profile') {
      return (
        <>
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

                  <div className="space-y-3">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Основной чат по умолчанию</label>
                          <div className="flex items-center gap-1.5">
                              <button
                                  type="button"
                                  onClick={() => {
                                      setDefaultChatTab('team');
                                      setChatDefaultTab(currentUser.id, 'team');
                                  }}
                                  className={`px-3 h-9 rounded-lg text-sm font-semibold transition-colors ${
                                      defaultChatTab === 'team'
                                          ? 'bg-[#3337AD] text-white'
                                          : 'bg-white dark:bg-[#252525] text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-[#333] hover:border-[#3337AD]/40'
                                  }`}
                              >
                                  Сотрудники
                              </button>
                              <button
                                  type="button"
                                  onClick={() => {
                                      setDefaultChatTab('clients');
                                      setChatDefaultTab(currentUser.id, 'clients');
                                  }}
                                  className={`px-3 h-9 rounded-lg text-sm font-semibold transition-colors ${
                                      defaultChatTab === 'clients'
                                          ? 'bg-[#3337AD] text-white'
                                          : 'bg-white dark:bg-[#252525] text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-[#333] hover:border-[#3337AD]/40'
                                  }`}
                              >
                                  Клиенты
                              </button>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                              Эта вкладка будет открываться первой в чате.
                          </p>
                      </div>
                  </div>

                  <div className="bg-sky-50/90 dark:bg-[#1a2430] p-5 rounded-xl border border-sky-200/80 dark:border-sky-900/40 space-y-3">
                    <div className="flex items-start gap-3">
                      <MessageCircle className="text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" size={20} />
                      <div className="min-w-0 flex-1 space-y-3">
                        <div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white">Telegram — личный аккаунт</div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">
                            Переписка с клиентами в разделе «Клиенты» от вашего пользователя Telegram. Нужны{' '}
                            <code className="text-[11px]">TELEGRAM_API_ID</code> и{' '}
                            <code className="text-[11px]">TELEGRAM_API_HASH</code> в окружении сервера (сайт my.telegram.org).
                          </p>
                        </div>
                        {tgStatus && !tgStatus.apiConfigured && (
                          <p className="text-xs text-amber-800 dark:text-amber-200/90">
                            API не настроен на сервере — интеграция недоступна, пока админ не задаст переменные.
                          </p>
                        )}
                        {tgStatus?.connected ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-gray-800 dark:text-gray-200">
                              Подключено{tgStatus.phoneMasked ? ` (${tgStatus.phoneMasked})` : ''}
                            </span>
                            <button
                              type="button"
                              disabled={tgBusy}
                              onClick={() => handleTgDisconnect()}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-sky-300 dark:border-sky-700 text-sky-900 dark:text-sky-100 hover:bg-sky-100/80 dark:hover:bg-sky-950/50 disabled:opacity-50"
                            >
                              Отключить
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {!tgNeedPassword ? (
                              <>
                                <input
                                  value={tgPhone}
                                  onChange={(e) => setTgPhone(e.target.value)}
                                  className="w-full border border-sky-200 dark:border-sky-800 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-gray-100"
                                  placeholder="+998… номер Telegram"
                                  disabled={tgBusy}
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    disabled={tgBusy}
                                    onClick={() => void handleTgSendCode()}
                                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50"
                                  >
                                    Получить код
                                  </button>
                                </div>
                                <div className="flex gap-2 items-center">
                                  <input
                                    value={tgCode}
                                    onChange={(e) => setTgCode(e.target.value)}
                                    className="flex-1 border border-sky-200 dark:border-sky-800 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#1a1a1a]"
                                    placeholder="Код из Telegram"
                                    disabled={tgBusy}
                                  />
                                  <button
                                    type="button"
                                    disabled={tgBusy || !tgCode.trim()}
                                    onClick={() => void handleTgSignIn()}
                                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#3337AD] text-white hover:opacity-95 disabled:opacity-50"
                                  >
                                    Войти
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="flex gap-2 items-center">
                                <input
                                  type="password"
                                  value={tgPassword}
                                  onChange={(e) => setTgPassword(e.target.value)}
                                  className="flex-1 border border-sky-200 dark:border-sky-800 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#1a1a1a]"
                                  placeholder="Пароль двухэтапной аутентификации"
                                  disabled={tgBusy}
                                />
                                <button
                                  type="button"
                                  disabled={tgBusy || !tgPassword.trim()}
                                  onClick={() => void handleTgPassword()}
                                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#3337AD] text-white disabled:opacity-50"
                                >
                                  OK
                                </button>
                              </div>
                            )}
                          </div>
                        )}
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
                                onClick={() => handleRotateCalendarLink()}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-gray-300 dark:border-[#555] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#333] disabled:opacity-50"
                                title="Новый секретный URL"
                              >
                                <RefreshCw size={14} /> Новый URL
                              </button>
                              <button
                                type="button"
                                disabled={calendarBusy}
                                onClick={() => handleRevokeCalendarLink()}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-red-300 dark:border-red-900 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                                title="Отключить подписку по ссылке"
                              >
                                <Trash2 size={14} /> Отозвать
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

                  <div className="bg-gray-50 dark:bg-[#202020] p-5 rounded-xl border border-gray-200 dark:border-[#333] space-y-3">
                    <div className="flex items-start gap-3">
                      <Inbox className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={20} />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="text-sm font-bold text-gray-900 dark:text-white">Gmail</div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                          Подключите Google-аккаунт через OAuth: чтение входящих и отправка писем с вашего адреса в Taska. Доступы настраиваются в Google (экран согласия).
                        </p>
                        {mailOAuthStatus && !mailOAuthStatus.configured && (
                          <p className="text-xs text-amber-700 dark:text-amber-400/90">
                            На сервере не заданы GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET — попросите администратора.
                          </p>
                        )}
                        {mailOAuthStatus?.configured && !mailOAuthStatus.connected && (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              disabled={mailBusy}
                              onClick={() => void handleMailConnect()}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                            >
                              Подключить Google
                            </button>
                          </div>
                        )}
                        {mailOAuthStatus?.connected && (
                          <div className="space-y-3 pt-1">
                            <div className="text-xs text-gray-600 dark:text-gray-300">
                              Подключено: <span className="font-mono font-medium">{mailOAuthStatus.accountEmail || 'Gmail'}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={mailBusy}
                                onClick={() => void handleMailDisconnect()}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                              >
                                <Trash2 size={14} /> Отключить Gmail
                              </button>
                              <button
                                type="button"
                                disabled={mailBusy}
                                onClick={() => {
                                  setMailInboxOpen((o) => {
                                    const open = !o;
                                    if (open) void handleLoadMailMessages();
                                    return open;
                                  });
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-gray-300 dark:border-[#555] text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#333] disabled:opacity-50"
                              >
                                {mailInboxOpen ? 'Скрыть письма и отправку' : 'Письма и отправка'}
                              </button>
                            </div>
                            {mailInboxOpen && (
                              <div className="mt-2 space-y-4 border-t border-gray-200 dark:border-[#444] pt-3">
                                <div>
                                  <div className="flex items-center justify-between gap-2 mb-2">
                                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">Входящие (последние)</span>
                                    <button
                                      type="button"
                                      disabled={mailMessagesBusy}
                                      onClick={() => void handleLoadMailMessages()}
                                      className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                                    >
                                      {mailMessagesBusy ? 'Загрузка…' : 'Обновить'}
                                    </button>
                                  </div>
                                  {mailMessages.length === 0 && !mailMessagesBusy && (
                                    <p className="text-xs text-gray-500">Нажмите «Обновить», чтобы подгрузить письма.</p>
                                  )}
                                  <ul className="max-h-56 overflow-y-auto space-y-2 text-xs">
                                    {mailMessages.map((m) => (
                                      <li
                                        key={m.id}
                                        className="rounded-lg border border-gray-200 dark:border-[#444] bg-white/60 dark:bg-[#1a1a1a] px-2 py-1.5"
                                      >
                                        <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{m.subject || '(без темы)'}</div>
                                        <div className="text-gray-500 dark:text-gray-400 truncate">{m.from}</div>
                                        {m.date ? <div className="text-gray-400 dark:text-gray-500">{m.date}</div> : null}
                                        {m.snippet ? <div className="text-gray-600 dark:text-gray-400 line-clamp-2 mt-0.5">{m.snippet}</div> : null}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <form onSubmit={handleSendMail} className="space-y-2">
                                  <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">Отправить письмо</div>
                                  <input
                                    type="email"
                                    value={mailTo}
                                    onChange={(e) => setMailTo(e.target.value)}
                                    placeholder="Кому"
                                    className="w-full border border-gray-200 dark:border-[#444] rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#1a1a1a]"
                                    disabled={mailSendBusy}
                                  />
                                  <input
                                    type="text"
                                    value={mailSubject}
                                    onChange={(e) => setMailSubject(e.target.value)}
                                    placeholder="Тема"
                                    className="w-full border border-gray-200 dark:border-[#444] rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#1a1a1a]"
                                    disabled={mailSendBusy}
                                  />
                                  <textarea
                                    value={mailBody}
                                    onChange={(e) => setMailBody(e.target.value)}
                                    placeholder="Текст письма"
                                    rows={4}
                                    className="w-full border border-gray-200 dark:border-[#444] rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#1a1a1a] resize-y min-h-[80px]"
                                    disabled={mailSendBusy}
                                  />
                                  <button
                                    type="submit"
                                    disabled={mailSendBusy || !mailTo.trim()}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                                  >
                                    <Send size={16} /> Отправить
                                  </button>
                                </form>
                              </div>
                            )}
                          </div>
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
                  <p className="text-xs text-gray-500 dark:text-gray-400">Минимум 6 символов.</p>
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
          {dialogs}
        </>
      );
  }

  if (activeTab === 'users') {
      return (
        <>
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
          {dialogs}
        </>
      );
  }

  return null;
};
