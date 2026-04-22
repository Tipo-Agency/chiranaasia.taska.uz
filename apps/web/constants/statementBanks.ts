/** Коды банков для загрузки выписок (согласовано с API /finance/statement-bank-settings). */
export const STATEMENT_BANK_IDS = ['kapital', 'tenge'] as const;
export type StatementBankId = (typeof STATEMENT_BANK_IDS)[number];

export const STATEMENT_BANK_LABELS: Record<StatementBankId, string> = {
  kapital: 'Капиталбанк / АПП (Excel как AccountStatementForPeriod)',
  tenge: 'TENGE bank (выгрузка с сайта, xlsx)',
};

export const DEFAULT_ENABLED_STATEMENT_BANKS: StatementBankId[] = ['kapital', 'tenge'];

export function isStatementBankId(s: string): s is StatementBankId {
  return (STATEMENT_BANK_IDS as readonly string[]).includes(s);
}
