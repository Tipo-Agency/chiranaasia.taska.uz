/**
 * Единая логика создания/обновления сущностей из MiniMessenger (App + AppRouter).
 */
import type { AppActions } from '../frontend/hooks/useAppLogic';
import type {
  User,
  Task,
  Deal,
  Meeting,
  Doc,
  StatusOption,
  PriorityOption,
  OrgPosition,
  EmployeeInfo,
  BusinessProcess,
} from '../types';
import { resolveAssigneesForOrgPosition } from './orgPositionAssignee';

export interface MiniMessengerBridgeDeps {
  currentUser: User;
  statuses: StatusOption[];
  priorities: PriorityOption[];
  tasks: Task[];
  deals: Deal[];
  meetings: Meeting[];
  docs: Doc[];
  orgPositions: OrgPosition[];
  employeeInfos: EmployeeInfo[];
  businessProcesses: BusinessProcess[];
  actions: AppActions;
}

export async function createEntityFromChat(
  deps: MiniMessengerBridgeDeps,
  type: 'task' | 'deal' | 'meeting' | 'doc',
  title: string
): Promise<{ id: string; label: string } | null> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const nowIso = now.toISOString();
  const { currentUser, statuses, priorities, actions } = deps;

  if (type === 'task') {
    const task: Task = {
      id: `chat-task-${Date.now()}`,
      entityType: 'task',
      tableId: '',
      title,
      status: statuses?.[0]?.name || 'Не начато',
      priority: priorities?.[1]?.name || priorities?.[0]?.name || 'Средний',
      assigneeId: currentUser.id,
      projectId: null,
      startDate: today,
      endDate: today,
      description: '',
      createdByUserId: currentUser.id,
      createdAt: nowIso,
    };
    await actions.saveTask(task);
    return { id: task.id, label: task.title };
  }

  if (type === 'deal') {
    const deal: Deal = {
      id: `chat-deal-${Date.now()}`,
      dealKind: 'funnel',
      title,
      amount: 0,
      currency: 'UZS',
      stage: 'new',
      assigneeId: currentUser.id,
      createdAt: nowIso,
    };
    await actions.saveDeal(deal);
    return { id: deal.id, label: deal.title || title };
  }

  if (type === 'meeting') {
    const meeting: Meeting = {
      id: `chat-meeting-${Date.now()}`,
      tableId: 'meetings-system',
      title,
      date: today,
      time: '10:00',
      participantIds: [currentUser.id],
      summary: '',
      type: 'work',
    };
    await actions.saveMeeting(meeting);
    return { id: meeting.id, label: meeting.title };
  }

  const doc: Doc = {
    id: `chat-doc-${Date.now()}`,
    tableId: 'docs-system',
    title,
    type: 'internal',
    tags: [],
    content: '',
  };
  await actions.saveDoc(doc);
  return { id: doc.id, label: doc.title };
}

export async function updateEntityFromChat(
  deps: MiniMessengerBridgeDeps,
  type: 'task' | 'deal' | 'meeting' | 'doc',
  id: string,
  patch: Record<string, unknown>
): Promise<boolean> {
  const { tasks, deals, meetings, docs, actions } = deps;
  if (type === 'task') {
    const current = tasks.find((t) => t.id === id);
    if (!current) return false;
    await actions.saveTask({ ...current, ...patch });
    return true;
  }
  if (type === 'deal') {
    const current = deals.find((d) => d.id === id);
    if (!current) return false;
    await actions.saveDeal({ ...current, ...patch });
    return true;
  }
  if (type === 'meeting') {
    const current = meetings.find((m) => m.id === id);
    if (!current) return false;
    await actions.saveMeeting({ ...current, ...patch });
    return true;
  }
  const current = docs.find((d) => d.id === id);
  if (!current) return false;
  await actions.saveDoc({ ...current, ...patch });
  return true;
}

export async function startBusinessProcessFromTemplate(
  deps: MiniMessengerBridgeDeps,
  processId: string
): Promise<{ id: string; label: string } | null> {
  const { currentUser, priorities, orgPositions, employeeInfos, businessProcesses, actions } = deps;
  const selected = businessProcesses.find((p) => p.id === processId && !p.isArchived);
  if (!selected || !selected.steps?.length) return null;
  const firstStep = selected.steps[0];
  let assigneeId: string | null = null;
  let assigneeIds: string[] | undefined;
  if (firstStep.assigneeType === 'position') {
    const position = orgPositions.find((p) => p.id === firstStep.assigneeId);
    const resolved = resolveAssigneesForOrgPosition(position, employeeInfos);
    assigneeId = resolved.assigneeId;
    assigneeIds = resolved.assigneeIds;
    if (resolved.positionPatch && position) {
      actions.savePosition({ ...position, ...resolved.positionPatch });
    }
  } else {
    assigneeId = firstStep.assigneeId || null;
  }
  if (!assigneeId) return null;

  const instanceId = `inst-${Date.now()}`;
  const taskId = `task-${Date.now()}`;
  const now = new Date();
  const latestVersion =
    businessProcesses.filter((p) => p.id === selected.id).sort((a, b) => (b.version || 1) - (a.version || 1))[0] ||
    selected;

  await actions.saveProcess({
    ...latestVersion,
    instances: [
      ...(latestVersion.instances || []),
      {
        id: instanceId,
        processId: latestVersion.id,
        processVersion: latestVersion.version || 1,
        currentStepId: firstStep.id,
        status: 'active',
        startedAt: now.toISOString(),
        taskIds: [taskId],
      },
    ],
  });
  await actions.saveTask({
    id: taskId,
    entityType: 'task',
    tableId: '',
    title: `${latestVersion.title}: ${firstStep.title}`,
    description: firstStep.description || '',
    status: 'Не начато',
    priority: priorities?.[1]?.name || priorities?.[0]?.name || 'Средний',
    assigneeId,
    assigneeIds,
    source: 'Процесс',
    startDate: now.toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    processId: latestVersion.id,
    processInstanceId: instanceId,
    stepId: firstStep.id,
    createdAt: now.toISOString(),
    createdByUserId: currentUser.id,
  });
  return { id: taskId, label: `${latestVersion.title}: ${firstStep.title}` };
}
