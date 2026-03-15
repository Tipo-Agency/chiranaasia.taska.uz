
import React, { useState, useRef, useEffect } from 'react';
import { X, FileText, Link, Tag, FileType, Folder as FolderIcon } from 'lucide-react';
import { Folder } from '../types';

interface DocModalProps {
  onSave: (doc: { id?: string; title: string; url?: string; tags: string[]; type: 'link' | 'internal'; folderId?: string }) => void;
  onClose: () => void;
  folders?: Folder[];
  initialFolderId?: string;
  editingDoc?: { id: string; title: string; url?: string; tags: string[]; type: 'link' | 'internal'; folderId?: string };
}

const DocModal: React.FC<DocModalProps> = ({ onSave, onClose, folders = [], initialFolderId, editingDoc }) => {
  const [type, setType] = useState<'link' | 'internal'>(editingDoc?.type || 'link');
  const [title, setTitle] = useState(editingDoc?.title || '');
  const [url, setUrl] = useState(editingDoc?.url || '');
  const [tagInput, setTagInput] = useState(editingDoc?.tags?.join(', ') || '');
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(editingDoc?.folderId || initialFolderId);
  
  // Сохраняем исходные значения для отслеживания изменений
  const initialValuesRef = useRef<{
    type: 'link' | 'internal';
    title: string;
    url: string;
    tagInput: string;
    folderId?: string;
  } | null>(null);
  
  // Инициализируем исходные значения при монтировании
  useEffect(() => {
    if (editingDoc) {
      initialValuesRef.current = {
        type: editingDoc.type,
        title: editingDoc.title,
        url: editingDoc.url || '',
        tagInput: editingDoc.tags?.join(', ') || '',
        folderId: editingDoc.folderId
      };
      setType(editingDoc.type);
      setTitle(editingDoc.title);
      setUrl(editingDoc.url || '');
      setTagInput(editingDoc.tags?.join(', ') || '');
      setSelectedFolderId(editingDoc.folderId || initialFolderId);
    } else {
      initialValuesRef.current = {
        type: 'link',
        title: '',
        url: '',
        tagInput: '',
        folderId: initialFolderId
      };
      setSelectedFolderId(initialFolderId);
    }
  }, [initialFolderId, editingDoc]);
  
  const hasChanges = (): boolean => {
    if (!initialValuesRef.current) return false;
    const initial = initialValuesRef.current;
    return (
      type !== initial.type ||
      title.trim() !== initial.title ||
      url.trim() !== initial.url ||
      tagInput.trim() !== initial.tagInput ||
      selectedFolderId !== initial.folderId
    );
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const tags = tagInput.split(',').map(t => t.trim()).filter(t => t);
    onSave({ 
        id: editingDoc?.id,
        title, 
        url: type === 'link' ? url : undefined, 
        tags: tags.length > 0 ? tags : ['Общее'],
        type,
        folderId: selectedFolderId
    });
    onClose(); // Закрываем модалку после сохранения
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
          if (hasChanges()) {
              if(window.confirm("Сохранить изменения перед закрытием?")) {
                  handleSubmit();
              } else {
                  onClose();
              }
          } else {
              onClose();
          }
      }
  };
  
  const handleCloseClick = () => {
      if (hasChanges()) {
          if(window.confirm("Сохранить изменения перед закрытием?")) {
              handleSubmit();
          } else {
              onClose();
          }
      } else {
          onClose();
      }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80] animate-in fade-in duration-200" onClick={handleBackdropClick}>
      <div className="bg-white dark:bg-[#252525] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-[#333]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-[#333] bg-white dark:bg-[#252525]">
          <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <FileText size={18} className="text-blue-500"/> 
            {editingDoc ? 'Редактировать документ' : 'Новый документ'}
          </h3>
          <button onClick={handleCloseClick} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#333] transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Type Switcher */}
          <div className="flex bg-gray-100 dark:bg-[#252525] p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setType('link')}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-md transition-all ${type === 'link' ? 'bg-white dark:bg-[#404040] text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                  <Link size={14} /> Внешняя ссылка
              </button>
              <button
                type="button"
                onClick={() => setType('internal')}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-md transition-all ${type === 'internal' ? 'bg-white dark:bg-[#404040] text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                  <FileType size={14} /> Статья / Вики
              </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Название документа</label>
            <input 
              required
              autoFocus
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-white dark:bg-[#252525] border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow placeholder-gray-400 dark:text-white"
              placeholder="Например: Техническое задание"
            />
          </div>

          {type === 'link' && (
            <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <Link size={12}/> Ссылка
                </label>
                <input 
                required
                type="url" 
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="w-full bg-white dark:bg-[#252525] border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow placeholder-gray-400 dark:text-white"
                placeholder="https://google.com/..."
                />
            </div>
          )}

          {type === 'internal' && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                  Вы сможете отредактировать содержание статьи сразу после создания в редакторе.
              </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                <FolderIcon size={12}/> Папка (необязательно)
            </label>
            <select 
              value={selectedFolderId || ''}
              onChange={e => setSelectedFolderId(e.target.value || undefined)}
              className="w-full bg-white dark:bg-[#252525] border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow text-gray-900 dark:text-white"
            >
              <option value="">Без папки</option>
              {folders.map(folder => (
                <option key={folder.id} value={folder.id}>{folder.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                <Tag size={12}/> Теги (через запятую)
            </label>
            <input 
              type="text" 
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              className="w-full bg-white dark:bg-[#252525] border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow placeholder-gray-400 dark:text-white"
              placeholder="ТЗ, Важное, Финансы"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
             <button type="button" onClick={handleCloseClick} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#303030] rounded-lg transition-colors">
                 Отмена
             </button>
             <button type="submit" className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm transition-colors">
                 {type === 'internal' ? 'Создать и открыть' : 'Добавить'}
             </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DocModal;
