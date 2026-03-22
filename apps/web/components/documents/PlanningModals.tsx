/**
 * Модальные окна: недельные планы и протоколы (единый стиль с остальным приложением).
 */
import React from 'react';
import { Calendar, FileText } from 'lucide-react';
import { StandardModal } from '../ui/StandardModal';
import { WeeklyPlansView } from './WeeklyPlansView';
import { ProtocolsView } from './ProtocolsView';
import type { User } from '../../types';
import type { Task } from '../../types';

interface WeeklyPlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  tasks: Task[];
  onOpenTask?: (task: Task) => void;
}

export const WeeklyPlansModal: React.FC<WeeklyPlansModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  tasks,
  onOpenTask,
}) => (
  <StandardModal
    isOpen={isOpen}
    onClose={onClose}
    title="Недельные планы"
    icon={<Calendar className="text-[#3337AD]" size={22} strokeWidth={2} />}
    size="xl"
  >
    <WeeklyPlansView
      layout="embedded"
      currentUser={currentUser}
      tasks={tasks}
      onOpenTask={onOpenTask}
    />
  </StandardModal>
);

interface ProtocolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  tasks: Task[];
  onOpenTask?: (task: Task) => void;
}

export const ProtocolsModal: React.FC<ProtocolsModalProps> = ({
  isOpen,
  onClose,
  users,
  tasks,
  onOpenTask,
}) => (
  <StandardModal
    isOpen={isOpen}
    onClose={onClose}
    title="Протоколы по недельным планам"
    icon={<FileText className="text-[#3337AD]" size={22} strokeWidth={2} />}
    size="xl"
  >
    <ProtocolsView layout="embedded" users={users} tasks={tasks} onOpenTask={onOpenTask} />
  </StandardModal>
);
