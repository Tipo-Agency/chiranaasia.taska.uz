/** Вкладки единого хаба «Воронка продаж» (шапка + ?crm= в URL). */
export type CrmHubTab = 'funnel' | 'requests' | 'clients' | 'contracts' | 'receivables';

/** Устаревшие значения (chats и т.д.) → воронка. */
export function normalizeCrmHubTab(tab: string | undefined | null): CrmHubTab {
  if (
    tab === 'clients' ||
    tab === 'contracts' ||
    tab === 'receivables' ||
    tab === 'funnel' ||
    tab === 'requests'
  ) {
    return tab;
  }
  return 'funnel';
}
