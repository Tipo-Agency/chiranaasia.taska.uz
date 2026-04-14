export interface ProcessStepBranch {
  id: string;
  label: string;
  nextStepId: string;
}

export interface ProcessStep {
  id: string;
  title: string;
  description?: string;
  assigneeType: 'user' | 'position';
  assigneeId: string;
  order: number;
  stepType?: 'normal' | 'variant';
  nextStepId?: string;
  branches?: ProcessStepBranch[];
}

export interface ProcessInstance {
  id: string;
  processId: string;
  processVersion: number;
  currentStepId: string | null;
  status: 'active' | 'completed' | 'paused';
  startedAt: string;
  completedAt?: string;
  taskIds: string[];
  dealId?: string;
  dynamicSteps?: ProcessStep[];
  pendingBranchSelection?: { stepId: string };
  completedStepIds?: string[];
  branchHistory?: { stepId: string; branchId?: string; nextStepId: string }[];
}

export interface BusinessProcess {
  id: string;
  version: number;
  title: string;
  description?: string;
  systemKey?: string;
  steps: ProcessStep[];
  instances?: ProcessInstance[];
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
}
