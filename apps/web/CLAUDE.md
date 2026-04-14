# Web Frontend — Claude Guide

## Stack

- React 19, TypeScript ~5.8, Vite 6
- Tailwind CSS 3, Lucide React (icons)
- No UI component library — custom components only
- DOMPurify for HTML sanitization

Ориентиры: [`docs/FRONTEND.md`](../docs/FRONTEND.md), [`docs/DOCUMENTATION.md`](../docs/DOCUMENTATION.md). Смоук: `npm run build`; при необходимости `npm run lint` / `npm run typecheck` — локально или в [`.github/workflows/ci-web.yml`](../.github/workflows/ci-web.yml).

## Project layout

```
App.tsx              Root: public content-plan or providers + MainApp
routes/              View modules (DashboardRoutes, TaskRoutes, …), AuthGuard
providers/           AppProviders, AppShellProviders
index.tsx            Entry point (Vite)
constants/           App-wide constants

components/
  ui/                Primitives (Button, Modal, Input, etc.)
  modules/           CRMHubModule, FinanceModule, etc.
  pages/             WorkdeskView, TasksPage, etc.
  settings/          Settings tabs, integrations roadmap
  features/          chat/, deals/, tasks/, etc.
  admin/             Admin panel

frontend/
  MainApp.tsx        Post-login shell, AppRouter
  hooks/             useAppLogic + slices/
  stores/            Zustand: `uiToastStore`, `authScopeStore` (фаза L; расширять по доменам)
  contexts/          e.g. NotificationCenter

backend/
  api.ts             Unified api.* over endpoint modules

services/
  apiClient.ts       HTTP, CSRF, cookies, error handlers

types/               Domain TS files + index.ts barrel (no root types.ts)
utils/, hooks/, contexts/
integrations/        e.g. Instagram helpers
```

Сквозная схема фронта в репозитории — **`docs/ARCHITECTURE.md` §3.2**.

---

## Auth — critical rules

### JWT is in HttpOnly cookie — never in storage

```typescript
// ❌ BANNED — never do this:
sessionStorage.setItem('access_token', token)
localStorage.setItem('access_token', token)

// ✅ Correct: token is sent automatically by browser via cookie
// No manual token management needed in frontend code
```

### CSRF token — read from cookie, send as header

```typescript
// services/apiClient.ts
function getCsrfHeaders(method: string): Record<string, string> {
  const t = readCookie('csrf_token');  // NOT HttpOnly — readable by JS
  if (!t || ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) return {};
  return { 'X-CSRF-Token': t };
}
```

### Auth headers

```typescript
// ✅ Correct — no Authorization header, no token in body:
function getAuthHeaders(): Record<string, string> {
  return {};  // JWT cookie is attached automatically
}
```

### Logout

```typescript
// Correct logout flow:
// 1. Call POST /api/auth/logout (server clears cookies)
// 2. Clear active user ID from local state
// DO NOT try to delete cookies manually — HttpOnly cookies can't be deleted from JS
```

---

## HTML sanitization — mandatory

All user-generated HTML must go through DOMPurify before rendering.

```typescript
// utils/sanitizeDocHtml.ts — always use these, never bare innerHTML
import { sanitizeDocHtml, setDocEditorHtml, takeDocEditorHtml, escapeHtmlText } from '../utils/sanitizeDocHtml';

// ✅ Correct:
setDocEditorHtml(element, dirtyHtml);       // set innerHTML safely
const html = takeDocEditorHtml(element);     // read innerHTML
const safe = sanitizeDocHtml(dirtyHtml);     // get sanitized string

// ❌ BANNED:
element.innerHTML = userContent;             // XSS risk
```

`ALLOWED_TAGS` and `ALLOWED_ATTR` allowlists are in `sanitizeDocHtml.ts`.
`ALLOW_DATA_ATTR: false` — no data-* attributes allowed.

---

## API client

Низкоуровневые endpoint-объекты живут в **`services/apiClient.ts`**. Для фич **предпочтительно** единый фасад:

```typescript
import { api } from '../backend/api';

await api.clients.list();
await api.deals.getById(id);
```

Прямой импорт из `apiClient.ts` допустим для новых endpoint-модулей до добавления их в `backend/api.ts`.

The client automatically:

- Attaches CSRF token to mutating requests
- Handles 401 → triggers logout
- Sets `credentials: 'include'` for cookies

---

## TypeScript types

**Общие типы** — в каталоге **`types/`** с re-export в **`types/index.ts`**. Перед добавлением:

1. Поиск по `types/*.ts` и barrel `index.ts`
2. Локальные типы фичи — рядом с компонентом, если не шарятся
3. Новый домен — новый файл `types/<domain>.ts` + строка в `index.ts`

**Naming conventions:**

- `Client`, `Deal`, `Task`, `Meeting`, `Employee` — domain entities (match backend camelCase)
- `*Read` suffix — API response types
- `*Item` suffix — bulk PUT item types
- `*Payload` suffix — POST/PATCH request body types

---

## Component conventions

### No inline styles — use Tailwind only

```tsx
// ❌ BANNED:
<div style={{ color: 'red', marginTop: 8 }}>

// ✅ Correct:
<div className="text-red-500 mt-2">
```

### Icons — Lucide React only

```tsx
import { Plus, Search, ChevronDown } from 'lucide-react';
// Don't import SVGs or use emoji as icons
```

### State management

- Local state: `useState`, `useReducer`
- Server state: fetch in hooks (slices pattern), stored in context or passed as props
- No Redux, no Zustand — custom hooks + React Context

### Feature hooks pattern

Complex features use "slice" hooks in `frontend/hooks/slices/`:

```typescript
// Each slice manages one domain's state + API calls
// useAuthLogic.ts — auth state
// useClientsLogic.ts — clients list, CRUD
// etc.
```

---

## Forms and input

### Controlled inputs

Always controlled components — never uncontrolled with `ref.current.value`.

### Number inputs for money

Use `type="text"` with numeric validation, not `type="number"` — avoids locale decimal separator issues with UZS amounts.

---

## Routing

**Без react-router:** `App.tsx` → публичные пути или `MainApp` → `AppRouter` переключает экран по `currentView`. Крупные ветки вынесены в **`routes/*Routes.tsx`**. При новом экране: `useAppLogic` / константы view, ветка в `AppRouter` (или отдельный route-модуль), при необходимости проверка `user.permissions`.

---

## Build & dev

```bash
cd apps/web
npm run dev          # dev server on :5173
npm run build        # production build → dist/
npm run lint         # ESLint check
```

Vite proxy in `vite.config.ts` forwards `/api/*` to `http://localhost:8000`.

---

## Common mistakes to avoid

1. **Don't** store JWT in `sessionStorage` or `localStorage` — it's in HttpOnly cookie
2. **Don't** set `innerHTML` directly — always use `setDocEditorHtml()` or DOMPurify
3. **Don't** add global types inline in feature files — check `types/` first
4. **Don't** use raw `fetch()` for API — use `api.*` from `backend/api.ts` (или endpoints из `apiClient.ts`)
5. **Don't** use inline styles — Tailwind classes only
6. **Don't** import icons from anywhere other than `lucide-react`
7. **Don't** hard-code `localhost:8000` — use relative `/api/` paths (Vite proxies)
8. **Don't** use `any` type without a comment explaining why it's unavoidable
9. **Don't** fire API calls in `useEffect` without cleanup / abort controller for lists
10. **Don't** render user-provided HTML without DOMPurify sanitization

