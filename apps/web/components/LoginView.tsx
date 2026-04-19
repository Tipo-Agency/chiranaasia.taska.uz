import React, { useState } from 'react';
import { User } from '../types';
import { authEndpoint } from '../services/apiClient';
import { OrgBrandedLogo } from './OrgBrandedLogo';
import { orgHasCustomLogo } from '../utils/orgBrandingDisplay';
import { useOrgBranding } from '../contexts/OrgBrandingContext';

interface LoginViewProps {
  users: User[];
  onLogin: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ users: _users, onLogin }) => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { branding } = useOrgBranding();
  const custom = orgHasCustomLogo(branding);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedLogin = login.trim();
    const trimmedPassword = password.trim();

    if (!trimmedLogin || !trimmedPassword) {
      setError('Пожалуйста, введите логин и пароль');
      return;
    }

    try {
      const result = await authEndpoint.login(trimmedLogin, trimmedPassword);
      const user = result.user as User;
      setError('');
      onLogin(user);
    } catch {
      setError('Неверный логин или пароль');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-[#121212] dark:to-[#1a1a1a] px-4 grid place-items-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <OrgBrandedLogo variant="login" />
          </div>
          {!custom ? (
            <>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Типа задачи</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Система управления задачами</p>
            </>
          ) : null}
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-[#252525] p-8 rounded-2xl shadow-xl border border-gray-200 dark:border-[#333]"
        >
          <h2 className="text-xl font-semibold mb-6 text-center text-gray-800 dark:text-white">Вход в систему</h2>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Логин</label>
              <input
                value={login}
                onChange={(e) => {
                  setLogin(e.target.value);
                  setError('');
                }}
                placeholder="Введите логин"
                className="w-full px-4 py-3 border border-gray-300 dark:border-[#444] rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-transparent dark:bg-[#333] dark:text-white transition-all outline-none"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Введите пароль"
                className="w-full px-4 py-3 border border-gray-300 dark:border-[#444] rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-transparent dark:bg-[#333] dark:text-white transition-all outline-none"
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-lg p-3 text-center">
                {error}
              </div>
            )}
            <button
              type="submit"
              style={{ backgroundColor: 'var(--brand-primary)' }}
              className="w-full hover:brightness-95 active:brightness-90 text-white font-semibold py-3 rounded-lg transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:ring-offset-2"
            >
              Войти
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
