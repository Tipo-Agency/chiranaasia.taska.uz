export interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  telegram?: string;
  instagram?: string;
  companyName?: string;
  notes?: string;
  tags?: string[];
  isArchived?: boolean;
  updatedAt?: string;
  /** Optimistic locking для PATCH /clients/{id}. */
  version?: number;
}
