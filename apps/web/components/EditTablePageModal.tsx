import React, { useEffect, useState } from 'react';
import { X, Instagram, Archive, Layers } from 'lucide-react';
import type { TableCollection } from '../types';
import { DynamicIcon } from './AppIcons';
import { ICON_OPTIONS, COLOR_OPTIONS, swatchHexForTableColorToken } from '../constants';

interface EditTablePageModalProps {
  table: TableCollection;
  onClose: () => void;
  onSave: (table: TableCollection) => void;
}

const MODULE_PAGE_TYPES: Array<{
  id: TableCollection['type'];
  label: string;
  icon: React.ReactNode;
}> = [
  { id: 'content-plan', label: 'Контент-план', icon: <Instagram size={16} /> },
  { id: 'backlog', label: 'Идеи', icon: <Archive size={16} /> },
  { id: 'functionality', label: 'Функционал', icon: <Layers size={16} /> },
];

function isModulePageType(t: string): t is 'content-plan' | 'backlog' | 'functionality' {
  return t === 'content-plan' || t === 'backlog' || t === 'functionality';
}

export const EditTablePageModal: React.FC<EditTablePageModalProps> = ({ table, onClose, onSave }) => {
  const [name, setName] = useState(table.name);
  const [icon, setIcon] = useState(table.icon);
  const [color, setColor] = useState(table.color || 'text-gray-500');
  const [pageType, setPageType] = useState<TableCollection['type']>(table.type);
  const [isPublic, setIsPublic] = useState(!!table.isPublic);

  useEffect(() => {
    setName(table.name);
    setIcon(table.icon);
    setColor(table.color || 'text-gray-500');
    setPageType(table.type);
    setIsPublic(table.type === 'content-plan' ? !!table.isPublic : false);
  }, [table.id, table.name, table.icon, table.color, table.type, table.isPublic]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const nextType = isModulePageType(table.type) ? pageType : table.type;
    onSave({
      ...table,
      name: name.trim(),
      icon,
      color,
      type: nextType,
      isPublic: nextType === 'content-plan' ? isPublic : false,
    });
    onClose();
  };

  const publicUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/content-plan/${table.id}` : '';

  const showModuleTypePicker = isModulePageType(table.type);

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#252525] rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar border border-gray-200 dark:border-[#333]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center bg-white dark:bg-[#252525] sticky top-0 z-10">
          <h3 className="font-bold text-lg text-gray-800 dark:text-white">Настройки страницы</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#333]"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">
              Название
            </label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white dark:bg-[#333] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
            />
          </div>

          {showModuleTypePicker && (
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">
                Тип
              </label>
              <div className="grid grid-cols-3 gap-2">
                {MODULE_PAGE_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setPageType(t.id);
                      if (t.id !== 'content-plan') setIsPublic(false);
                    }}
                    className={`p-2 border-2 rounded-lg text-center transition-all flex flex-col items-center gap-1 text-xs font-medium ${
                      pageType === t.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#303030]'
                    }`}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">
                Иконка
              </label>
              <div className="grid grid-cols-4 gap-2 bg-gray-50 dark:bg-[#202020] p-2 rounded-lg border border-gray-200 dark:border-[#333] max-h-36 overflow-y-auto custom-scrollbar">
                {ICON_OPTIONS.map((iconName) => (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setIcon(iconName)}
                    className={`p-2 rounded flex justify-center transition-all ${
                      icon === iconName
                        ? 'bg-blue-500 text-white ring-2 ring-blue-300 dark:ring-blue-700'
                        : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-[#404040]'
                    }`}
                  >
                    <DynamicIcon name={iconName} size={18} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">
                Цвет
              </label>
              <div className="grid grid-cols-5 gap-2 bg-gray-50 dark:bg-[#202020] p-3 rounded-lg border border-gray-200 dark:border-[#333]">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    title={c}
                    className={`mx-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-transform ${
                      color === c
                        ? 'border-gray-900 dark:border-white ring-2 ring-offset-1 ring-offset-gray-50 dark:ring-offset-[#202020] ring-blue-500/40 scale-105'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    <span
                      className="block h-6 w-6 rounded-full shadow-inner ring-1 ring-black/10 dark:ring-white/15"
                      style={{ backgroundColor: swatchHexForTableColorToken(c) }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {pageType === 'content-plan' && (
            <div className="space-y-3 rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#1a1a1a] p-4">
              <label className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded text-blue-600"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                />
                <span>
                  <span className="font-medium text-gray-900 dark:text-white">Публичная ссылка</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Просмотр календаря контента без входа в систему
                  </span>
                </span>
              </label>
              <div>
                <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">
                  URL
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] px-3 py-2 text-xs text-gray-700 dark:text-gray-300">
                  <span className="break-all min-w-0 flex-1">{publicUrl}</span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(publicUrl);
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:opacity-80 shrink-0"
                  >
                    Копировать
                  </button>
                </div>
                {!isPublic && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                    Ссылка работает только если включена опция выше.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-[#333]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#303030] rounded-lg"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-6 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTablePageModal;
