import React, { useEffect, useMemo, useState } from 'react';
import type { AppRole, User } from '../../types';
import { Role as LegacyRole } from '../../types';
import { api } from '../../backend/api';
import { hasPermission } from '../../utils/permissions';
import { Button, Input, StandardModal, SystemAlertDialog, SystemConfirmDialog } from '../ui';
import { KeyRound, Trash2, Shield, ChevronRight, ArrowLeft } from 'lucide-react';
import { UserAvatar } from '../features/common/UserAvatar';

type PermCatalog = {
  groups: Array<{ id: string; label: string; items: Array<{ key: string; label: string }> }>;
  allKeys: string[];
};

/** null — ничего не выбрано; 'roles' — управление ролями; 'new' — создание; иначе id пользователя */
type AccessPanel = null | 'roles' | 'new' | string;

interface AccessSettingsProps {
  currentUser: User;
  users: User[];
  onUpdateUsers: (users: User[]) => void;
  /** Сигнал от кнопки "+" в верхней панели для открытия формы создания */
  openNewUserSignal?: number;
}

function normalizeLegacyRole(meta: AppRole | undefined): LegacyRole {
  return meta?.slug === 'admin' ? LegacyRole.ADMIN : LegacyRole.EMPLOYEE;
}

export const AccessSettings: React.FC<AccessSettingsProps> = ({
  currentUser,
  users,
  onUpdateUsers,
  openNewUserSignal = 0,
}) => {
  const canUsers = hasPermission(currentUser, 'access.users');
  const canRoles = hasPermission(currentUser, 'access.roles');

  const [panel, setPanel] = useState<AccessPanel>(() => {
    if (canUsers) return null;
    if (canRoles) return 'roles';
    return null;
  });

  const [roleList, setRoleList] = useState<AppRole[]>([]);
  const [permCatalog, setPermCatalog] = useState<PermCatalog | null>(null);
  const [busy, setBusy] = useState(false);

  const [newUserName, setNewUserName] = useState('');
  const [newUserLogin, setNewUserLogin] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRoleId, setNewUserRoleId] = useState<string>('');

  const [newRoleName, setNewRoleName] = useState('');
  const [editingRole, setEditingRole] = useState<AppRole | null>(null);
  const [editRolePerms, setEditRolePerms] = useState<string[]>([]);

  const [profileDraft, setProfileDraft] = useState({
    name: '',
    login: '',
    email: '',
    phone: '',
    telegram: '',
  });

  // System dialogs state
  const [alertState, setAlertState] = useState<{ open: boolean; title: string; message: string }>({ open: false, title: '', message: '' });
  const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; message: string; onConfirm?: () => void; danger?: boolean }>({ open: false, title: '', message: '' });

  const showAlert = (title: string, message: string) => setAlertState({ open: true, title, message });
  const closeAlert = () => setAlertState((s) => ({ ...s, open: false }));
  const showConfirm = (title: string, message: string, onConfirm: () => void, danger = false) =>
    setConfirmState({ open: true, title, message, onConfirm, danger });
  const closeConfirm = () => setConfirmState((s) => ({ ...s, open: false }));

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!canUsers && !canRoles) return;
      try {
        const [roles, catalog] = await Promise.all([
          canUsers || canRoles ? api.users.getRoles() : Promise.resolve([]),
          canRoles ? api.users.getPermissionsCatalog() : Promise.resolve(null),
        ]);
        if (!alive) return;
        setRoleList((roles || []) as AppRole[]);
        if (catalog) setPermCatalog(catalog);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, [canUsers, canRoles]);

  useEffect(() => {
    if (!newUserRoleId) {
      const fallback = roleList.find((r) => r.slug === 'employee')?.id || roleList[0]?.id || '';
      setNewUserRoleId(fallback);
    }
  }, [roleList, newUserRoleId]);

  const activeUsers = useMemo(() => users.filter((u) => !u.isArchived), [users]);

  const selectedUser = useMemo(() => {
    if (!panel || panel === 'roles' || panel === 'new') return null;
    return activeUsers.find((u) => u.id === panel) ?? null;
  }, [panel, activeUsers]);

  useEffect(() => {
    if (panel && panel !== 'roles' && panel !== 'new' && !selectedUser) {
      setPanel(null);
    }
  }, [panel, selectedUser]);

  useEffect(() => {
    if (selectedUser) {
      setProfileDraft({
        name: selectedUser.name,
        login: selectedUser.login || '',
        email: selectedUser.email || '',
        phone: selectedUser.phone || '',
        telegram: selectedUser.telegram || '',
      });
    }
  }, [selectedUser?.id]);

  useEffect(() => {
    if (!canUsers) return;
    if (openNewUserSignal > 0) {
      setPanel('new');
    }
  }, [openNewUserSignal, canUsers]);

  const handleResetPassword = (id: string) => {
    showConfirm(
      'Сбросить пароль',
      'Сгенерировать временный пароль? Пользователь должен сменить его при входе.',
      () => {
        const bytes = new Uint8Array(10);
        crypto.getRandomValues(bytes);
        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
        const temp = `Tmp${hex}a1`;
        onUpdateUsers(users.map((u) => (u.id === id ? { ...u, password: temp, mustChangePassword: true } : u)));
        void navigator.clipboard.writeText(temp).catch(() => {});
        showAlert('Пароль сброшен', `Временный пароль (скопирован в буфер): ${temp}. Пользователь должен сменить его при входе.`);
      }
    );
  };

  const handleArchiveUser = (id: string) => {
    if (id === currentUser.id) {
      showAlert('Ошибка', 'Нельзя архивировать текущего пользователя');
      return;
    }
    showConfirm(
      'Архивировать пользователя',
      'Пользователь будет скрыт из системы.',
      () => {
        const now = new Date().toISOString();
        onUpdateUsers(users.map((u) => (u.id === id ? { ...u, isArchived: true, updatedAt: now } : u)));
        setPanel(null);
      },
      true
    );
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newUserName.trim();
    const login = newUserLogin.trim();
    const password = newUserPassword.trim();
    if (!name || !login) return;

    const meta = roleList.find((r) => r.id === newUserRoleId);
    const newUser: User = {
      id: `u-${Date.now()}`,
      name,
      login,
      ...(password ? { password } : {}),
      roleId: newUserRoleId || meta?.id,
      roleName: meta?.name,
      roleSlug: meta?.slug,
      role: normalizeLegacyRole(meta),
      mustChangePassword: true,
      updatedAt: new Date().toISOString(),
    };

    onUpdateUsers([...(users || []), newUser]);
    setNewUserName('');
    setNewUserLogin('');
    setNewUserPassword('');
    setPanel(newUser.id);
  };

  const handleSaveProfile = () => {
    if (!selectedUser) return;
    const name = profileDraft.name.trim();
    if (!name) {
      showAlert('Ошибка', 'Укажите имя');
      return;
    }
    onUpdateUsers(
      users.map((u) =>
        u.id === selectedUser.id
          ? {
              ...u,
              name,
              login: profileDraft.login.trim() || undefined,
              email: profileDraft.email.trim() || undefined,
              phone: profileDraft.phone.trim() || undefined,
              telegram: profileDraft.telegram.trim() || undefined,
              updatedAt: new Date().toISOString(),
            }
          : u
      )
    );
  };

  const handleCreateRole = async () => {
    const name = newRoleName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await api.users.createRole({ name, permissions: [] });
      setNewRoleName('');
      const list = (await api.users.getRoles()) as AppRole[];
      setRoleList(list);
      showAlert('Роль создана', 'Откройте её и настройте доступы.');
    } catch (e: unknown) {
      showAlert('Ошибка', e instanceof Error ? e.message : 'Не удалось создать роль');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRole = (id: string) => {
    showConfirm(
      'Удалить роль',
      'Удалить роль? Только если на роль никто не назначен.',
      () => {
        void (async () => {
          setBusy(true);
          try {
            await api.users.deleteRole(id);
            const list = (await api.users.getRoles()) as AppRole[];
            setRoleList(list);
          } catch (e: unknown) {
            showAlert('Ошибка', e instanceof Error ? e.message : 'Не удалось удалить роль');
          } finally {
            setBusy(false);
          }
        })();
      },
      true
    );
  };

  const handleSaveRolePerms = async () => {
    if (!editingRole) return;
    setBusy(true);
    try {
      await api.users.patchRole(editingRole.id, { permissions: editRolePerms });
      const list = (await api.users.getRoles()) as AppRole[];
      setRoleList(list);
      setEditingRole(null);
      showAlert('Сохранено', 'Права роли обновлены.');
    } catch (e: unknown) {
      showAlert('Ошибка', e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  const rolesBlock = canRoles ? (
    <div className="space-y-4">
      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-4 md:p-6">
        <div className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Новая роль</div>
        <div className="flex flex-wrap gap-2">
          <Input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="Менеджер продаж" fullWidth />
          <Button onClick={() => void handleCreateRole()} disabled={busy || !newRoleName.trim()}>
            Создать роль
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {roleList.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 p-4 rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525]"
          >
            <div className="min-w-0">
              <div className="font-semibold text-sm text-gray-900 dark:text-white">{r.name}</div>
              <div className="text-xs text-gray-500">{r.slug}</div>
              {r.isSystem && (
                <div className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400 mt-1">Системная</div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingRole(r);
                  setEditRolePerms([...(r.permissions || [])]);
                }}
              >
                <Shield size={16} /> Права доступа
              </Button>
              {!r.isSystem && (
                <Button variant="secondary" onClick={() => handleDeleteRole(r.id)} disabled={busy}>
                  Удалить
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <StandardModal
        isOpen={!!editingRole}
        onClose={() => setEditingRole(null)}
        title={editingRole ? `Права: ${editingRole.name}` : 'Права'}
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditingRole(null)}>
              Отмена
            </Button>
            <Button onClick={() => void handleSaveRolePerms()} disabled={busy || !editingRole}>
              Сохранить
            </Button>
          </div>
        }
      >
        {!permCatalog ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">Не удалось загрузить каталог прав.</div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
            {permCatalog.groups.map((g) => (
              <div key={g.id}>
                <div className="text-xs font-bold text-gray-400 uppercase mb-2">{g.label}</div>
                <div className="space-y-2">
                  {g.items.map((it) => (
                    <label key={it.key} className="flex items-start gap-2 text-sm text-gray-800 dark:text-gray-200 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1 rounded border-gray-300"
                        checked={editRolePerms.includes(it.key)}
                        onChange={() => {
                          setEditRolePerms((prev) =>
                            prev.includes(it.key) ? prev.filter((x) => x !== it.key) : [...prev, it.key]
                          );
                        }}
                      />
                      <span>{it.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </StandardModal>
    </div>
  ) : null;

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

  if (!canUsers && !canRoles) {
    return (
      <>
        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-6 text-sm text-gray-600 dark:text-gray-300">
          Нет доступа к настройкам пользователей/ролей.
        </div>
        {dialogs}
      </>
    );
  }

  if (!canUsers && canRoles) {
    return (
      <>
        <div className="space-y-4">{rolesBlock}</div>
        {dialogs}
      </>
    );
  }

  const listColumn = (
    <div className="flex h-full min-h-0 flex-col md:w-[min(100%,22rem)] shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-[#333] dark:bg-[#252525]">
      <div className="shrink-0 border-b border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-[#333] dark:bg-[#202020]">
        <span className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Пользователи</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left text-sm">
          <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
            {canRoles && (
              <tr
                onClick={() => setPanel('roles')}
                className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2a2a2a] ${
                  panel === 'roles' ? 'bg-slate-100 dark:bg-slate-800/50' : ''
                }`}
              >
                <td className="pl-3 pr-1 py-2.5 w-10 align-middle text-amber-600 dark:text-amber-400">
                  <Shield size={18} />
                </td>
                <td className="py-2.5 pr-1 align-middle">
                  <div className="font-semibold text-gray-900 dark:text-white">Роли и доступ</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">Создание ролей и права</div>
                </td>
                <td className="pr-2 py-2.5 w-8 text-gray-400 align-middle">
                  <ChevronRight size={16} className="ml-auto" />
                </td>
              </tr>
            )}
            {activeUsers.map((user) => (
              <tr
                key={user.id}
                onClick={() => setPanel(user.id)}
                className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2a2a2a] ${
                  panel === user.id ? 'bg-slate-100 dark:bg-slate-800/50' : ''
                }`}
              >
                <td className="pl-3 pr-1 py-2.5 align-middle">
                  <UserAvatar user={user} size="sm" />
                </td>
                <td className="py-2.5 pr-1 align-middle min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-white truncate">{user.name}</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{user.login || '—'}</div>
                </td>
                <td className="pr-2 py-2.5 w-8 text-gray-400 align-middle">
                  <ChevronRight size={16} className="ml-auto opacity-60" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {activeUsers.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">Пока нет пользователей</div>
        )}
      </div>
    </div>
  );

  const detailColumn = (
    <div
      className={`flex min-h-0 h-full min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-[#333] dark:bg-[#252525] ${
        panel ? 'flex' : 'hidden md:flex'
      }`}
    >
      {!panel && (
        <div className="flex-1 flex items-center justify-center p-8 text-center text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          Выберите пользователя в списке слева, откройте «Роли и доступ» или нажмите «+» в верхней панели, чтобы добавить пользователя и указать пароль и роль.
        </div>
      )}

      {panel === 'roles' && canRoles && (
        <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar md:p-6">{rolesBlock}</div>
      )}

      {panel === 'new' && canUsers && (
        <div className="flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto p-4 custom-scrollbar md:p-6">
          <div className="md:hidden flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => setPanel(null)}
              className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300"
            >
              <ArrowLeft size={18} /> Назад к списку
            </button>
          </div>
          <div className="text-sm font-semibold text-gray-900 dark:text-white">Новый пользователь</div>
          <form onSubmit={handleAddUser} className="space-y-3">
            <Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} label="Имя" placeholder="Имя Фамилия" />
            <Input value={newUserLogin} onChange={(e) => setNewUserLogin(e.target.value)} label="Логин" placeholder="ivan" />
            <Input
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              label="Пароль (опц.)"
              placeholder="Оставьте пустым для входа без пароля"
              type="password"
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Роль</label>
              <select
                value={newUserRoleId}
                onChange={(e) => setNewUserRoleId(e.target.value)}
                className="h-10 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-3 text-sm text-gray-900 dark:text-gray-100"
              >
                {roleList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={!newUserName.trim() || !newUserLogin.trim()}>
                Создать
              </Button>
              <Button type="button" variant="secondary" onClick={() => setPanel(null)}>
                Отмена
              </Button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">После первого входа пользователю покажется запрос на установку пароля.</p>
          </form>
        </div>
      )}

      {selectedUser && panel !== 'roles' && panel !== 'new' && (
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 custom-scrollbar md:p-6">
          <div className="flex items-start gap-3">
            <button
              type="button"
              className="md:hidden inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 shrink-0 mt-1"
              onClick={() => setPanel(null)}
            >
              <ArrowLeft size={18} />
            </button>
            <UserAvatar user={selectedUser} size="lg" />
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">{selectedUser.name}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{selectedUser.roleName || selectedUser.roleSlug || '—'}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Профиль</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input value={profileDraft.name} onChange={(e) => setProfileDraft((d) => ({ ...d, name: e.target.value }))} label="Имя" />
              <Input value={profileDraft.login} onChange={(e) => setProfileDraft((d) => ({ ...d, login: e.target.value }))} label="Логин" />
              <Input value={profileDraft.email} onChange={(e) => setProfileDraft((d) => ({ ...d, email: e.target.value }))} label="Email" />
              <Input value={profileDraft.phone} onChange={(e) => setProfileDraft((d) => ({ ...d, phone: e.target.value }))} label="Телефон" />
              <div className="sm:col-span-2">
                <Input
                  value={profileDraft.telegram}
                  onChange={(e) => setProfileDraft((d) => ({ ...d, telegram: e.target.value }))}
                  label="Telegram"
                  fullWidth
                />
              </div>
            </div>
            <Button type="button" onClick={handleSaveProfile}>
              Сохранить изменения
            </Button>
          </div>

          <div className="space-y-3 border-t border-gray-100 dark:border-[#333] pt-4">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Роль в системе</div>
            <select
              value={selectedUser.roleId || ''}
              onChange={(e) => {
                const rid = e.target.value;
                const meta = roleList.find((x) => x.id === rid);
                onUpdateUsers(
                  users.map((u) =>
                    u.id === selectedUser.id
                      ? {
                          ...u,
                          roleId: rid,
                          roleName: meta?.name,
                          roleSlug: meta?.slug,
                          role: normalizeLegacyRole(meta),
                          updatedAt: new Date().toISOString(),
                        }
                      : u
                  )
                );
              }}
              className="w-full max-w-md h-10 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-3 text-sm text-gray-900 dark:text-gray-100"
            >
              {roleList.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3 border-t border-gray-100 dark:border-[#333] pt-4">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Пароль</div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="secondary" onClick={() => handleResetPassword(selectedUser.id)}>
                <KeyRound size={16} /> Сбросить пароль
              </Button>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={!!selectedUser.mustChangePassword}
                  onChange={(e) => {
                    const next = e.target.checked;
                    onUpdateUsers(users.map((u) => (u.id === selectedUser.id ? { ...u, mustChangePassword: next } : u)));
                  }}
                />
                Сменить пароль при следующем входе
              </label>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-[#333] pt-4">
            <Button type="button" variant="secondary" onClick={() => handleArchiveUser(selectedUser.id)} className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30">
              <Trash2 size={16} /> В архив
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col items-stretch gap-4 md:flex-row">
        <div
          className={`${panel ? 'hidden md:flex' : 'flex'} h-full min-h-0 flex-1 flex-col md:h-full md:flex-none`}
        >
          {listColumn}
        </div>
        {detailColumn}
      </div>
      {dialogs}
    </>
  );
};
