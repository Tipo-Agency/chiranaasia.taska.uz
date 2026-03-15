
import React, { useState } from 'react';
import { X, CheckSquare, FileText, Users, Instagram, Archive, Layers } from 'lucide-react';
import { DynamicIcon } from './AppIcons';
import { ICON_OPTIONS, COLOR_OPTIONS } from '../constants';

interface CreateTableModalProps {
  onClose: () => void;
  onCreate: (name: string, type: string, icon: string, color: string) => void;
  initialType?: string;
}

const CreateTableModal: React.FC<CreateTableModalProps> = ({ onClose, onCreate, initialType }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState(initialType || 'tasks');
  const [icon, setIcon] = useState('CheckSquare');
  const [color, setColor] = useState('text-blue-500');
  
  // Обновляем тип при изменении initialType
  React.useEffect(() => {
    if (initialType) {
      setType(initialType);
    }
  }, [initialType]);

  const pageTypes = [
    // Только проекты внутри модулей - системные модули (встречи, документы) больше не создаются
    // Контент-планы, беклог и функционал - это проекты внутри модулей
    { id: 'content-plan', label: 'Контент-план', icon: <Instagram size={18} /> },
    { id: 'backlog', label: 'Бэклог', icon: <Archive size={18} /> },
    { id: 'functionality', label: 'Функционал', icon: <Layers size={18} /> },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), type, icon, color);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-[#252525] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-[#333]" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center bg-white dark:bg-[#252525]">
          <h3 className="font-bold text-lg text-gray-800 dark:text-white">Новая страница</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#333]">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">Название страницы</label>
            <input 
              required
              autoFocus
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-white dark:bg-[#333] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow placeholder-gray-400 dark:text-white"
              placeholder="Например: Проект X"
            />
          </div>

          {!initialType && (
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase">Тип страницы</label>
              <div className="grid grid-cols-3 gap-2">
                {pageTypes.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setType(t.id)}
                    className={`p-3 border-2 rounded-lg text-center transition-all flex flex-col items-center gap-2 ${
                      type === t.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-[#303030]'
                    }`}
                  >
                    {t.icon}
                    <span className="text-xs font-medium">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">Иконка</label>
              <div className="grid grid-cols-4 gap-2 bg-gray-50 dark:bg-[#202020] p-2 rounded-lg border border-gray-200 dark:border-[#333] max-h-32 overflow-y-auto custom-scrollbar">
                {ICON_OPTIONS.map(iconName => (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setIcon(iconName)}
                    className={`p-2 rounded cursor-pointer flex justify-center transition-all ${
                      icon === iconName
                        ? 'bg-blue-500 text-white ring-2 ring-blue-300 dark:ring-blue-700'
                        : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-[#404040] hover:text-gray-600 dark:hover:text-gray-200'
                    }`}
                  >
                    <DynamicIcon name={iconName} size={18} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">Цвет</label>
              <div className="grid grid-cols-3 gap-2 bg-gray-50 dark:bg-[#202020] p-2 rounded-lg border border-gray-200 dark:border-[#333]">
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full cursor-pointer border-2 transition-all ${
                      color === c
                        ? 'border-gray-900 dark:border-white scale-110'
                        : 'border-transparent hover:scale-105'
                    }`}
                  >
                    <div className={`w-full h-full rounded-full ${c.replace('text-', 'bg-').replace('500', '400')}`}></div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-[#333]">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#303030] rounded-lg transition-colors"
            >
              Отмена
            </button>
            <button 
              type="submit" 
              className="px-6 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
            >
              Создать страницу
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTableModal;

