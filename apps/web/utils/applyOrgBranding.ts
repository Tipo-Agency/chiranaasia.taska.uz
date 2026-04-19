/** Ответ GET/PATCH `/org/branding` (camelCase). */
export type OrgBrandingDto = { primaryColor: string; logoSvg: string | null };

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** CSS-переменная `--brand-primary` для кнопок/акцентов; безопасный hex только. */
export function applyOrgBrandingToDocument(data: OrgBrandingDto | null | undefined): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const c = data?.primaryColor?.trim();
  if (!c || !HEX.test(c)) {
    root.style.removeProperty('--brand-primary');
    return;
  }
  root.style.setProperty('--brand-primary', c);
}
