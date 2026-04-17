/** Контактное лицо компании (клиента); GET/POST /contacts. */
export interface CrmContact {
  id: string;
  version?: number;
  clientId?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  telegram?: string | null;
  instagram?: string | null;
  jobTitle?: string | null;
  notes?: string | null;
  tags?: string[];
  isArchived?: boolean;
}
