import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { User } from '../types';
import { authEndpoint, orgEndpoint } from '../services/apiClient';
import { applyOrgBrandingToDocument } from '../utils/applyOrgBranding';

interface LoginViewProps {
  users: User[];
  onLogin: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ users: _users, onLogin }) => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [logoSvg, setLogoSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    orgEndpoint
      .getBranding()
      .then((d) => {
        if (cancelled) return;
        applyOrgBrandingToDocument(d);
        setLogoSvg(d.logoSvg?.trim() || null);
      })
      .catch(() => {
        if (!cancelled) applyOrgBrandingToDocument(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const safeLogo = logoSvg ? DOMPurify.sanitize(logoSvg, { USE_PROFILES: { svg: true } }) : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-[#121212] dark:to-[#1a1a1a] px-4 grid place-items-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4 [&_svg]:max-h-[120px] [&_svg]:w-auto">
            {safeLogo ? (
              // eslint-disable-next-line react/no-danger
              <span dangerouslySetInnerHTML={{ __html: safeLogo }} />
            ) : (
              <svg width="120" height="113" viewBox="0 0 591 556" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M258.496 1.89275C253.854 4.06275 103.741 154.079 100.093 160.195C96.715 165.856 95.877 169.796 97.064 174.425C97.975 177.979 106.015 186.331 162.085 241.98C225.192 304.612 226.066 305.533 226.031 309.389C225.988 314.136 231.165 308.765 97.522 442.736C45.807 494.576 2.708 538.444 1.746 540.22C0.784002 541.996 -0.00199619 544.356 3.80837e-06 545.464C0.00500381 548.148 3.393 553.587 5.893 554.925C7.303 555.679 56.106 555.921 170.197 555.739C327.472 555.488 332.62 555.421 336.496 553.574C341.547 551.167 477.482 415.888 482.698 408.078C490.728 396.052 493.164 379.215 488.88 365.335C484.82 352.18 481.146 347.921 426.02 292.48C397.583 263.88 373.769 239.451 373.101 238.192C372.432 236.934 372.13 235.132 372.43 234.188C372.73 233.244 422.029 183.436 481.985 123.504C581.696 23.8328 590.996 14.2607 590.996 11.3057C590.996 6.83375 589.33 3.60775 586.006 1.64475C583.407 0.109749 570.673 -0.0182526 422.842 0.00174745C268.346 0.0227474 262.35 0.0917463 258.496 1.89275ZM375.393 155.23C343.99 186.718 317.329 213.778 316.146 215.365C313.408 219.039 313.202 227.274 315.753 231.085C316.711 232.518 347.631 264.132 384.463 301.339C421.295 338.547 451.992 369.999 452.678 371.234C457.278 379.517 449.506 392.537 441.172 390.508C439.437 390.086 421.612 373.081 390.496 342.165C341.937 293.918 300.527 253.019 247.246 200.684C225.076 178.908 217.996 171.374 217.996 169.561C217.996 167.743 226.085 159.206 251.746 133.94C270.309 115.664 286.846 100.113 288.496 99.3838C290.892 98.3248 305.684 98.0498 361.993 98.0188L432.489 97.9798L375.393 155.23ZM271.596 349.878C273.741 351.472 289.833 367.162 307.356 384.744C332.67 410.143 339.091 417.106 338.607 418.63C338.272 419.685 329.785 428.702 319.747 438.668C305.01 453.298 300.726 456.997 297.496 457.878C292.284 459.299 158.28 459.419 154.561 458.005C153.15 457.468 151.996 456.248 151.996 455.292C151.996 453.589 253.71 352.192 258.885 348.737C262.754 346.153 267.11 346.545 271.596 349.878Z"
                  fill="var(--brand-primary, #F97316)"
                />
              </svg>
            )}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Типа задачи</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Система управления задачами</p>
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
                className="w-full px-4 py-3 border border-gray-300 dark:border-[#444] rounded-lg focus:ring-2 focus:ring-[var(--brand-primary,#F97316)] focus:border-transparent dark:bg-[#333] dark:text-white transition-all outline-none"
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
                className="w-full px-4 py-3 border border-gray-300 dark:border-[#444] rounded-lg focus:ring-2 focus:ring-[var(--brand-primary,#F97316)] focus:border-transparent dark:bg-[#333] dark:text-white transition-all outline-none"
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
              style={{ backgroundColor: 'var(--brand-primary, #F97316)' }}
              className="w-full hover:brightness-95 active:brightness-90 text-white font-semibold py-3 rounded-lg transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#F97316)] focus:ring-offset-2"
            >
              Войти
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
