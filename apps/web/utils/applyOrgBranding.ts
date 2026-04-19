/** Ответ GET/PATCH `/org/branding` (camelCase). */
export type OrgBrandingDto = {
  primaryColor: string;
  logoSvgLight: string | null;
  logoSvgDark: string | null;
};

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** Валидный `#RRGGBB` или `null`. */
export function tryNormalizePrimaryColorHex(input: string): string | null {
  const s = input.trim();
  const body = s.startsWith('#') ? s.slice(1) : s;
  if (body.length === 6 && HEX.test(`#${body}`)) {
    return `#${body.toUpperCase()}`;
  }
  return null;
}

/** Приводит ввод к `#RRGGBB` для `<input type="color">`; при ошибке — `fallback`. */
export function normalizePrimaryColorHex(input: string, fallback = '#F97316'): string {
  return tryNormalizePrimaryColorHex(input) ?? fallback;
}

/** CSS-переменная `--brand-primary` для кнопок/акцентов; безопасный hex только. */
export function applyOrgBrandingToDocument(data: OrgBrandingDto | null | undefined): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const raw = data?.primaryColor?.trim();
  const c = raw ? tryNormalizePrimaryColorHex(raw) : null;
  if (!c) {
    root.style.removeProperty('--brand-primary');
    return;
  }
  root.style.setProperty('--brand-primary', c);
}
