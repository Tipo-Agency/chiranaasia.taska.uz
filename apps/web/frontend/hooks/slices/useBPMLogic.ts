
import { useState } from 'react';
import { OrgPosition, BusinessProcess } from '../../../types';
import { api } from '../../../backend/api';

export const useBPMLogic = (showNotification: (msg: string) => void) => {
  const [orgPositions, setOrgPositions] = useState<OrgPosition[]>([]);
  const [businessProcesses, setBusinessProcesses] = useState<BusinessProcess[]>([]);

  // ── Positions ────────────────────────────────────────────────────────────

  const savePosition = (pos: OrgPosition) => {
    const normalized: OrgPosition = { ...pos, isArchived: pos.isArchived ?? false };
    const updated = orgPositions.find((p) => p.id === normalized.id)
      ? orgPositions.map((p) => (p.id === normalized.id ? normalized : p))
      : [...orgPositions, normalized];
    setOrgPositions(updated);
    void api.bpm
      .updatePositions(updated)
      .catch(() => showNotification('Ошибка сохранения должности. Повторите или проверьте сеть.'));
  };

  const deletePosition = (id: string) => {
    const now = new Date().toISOString();
    const updated = orgPositions.map((p) =>
      p.id === id ? { ...p, isArchived: true, updatedAt: now } : p
    );
    setOrgPositions(updated);
    void api.bpm
      .updatePositions(updated)
      .catch(() => showNotification('Не удалось архивировать должность. Повторите или проверьте сеть.'));
  };

  // ── Processes ────────────────────────────────────────────────────────────

  const saveProcess = (proc: BusinessProcess) => {
    // One entry per ID — always replace, never append duplicates.
    const updated = businessProcesses.find((p) => p.id === proc.id)
      ? businessProcesses.map((p) => (p.id === proc.id ? proc : p))
      : [...businessProcesses, proc];
    setBusinessProcesses(updated);
    void api.bpm
      .updateProcesses(updated)
      .catch(() => showNotification('Ошибка сохранения процесса. Повторите или проверьте сеть.'));
  };

  const deleteProcess = (id: string) => {
    const now = new Date().toISOString();
    const updated = businessProcesses.map((p) =>
      p.id === id ? { ...p, isArchived: true, updatedAt: now } : p
    );
    setBusinessProcesses(updated);
    void api.bpm
      .updateProcesses(updated)
      .catch(() => showNotification('Не удалось архивировать процесс. Повторите или проверьте сеть.'));
  };

  return {
    state: { orgPositions, businessProcesses },
    setters: { setOrgPositions, setBusinessProcesses },
    actions: {
      savePosition,
      deletePosition,
      saveProcess,
      deleteProcess,
    },
  };
};
