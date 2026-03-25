
import { useState } from 'react';
import { OrgPosition, BusinessProcess } from '../../../types';
import { api } from '../../../backend/api';

export const useBPMLogic = (showNotification: (msg: string) => void) => {
  const [orgPositions, setOrgPositions] = useState<OrgPosition[]>([]);
  const [businessProcesses, setBusinessProcesses] = useState<BusinessProcess[]>([]);

  // Positions
  const savePosition = (pos: OrgPosition) => {
      const normalized: OrgPosition = { ...pos, isArchived: pos.isArchived ?? false };
      const updated = orgPositions.find(p => p.id === normalized.id)
          ? orgPositions.map(p => p.id === normalized.id ? normalized : p)
          : [...orgPositions, normalized];
      setOrgPositions(updated);
      api.bpm.updatePositions(updated);
      showNotification('Должность сохранена');
  };

  const deletePosition = (id: string) => {
      const now = new Date().toISOString();
      const updated = orgPositions.map((p) =>
          p.id === id ? { ...p, isArchived: true, updatedAt: now } : p
      );
      setOrgPositions(updated);
      api.bpm.updatePositions(updated);
      showNotification('Должность в архиве');
  };

  // Processes
  const saveProcess = (proc: BusinessProcess) => {
      // Проверяем, существует ли процесс с таким id
      const existingProcess = businessProcesses.find(p => p.id === proc.id);
      
      if (existingProcess) {
          // Если версия изменилась, сохраняем старую версию и добавляем новую
          if (existingProcess.version !== proc.version) {
              // Оставляем старую версию в массиве и добавляем новую
              const updated = [...businessProcesses, proc];
              setBusinessProcesses(updated);
              api.bpm.updateProcesses(updated);
              showNotification('Процесс сохранен (новая версия)');
          } else {
              // Версия не изменилась - обновляем существующий процесс
              const updated = businessProcesses.map(p => p.id === proc.id && p.version === proc.version ? proc : p);
              setBusinessProcesses(updated);
              api.bpm.updateProcesses(updated);
              showNotification('Процесс сохранен');
          }
      } else {
          // Новый процесс
          const updated = [...businessProcesses, proc];
          setBusinessProcesses(updated);
          api.bpm.updateProcesses(updated);
          showNotification('Процесс сохранен');
      }
  };

  const deleteProcess = (id: string) => {
      const now = new Date().toISOString();
      const updated = businessProcesses.map((p) =>
          p.id === id ? { ...p, isArchived: true, updatedAt: now } : p
      );
      setBusinessProcesses(updated);
      api.bpm.updateProcesses(updated);
      showNotification('Процесс в архиве');
  };

  return {
    state: { orgPositions, businessProcesses },
    setters: { setOrgPositions, setBusinessProcesses },
    actions: { 
        savePosition, deletePosition,
        saveProcess, deleteProcess
    }
  };
};
