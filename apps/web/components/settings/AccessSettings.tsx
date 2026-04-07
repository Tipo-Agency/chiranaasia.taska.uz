import React, { useEffect, useMemo, useState } from 'react';
import type { AppRole, User } from '../../types';
import { Role as LegacyRole } from '../../types';
import { api } from '../../backend/api';
import { hasPermission } from '../../utils/permissions';
import { Button, Input, StandardModal } from '../ui';
import { KeyRound, Trash2, Shield } from 'lucide-react';

type AccessSubTab = 'users' | 'roles';

type PermCatalog = {
  groups: Array<{ id: string; label: string; items: Array<{ key: string; label: string }> }>;
  allKeys: string[];
};

interface AccessSettingsProps {
  currentUser: User;
  users: User[];
  onUpdateUsers: (users: User[]) => void;
}

function normalizeLegacyRole(meta: AppRole | undefined): LegacyRole {
  return meta?.slug === 'admin' ? LegacyRole.ADMIN : LegacyRole.EMPLOYEE;
}

export const AccessSettings: React.FC<AccessSettingsProps> = ({ currentUser, users, onUpdateUsers }) => {
  const canUsers = hasPermission(currentUser, 'access.users');
  const canRoles = hasPermission(currentUser, 'access.roles');

  const [subTab, setSubTab] = useState<AccessSubTab>(() => (canUsers ? 'users' : 'roles'));

  const [roleList, setRoleList] = useState<AppRole[]>([]);
  const [permCatalog, setPermCatalog] = useState<PermCatalog | null>(null);
  const [busy, setBusy] = useState(false);

  // Users: draft create
  const [newUserName, setNewUserName] = useState('');
  const [newUserLogin, setNewUserLogin] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRoleId, setNewUserRoleId] = useState<string>('');

  // Roles: create + edit perms
  const [newRoleName, setNewRoleName] = useState('');
  const [editingRole, setEditingRole] = useState<AppRole | null>(null);
  const [editRolePerms, setEditRolePerms] = useState<string[]>([]);

  useEffect(() => {
    // keep selected tab valid if permissions change
    if (subTab === 'users' && !canUsers && canRoles) setSubTab('roles');
    if (subTab === 'roles' && !canRoles && canUsers) setSubTab('users');
  }, [canUsers, canRoles, subTab]);

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
        setRoleList(((roles || []) as any) as AppRole[]);
        if (catalog) setPermCatalog(catalog as any);
      } catch {
        // ignore; UI will work with fallbacks
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

  const handleResetPassword = (id: string) => {
    if (!confirm('Сбросить пароль на "123"?')) return;
    onUpdateUsers(users.map((u) => (u.id === id ? { ...u, password: '123', mustChangePassword: true } : u)));
    alert('Пароль сброшен.');
  };

  const handleArchiveUser = (id: string) => {
    if (id === currentUser.id) {
      alert('Нельзя архивировать текущего пользователя');
      return;
    }
    if (!confirm('Архивировать пользователя?')) return;
    const now = new Date().toISOString();
    onUpdateUsers(users.map((u) => (u.id === id ? { ...u, isArchived: true, updatedAt: now } : u)));
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newUserName.trim();
    const login = newUserLogin.trim();
    const password = newUserPassword.trim() || '123';
    if (!name || !login) return;

    const meta = roleList.find((r) => r.id === newUserRoleId);
    const newUser: User = {
      id: `u-${Date.now()}`,
      name,
      login,
      password,
      roleId: newUserRoleId || meta?.id,
      roleName: meta?.name,
      roleSlug: meta?.slug,
      role: normalizeLegacyRole(meta),
      mustChangePassword: true,
      updatedAt: new Date().toISOString(),
    } as any;

    onUpdateUsers([...(users || []), newUser]);
    setNewUserName('');
    setNewUserLogin('');
    setNewUserPassword('');
  };

  const handleCreateRole = async () => {
    const name = newRoleName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await api.users.createRole({ name, permissions: [] });
      setNewRoleName('');
      const list = (await api.users.getRoles()) as any;
      setRoleList(list as AppRole[]);
      alert('Роль создана. Откройте её и настройте доступы.');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Не удалось создать роль');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (!confirm('Удалить роль? Только если на роль никто не назначен.')) return;
    setBusy(true);
    try {
      await api.users.deleteRole(id);
      const list = (await api.users.getRoles()) as any;
      setRoleList(list as AppRole[]);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Не удалось удалить роль');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveRolePerms = async () => {
    if (!editingRole) return;
    setBusy(true);
    try {
      await api.users.patchRole(editingRole.id, { permissions: editRolePerms });
      const list = (await api.users.getRoles()) as any;
      setRoleList(list as AppRole[]);
      setEditingRole(null);
      alert('Права роли обновлены.');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  if (!canUsers && !canRoles) {
    return (
      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-6 text-sm text-gray-600 dark:text-gray-300">
        Нет доступа к настройкам пользователей/ролей.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-[#333] pb-2">
        {canUsers && (
          <button
            type="button"
            onClick={() => setSubTab('users')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              subTab === 'users'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#252525]'
            }`}
          >
            Пользователи
          </button>
        )}
        {canRoles && (
          <button
            type="button"
            onClick={() => setSubTab('roles')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              subTab === 'roles'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#252525]'
            }`}
          >
            Роли и доступ
          </button>
        )}
      </div>

      {subTab === 'users' && canUsers && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-4 md:p-6">
            <div className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Добавить пользователя</div>
            <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} label="Имя" placeholder="Имя Фамилия" />
              <Input value={newUserLogin} onChange={(e) => setNewUserLogin(e.target.value)} label="Логин" placeholder="ivan" />
              <Input
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                label="Пароль (опц.)"
                placeholder="123"
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
              <div className="md:col-span-4 flex justify-end">
                <Button type="submit" disabled={!newUserName.trim() || !newUserLogin.trim()}>
                  Создать
                </Button>
              </div>
            </form>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              После первого входа пользователю покажется запрос на установку пароля.
            </div>
          </div>

          <div className="space-y-2">
            {activeUsers.map((user) => (
              <div
                key={user.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">{user.name}</div>
                  <div className="text-xs text-gray-500 truncate">{user.login || '—'}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{user.roleName || user.roleSlug || '—'}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={user.roleId || ''}
                    onChange={(e) => {
                      const rid = e.target.value;
                      const meta = roleList.find((x) => x.id === rid);
                      onUpdateUsers(
                        users.map((u) =>
                          u.id === user.id
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
                    className="h-9 text-xs border border-gray-200 dark:border-[#333] rounded-lg px-2 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-gray-100 max-w-[220px]"
                  >
                    {roleList.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleResetPassword(user.id)}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#303030] text-gray-500"
                    title="Сбросить пароль"
                  >
                    <KeyRound size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchiveUser(user.id)}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#303030] text-gray-500"
                    title="Архивировать"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'roles' && canRoles && (
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
                  {r.isSystem && <div className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400 mt-1">Системная</div>}
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
                    <Button variant="secondary" onClick={() => void handleDeleteRole(r.id)} disabled={busy}>
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
      )}
    </div>
  );
};

