import type { SalesFunnel } from '../types';

/** Акцент карточки канбана по цвету воронки (tailwind-классы из funnel.color / первого этапа). */
export function getFunnelKanbanCardAccent(funnel: SalesFunnel | undefined | null): {
  stripe: string;
  card: string;
} {
  const raw = (funnel?.color || funnel?.stages?.[0]?.color || '').toLowerCase();
  if (raw.includes('purple')) {
    return {
      stripe: 'bg-purple-400/70 dark:bg-purple-500/50',
      card: 'border-violet-200/90 dark:border-violet-800/60 bg-gradient-to-br from-violet-50/90 to-white dark:from-violet-950/35 dark:to-[#2b2b2b]',
    };
  }
  if (raw.includes('blue')) {
    return {
      stripe: 'bg-blue-400/70 dark:bg-blue-500/50',
      card: 'border-blue-200/90 dark:border-blue-800/60 bg-gradient-to-br from-blue-50/90 to-white dark:from-blue-950/35 dark:to-[#2b2b2b]',
    };
  }
  if (raw.includes('indigo')) {
    return {
      stripe: 'bg-indigo-400/70 dark:bg-indigo-500/50',
      card: 'border-indigo-200/90 dark:border-indigo-800/60 bg-gradient-to-br from-indigo-50/90 to-white dark:from-indigo-950/35 dark:to-[#2b2b2b]',
    };
  }
  if (raw.includes('orange')) {
    return {
      stripe: 'bg-orange-400/70 dark:bg-orange-500/50',
      card: 'border-orange-200/90 dark:border-orange-800/60 bg-gradient-to-br from-orange-50/90 to-white dark:from-orange-950/35 dark:to-[#2b2b2b]',
    };
  }
  if (raw.includes('green')) {
    return {
      stripe: 'bg-emerald-400/70 dark:bg-emerald-500/50',
      card: 'border-emerald-200/90 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50/90 to-white dark:from-emerald-950/35 dark:to-[#2b2b2b]',
    };
  }
  if (raw.includes('red')) {
    return {
      stripe: 'bg-rose-400/70 dark:bg-rose-500/50',
      card: 'border-rose-200/90 dark:border-rose-800/60 bg-gradient-to-br from-rose-50/90 to-white dark:from-rose-950/35 dark:to-[#2b2b2b]',
    };
  }
  if (raw.includes('yellow')) {
    return {
      stripe: 'bg-amber-400/70 dark:bg-amber-500/50',
      card: 'border-amber-200/90 dark:border-amber-800/60 bg-gradient-to-br from-amber-50/90 to-white dark:from-amber-950/35 dark:to-[#2b2b2b]',
    };
  }
  if (raw.includes('cyan')) {
    return {
      stripe: 'bg-cyan-400/70 dark:bg-cyan-500/50',
      card: 'border-cyan-200/90 dark:border-cyan-800/60 bg-gradient-to-br from-cyan-50/90 to-white dark:from-cyan-950/35 dark:to-[#2b2b2b]',
    };
  }
  if (raw.includes('gray')) {
    return {
      stripe: 'bg-slate-400 dark:bg-slate-500',
      card: 'border-slate-200/90 dark:border-slate-700/60 bg-gradient-to-br from-slate-50/90 to-white dark:from-slate-900/30 dark:to-[#2b2b2b]',
    };
  }
  return {
    stripe: 'bg-violet-400/70 dark:bg-violet-500/50',
    card: 'border-gray-200 dark:border-[#3a3a3a] bg-white dark:bg-[#2b2b2b]',
  };
}
