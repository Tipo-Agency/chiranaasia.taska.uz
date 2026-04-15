/**
 * Производственный маршрут — горизонтальная «воронка»: этапы, заказы, передачи с приёмкой.
 * API: GET/PUT /production/pipelines, /production/orders, hand-over / resolve.
 */

export interface ProductionRouteStage {
  id: string;
  label: string;
  color?: string;
  position?: number;
  /** Ответственный по умолчанию на этапе */
  defaultAssigneeUserId?: string;
}

export interface ProductionRoutePipeline {
  id: string;
  name: string;
  color?: string;
  stages: ProductionRouteStage[];
  createdAt?: string;
  updatedAt?: string;
  isArchived?: boolean;
}

export interface ProductionRouteHandoff {
  id: string;
  orderId: string;
  fromStageId: string;
  toStageId: string;
  status: string;
  handedOverByUserId?: string | null;
  handedOverAt: string;
  acceptedByUserId?: string | null;
  acceptedAt?: string | null;
  hasDefects?: boolean;
  defectNotes?: string | null;
  notes?: string | null;
}

export interface ProductionRouteOrder {
  id: string;
  version?: number;
  pipelineId: string;
  currentStageId: string;
  title: string;
  notes?: string | null;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
  isArchived?: boolean;
  pendingHandoff?: ProductionRouteHandoff | null;
}
