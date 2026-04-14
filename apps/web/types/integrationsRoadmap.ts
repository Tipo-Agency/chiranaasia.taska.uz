/** Ответ `GET /api/integrations/roadmap` — каталог планируемых интеграций (без секретов). */

export interface IntegrationConnectorKind {
  id: string;
  title: string;
  description?: string | null;
}

export interface IntegrationProviderHint {
  id: string;
  title: string;
}

export interface IntegrationRoadmapItem {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  connector_kinds: IntegrationConnectorKind[];
  provider_hints: IntegrationProviderHint[];
}

export interface IntegrationRoadmapDomain {
  id: string;
  title: string;
  summary?: string | null;
  items: IntegrationRoadmapItem[];
}

export interface IntegrationsRoadmapResponse {
  version: string;
  domains: IntegrationRoadmapDomain[];
}
