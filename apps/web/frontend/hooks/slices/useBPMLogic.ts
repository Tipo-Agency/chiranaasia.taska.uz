
import { useState } from 'react';
import { OrgPosition, BusinessProcess } from '../../../types';
import { api } from '../../../backend/api';

export const useBPMLogic = (showNotification: (msg: string) => void) => {
  const [orgPositions, setOrgPositions] = useState<OrgPosition[]>([]);
  const [businessProcesses, setBusinessProcesses] = useState<BusinessProcess[]>([]);

  // Positions
  const savePosition = (pos: OrgPosition) => {
      const updated = orgPositions.find(p => p.id === pos.id) 
          ? orgPositions.map(p => p.id === pos.id ? pos : p) 
          : [...orgPositions, pos];
      setOrgPositions(updated);
      api.bpm.updatePositions(updated);
      showNotification('Должность сохранена');
  };

  const deletePosition = (id: string) => {
      const updated = orgPositions.filter(p => p.id !== id);
      setOrgPositions(updated);
      api.bpm.updatePositions(updated);
      showNotification('Должность удалена');
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
      const updated = businessProcesses.filter(p => p.id !== id);
      setBusinessProcesses(updated);
      api.bpm.updateProcesses(updated);
      showNotification('Процесс удален');
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
