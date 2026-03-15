
import React, { useState, useEffect, useRef } from 'react';
import { Task, User, Project } from '../types';
import { X, Save, Users, Tag } from 'lucide-react';
import { TaskSelect } from './TaskSelect';

interface IdeaModalProps {
  idea: Partial<Task> | null;
  users: User[];
  projects: Project[];
  currentUser: User;
  onSave: (idea: Partial<Task>) => void;
  onClose: () => void;
  onCreateProject?: (name: string) => void;
}

const IdeaModal: React.FC<IdeaModalProps> = ({
  idea,
  users,
  projects,
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
  const initialValuesRef = useRef<{
    title: string;
    description: string;
    projectId: string;
    assigneeIds: string[];
    category: string;
  } | null>(null);

  useEffect(() => {
    if (idea) {
      const newTitle = idea.title || '';
      const newDescription = idea.description || '';
      const newProjectId = idea.projectId || '';
      const newAssigneeIds = idea.assigneeIds || (idea.assigneeId ? [idea.assigneeId] : [currentUser.id]);
      const newCategory = idea.category || '';

      setTitle(newTitle);
      setDescription(newDescription);
      setProjectId(newProjectId);
      setAssigneeIds(newAssigneeIds);
      setCategory(newCategory);

      initialValuesRef.current = {
        title: newTitle,
        description: newDescription,
        projectId: newProjectId,
        assigneeIds: newAssigneeIds,
        category: newCategory
      };
    } else {
      setTitle('');
      setDescription('');
      setProjectId('');
      setAssigneeIds([currentUser.id]);
      setCategory('');
      initialValuesRef.current = {
        title: '',
        description: '',
        projectId: '',
        assigneeIds: [currentUser.id],
        category: ''
      };
    }
  }, [idea, currentUser.id]);

  const hasChanges = (): boolean => {
    if (!initialValuesRef.current) return false;
    const initial = initialValuesRef.current;
    return (
      initial.title !== title ||
      initial.description !== description ||
      initial.projectId !== projectId ||
      JSON.stringify([...initial.assigneeIds].sort()) !== JSON.stringify([...assigneeIds].sort()) ||
      initial.category !== category
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
    const ideaData: Partial<Task> = {
      ...idea,
      title: title.trim(),
      description: description.trim(),
      projectId: projectId || undefined,
      assigneeIds: assigneeIds.length > 0 ? assigneeIds : undefined,
      assigneeId: assigneeIds[0] || undefined,
      category: category || undefined,
      entityType: 'idea',
      status: 'Новая',
      priority: 'Средний'
    };
    onSave(ideaData);
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
          <h3 className="font-bold text-gray-800 dark:text-white text-lg">
            {idea?.id ? 'Редактировать идею' : 'Новая идея'}
          </h3>
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
                Название идеи <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-white dark:bg-[#333] border border-gray-300 dark:border-[#555] rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                placeholder="Опишите вашу идею..."
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
                className="w-full bg-white dark:bg-[#333] border border-gray-300 dark:border-[#555] rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-gray-100 resize-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                placeholder="Подробное описание идеи..."
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
              <input
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-white dark:bg-[#333] border border-gray-300 dark:border-[#555] rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                placeholder="Категория идеи..."
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
              className="px-4 py-2 text-sm font-medium bg-orange-600 text-white hover:bg-orange-700 rounded-lg shadow-sm flex items-center gap-2 transition-colors"
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

export default IdeaModal;

