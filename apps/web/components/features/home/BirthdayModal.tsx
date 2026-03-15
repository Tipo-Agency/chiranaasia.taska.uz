/**
 * BirthdayModal - модальное окно поздравления с днем рождения
 */
import React from 'react';
import { StandardModal } from '../../ui/StandardModal';
import { Button } from '../../ui/Button';
import { User } from '../../../types';

interface BirthdayModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

export const BirthdayModal: React.FC<BirthdayModalProps> = ({
  isOpen,
  onClose,
  user,
}) => {
  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="sm"
      showCloseButton={false}
    >
      <div className="text-center py-4">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Поздравляем с днем рождения, {user?.name || 'Пользователь'}!
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Желаем успехов, здоровья и счастья!
        </p>
        <Button onClick={onClose}>Закрыть</Button>
      </div>
    </StandardModal>
  );
};
