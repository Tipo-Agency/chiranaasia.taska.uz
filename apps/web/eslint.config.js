import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Строго: запрет console.log/debug/info (оставляем warn/error и devLog.ts).
 * any / неиспользуемые переменные — зона ответственности tsc и отдельных PR.
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '**/*.css'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      // Легаси: включение exhaustive-deps по всему фронту даёт десятки предупреждений; правим точечно в PR.
      'react-hooks/exhaustive-deps': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-case-declarations': 'off',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/utils/devLog.ts'],
    rules: { 'no-console': 'off' },
  }
);
