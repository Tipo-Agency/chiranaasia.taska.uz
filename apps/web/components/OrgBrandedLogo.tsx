import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { useOrgBranding } from '../contexts/OrgBrandingContext';
import { useDocumentDarkClass } from '../hooks/useDocumentDarkClass';
import { LogoIcon } from './AppIcons';

type Variant = 'login' | 'sidebar-expanded' | 'sidebar-collapsed';

function pickSvg(light: string | null | undefined, dark: string | null | undefined, isDark: boolean): string | null {
  const L = light?.trim() || '';
  const D = dark?.trim() || '';
  if (isDark) {
    if (D) return D;
    if (L) return L;
  } else {
    if (L) return L;
    if (D) return D;
  }
  return null;
}

const shellClass: Record<Variant, string> = {
  login: 'inline-flex max-w-full items-center justify-center [&_svg]:max-h-[120px] [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:w-auto',
  'sidebar-expanded':
    'flex min-h-0 min-w-0 max-w-[11rem] shrink items-center justify-start overflow-hidden [&_svg]:max-h-9 [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:w-auto [&_svg]:object-contain',
  'sidebar-collapsed': 'flex size-8 shrink-0 items-center justify-center overflow-hidden [&_svg]:max-h-7 [&_svg]:max-w-7 [&_svg]:h-auto [&_svg]:w-auto [&_svg]:object-contain',
};

/**
 * Логотип из настроек организации (светлый/тёмный SVG). Если не задан — марка приложения {@link LogoIcon}.
 */
export const OrgBrandedLogo: React.FC<{ variant: Variant; className?: string }> = ({ variant, className = '' }) => {
  const { branding } = useOrgBranding();
  const isDark = useDocumentDarkClass();

  const raw = useMemo(
    () => pickSvg(branding?.logoSvgLight, branding?.logoSvgDark, isDark),
    [branding?.logoSvgLight, branding?.logoSvgDark, isDark]
  );

  const safe = useMemo(() => {
    if (!raw) return '';
    return DOMPurify.sanitize(raw, { USE_PROFILES: { svg: true } });
  }, [raw]);

  if (!safe) {
    const markClass =
      variant === 'login'
        ? 'h-[min(30vw,120px)] w-auto max-h-[120px] shrink-0'
        : variant === 'sidebar-collapsed'
          ? 'h-6 w-6 shrink-0'
          : 'h-7 w-7 shrink-0';
    return (
      <span
        className={`${shellClass[variant]} ${className} text-[color:var(--brand-primary,#3337AD)] dark:text-[color:var(--brand-primary,#3337AD)]`}
      >
        <LogoIcon className={markClass} />
      </span>
    );
  }

  return (
    <span
      className={`${shellClass[variant]} ${className} text-current [&_svg]:shrink-0`}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
};
