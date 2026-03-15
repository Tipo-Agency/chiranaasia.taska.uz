
import React, { useState, useEffect, useRef } from 'react';
import { Task, User, Project, StatusOption } from '../types';
import { X, Save, Users, Tag, Layers } from 'lucide-react';
import { TaskSelect } from './TaskSelect';

interface FeatureModalProps {
  feature: Partial<Task> | null;
  users: User[];
  projects: Project[];
  statuses: StatusOption[];
  currentUser: User;
  onSave: (feature: Partial<Task>) => void;
  onClose: () => void;
  onCreateProject?: (name: string) => void;
}

const STANDARD_CATEGORIES = [
  'Установка счетчиков',
  'Настройка под SEO',
  'Фичи',
  'Бэкенд',
  'Серверная инфраструктура'
];

const FeatureModal: React.FC<FeatureModalProps> = ({
  feature,
  users,
  projects,
  statuses,
  currentUser,
  onSave,
  onClose,
  onCreateProject
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [category, setCategory] = useState<string>('');
  const [status, setStatus] = useState<string>(statuses[0]?.name || 'Не начато');
  const initialValuesRef = useRef<{
    title: string;
    description: string;
    projectId: string;
    assigneeIds: string[];
    category: string;
    status: string;
  } | null>(null);

  useEffect(() => {
    if (feature) {
      const newTitle = feature.title || '';
      const newDescription = feature.description || '';
      const newProjectId = feature.projectId || '';
      const newAssigneeIds = feature.assigneeIds || (feature.assigneeId ? [feature.assigneeId] : [currentUser.id]);
      const newCategory = feature.category || '';
      const newStatus = feature.status || statuses[0]?.name || 'Не начато';

      setTitle(newTitle);
      setDescription(newDescription);
      setProjectId(newProjectId);
      setAssigneeIds(newAssigneeIds);
      setCategory(newCategory);
      setStatus(newStatus);

      initialValuesRef.current = {
        title: newTitle,
        description: newDescription,
        projectId: newProjectId,
        assigneeIds: newAssigneeIds,
        category: newCategory,
        status: newStatus
      };
    } else {
      setTitle('');
      setDescription('');
      setProjectId('');
      setAssigneeIds([currentUser.id]);
      setCategory('');
      setStatus(statuses[0]?.name || 'Не начато');
      initialValuesRef.current = {
        title: '',
        description: '',
        projectId: '',
        assigneeIds: [currentUser.id],
        category: '',
        status: statuses[0]?.name || 'Не начато'
      };
    }
  }, [feature, currentUser.id, statuses]);

  const hasChanges = (): boolean => {
    if (!initialValuesRef.current) return false;
    const initial = initialValuesRef.current;
    return (
      initial.title !== title ||
      initial.description !== description ||
      initial.projectId !== projectId ||
      JSON.stringify([...initial.assigneeIds].sort()) !== JSON.stringify([...assigneeIds].sort()) ||
      initial.category !== category ||
      initial.status !== status
    );
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      if (hasChanges()) {
        if (window.confirm('Есть несохраненные изменения. Сохранить перед выходом?')) {
          handleSave();
        } else {
          onClose();
        }
      } else {
        onClose();
      }
    }
  };

  const handleClose = () => {
    if (hasChanges()) {
      if (window.confirm('Есть несохраненные изменения. Сохранить перед выходом?')) {
        handleSave();
      } else {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleSave = () => {
    const featureData: Partial<Task> = {
      ...feature,
      title: title.trim(),
      description: description.trim(),
      projectId: projectId || undefined,
      assigneeIds: assigneeIds.length > 0 ? assigneeIds : undefined,
      assigneeId: assigneeIds[0] || undefined,
      category: category || undefined,
      status: status,
      entityType: 'feature',
      priority: 'Средний'
    };
    onSave(featureData);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center z-[90] animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-white dark:bg-[#252525] rounded-t-2xl md:rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] md:max-h-[90vh] overflow-hidden border border-gray-200 dark:border-[#333] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center bg-white dark:bg-[#252525] shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg text-purple-600 dark:text-purple-400">
              <Layers size={20} />
            </div>
            <h3 className="font-bold text-gray-800 dark:text-white text-lg">
              {feature?.id ? 'Редактировать функцию' : 'Новая функция'}
            </h3>
          </div>
          <button 
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#333] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-6 space-y-6">
            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Название функции <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-white dark:bg-[#333] border border-gray-300 dark:border-[#555] rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                placeholder="Опишите функцию..."
                autoFocus
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Описание
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={6}
                className="w-full bg-white dark:bg-[#333] border border-gray-300 dark:border-[#555] rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-gray-100 resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                placeholder="Подробное описание функции..."
              />
            </div>

            {/* Project */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Проект
              </label>
              <TaskSelect
                value={projectId}
                onChange={setProjectId}
                options={[
                  { value: '', label: 'Без проекта' },
                  ...projects.map(p => ({ value: p.id, label: p.name }))
                ]}
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Статус
              </label>
              <TaskSelect
                value={status}
                onChange={setStatus}
                options={statuses.map(s => ({ value: s.name, label: s.name }))}
              />
            </div>

            {/* Assignees */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2 flex items-center gap-2">
                <Users size={14} />
                Исполнители
              </label>
              <div className="space-y-2">
                {assigneeIds.map((userId, idx) => {
                  const user = users.find(u => u.id === userId);
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <TaskSelect
                        value={userId}
                        onChange={(val) => {
                          const newIds = [...assigneeIds];
                          newIds[idx] = val;
                          setAssigneeIds(newIds);
                        }}
                        options={users.map(u => ({ value: u.id, label: u.name }))}
                        className="flex-1"
                      />
                      {assigneeIds.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setAssigneeIds(assigneeIds.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setAssigneeIds([...assigneeIds, currentUser.id])}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  + Добавить исполнителя
                </button>
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2 flex items-center gap-2">
                <Tag size={14} />
                Категория
              </label>
              <TaskSelect
                value={category}
                onChange={setCategory}
                options={[
                  { value: '', label: 'Без категории' },
                  ...STANDARD_CATEGORIES.map(cat => ({ value: cat, label: cat }))
                ]}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100 dark:border-[#333] bg-white dark:bg-[#252525] flex justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#303030] rounded-lg transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 rounded-lg shadow-sm flex items-center gap-2 transition-colors"
            >
              <Save size={16} />
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FeatureModal;

