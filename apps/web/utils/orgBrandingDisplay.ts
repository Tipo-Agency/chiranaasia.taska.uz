import type { OrgBrandingDto } from './applyOrgBranding';

export function orgHasCustomLogo(b: OrgBrandingDto | null | undefined): boolean {
  return !!(b?.logoSvgLight?.trim() || b?.logoSvgDark?.trim());
}
