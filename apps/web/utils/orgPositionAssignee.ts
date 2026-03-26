import type { EmployeeInfo, OrgPosition } from '../types';

/** Активные сотрудники на должности (по карточкам HR); иначе legacy — holderUserId. */
export function getMemberUserIdsForPosition(
  position: OrgPosition | undefined,
  employees: EmployeeInfo[]
): string[] {
  if (!position) return [];
  const fromCards = employees
    .filter((e) => !e.isArchived && e.orgPositionId === position.id && e.userId)
    .map((e) => e.userId);
  const uniq = [...new Set(fromCards)].sort();
  if (uniq.length > 0) return uniq;
  if (position.holderUserId) return [position.holderUserId];
  return [];
}

export type PositionAssigneeResolution = {
  assigneeId: string | null;
  assigneeIds?: string[];
  /** Обновить должность (курсор round-robin) */
  positionPatch?: Partial<OrgPosition>;
};

/**
 * Назначение задачи на шаг с assigneeType === 'position':
 * - round_robin — одна задача, исполнитель меняется по кругу (по умолчанию);
 * - all — одна задача с assigneeIds = все участники (ответственный в UI — первый).
 */
export function resolveAssigneesForOrgPosition(
  position: OrgPosition | undefined,
  employees: EmployeeInfo[]
): PositionAssigneeResolution {
  if (!position) return { assigneeId: null };

  const members = getMemberUserIdsForPosition(position, employees);
  if (members.length === 0) return { assigneeId: null };

  const mode = position.taskAssigneeMode === 'all' ? 'all' : 'round_robin';

  if (mode === 'all') {
    return {
      assigneeId: members[0],
      assigneeIds: members,
    };
  }

  if (members.length === 1) {
    return { assigneeId: members[0] };
  }

  const last = position.lastTaskAssigneeUserId;
  const idx = last ? members.indexOf(last) : -1;
  const next = members[(idx + 1) % members.length];
  return {
    assigneeId: next,
    positionPatch: { lastTaskAssigneeUserId: next },
  };
}
