
import React, { useState, useMemo } from 'react';
import { Doc, Folder, TableCollection, Task, TaskAttachment } from '../types';
import { FileText, Folder as FolderIcon, Plus, LayoutGrid, List as ListIcon, Trash2, ExternalLink, ChevronRight, FolderPlus, X, Save, Box, FileText as FileTextIcon, Paperclip, Image as ImageIcon, Download, File as FileIcon, Edit2 } from 'lucide-react';
import { Tabs, Button } from './ui';
import { FilePreviewModal } from './FilePreviewModal';
import { isImageFile } from '../utils/fileUtils';

interface DocumentsViewProps {
  docs: Doc[];
  folders: Folder[];
  tableId: string;
  showAll?: boolean; // Aggregator mode
  tables?: TableCollection[];
  tasks?: Task[]; // Добавляем tasks для вложений
  onOpenDoc: (doc: Doc) => void;
  onAddDoc: (folderId?: string) => void;
  onCreateFolder: (name: string, parentFolderId?: string) => void;
  onDeleteFolder: (id: string) => void;
  onDeleteDoc?: (id: string) => void;
  onEditDoc?: (doc: Doc) => void; // Функция для редактирования документа
  onDeleteAttachment?: (taskId: string, attachmentId: string) => void; // Функция для удаления вложения
}

const DocumentsView: React.FC<DocumentsViewProps> = ({ 
    docs, 
    folders, 
    tableId,
    showAll = false,
    tables = [],
    tasks = [],
    onOpenDoc, 
    onAddDoc, 
    onCreateFolder,
    onDeleteFolder,
    onDeleteDoc,
    onEditDoc,
    onDeleteAttachment
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [folderPath, setFolderPath] = useState<string[]>([]); // Массив ID папок для навигации
  const [activeTab, setActiveTab] = useState<'docs' | 'attachments'>('docs'); // Вкладка: документы или вложения
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);
  
  // Modal State
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Получаем текущую папку (последняя в пути)
  const currentFolderId = folderPath.length > 0 ? folderPath[folderPath.length - 1] : null;
  
  // Получаем все папки для текущей таблицы
  const allFolders = folders.filter(f => showAll ? true : f.tableId === tableId);
  
  // Получаем папки на текущем уровне (те, у которых parentFolderId совпадает с currentFolderId)
  const visibleFolders = allFolders.filter(f => {
    if (!currentFolderId) {
      return !f.parentFolderId; // На корневом уровне показываем папки без родителя
    }
    return f.parentFolderId === currentFolderId; // В папке показываем её дочерние папки
  });
  
  // Получаем документы на текущем уровне (исключаем архивные)
  const visibleDocs = (currentFolderId
    ? docs.filter(d => d.folderId === currentFolderId)
    : docs.filter(d => showAll ? (!d.folderId) : (d.tableId === tableId && !d.folderId))
  ).filter(d => !d.isArchived);

  // Получаем путь папок для breadcrumbs
  const getFolderPath = (): Folder[] => {
    const path: Folder[] = [];
    let currentId = currentFolderId;
    while (currentId) {
      const folder = allFolders.find(f => f.id === currentId);
      if (folder) {
        path.unshift(folder);
        currentId = folder.parentFolderId;
      } else {
        break;
      }
    }
    return path;
  };

  const folderPathArray = getFolderPath();

  const getTableName = (tId: string) => tables.find(t => t.id === tId)?.name || 'Неизвестно';

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (newFolderName.trim()) {
          onCreateFolder(newFolderName, currentFolderId || undefined);
          setNewFolderName('');
          setIsFolderModalOpen(false);
      }
  };

  const handleFolderClick = (folderId: string) => {
      setFolderPath([...folderPath, folderId]);
  };

  const handleBreadcrumbClick = (index: number) => {
      setFolderPath(folderPath.slice(0, index + 1));
  };

  const handleBackToRoot = () => {
      setFolderPath([]);
  };

  const handleDeleteFolderSafe = (folder: Folder) => {
      const hasDocs = docs.some(d => d.folderId === folder.id);
      const hasSubfolders = allFolders.some(f => f.parentFolderId === folder.id);
      if (hasDocs || hasSubfolders) {
          alert('Нельзя удалить папку, пока в ней есть документы или вложенные папки. Сначала удалите или переместите их.');
          return;
      }
      if (confirm(`Удалить папку "${folder.name}"?`)) {
          onDeleteFolder(folder.id);
      }
  };

  const renderAttachmentsTab = () => {
    // Собираем все вложения из всех задач
    const allAttachments: Array<{ attachment: TaskAttachment; task: Task }> = [];
    tasks.forEach(task => {
      if (task.attachments && task.attachments.length > 0) {
        task.attachments.forEach(att => {
          allAttachments.push({ attachment: att, task });
        });
      }
    });


    return (
      <div className="space-y-4">
        {allAttachments.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {allAttachments.map(({ attachment, task }) => {
              const imageUrl = isImageFile(attachment.url, attachment.type) ? attachment.url : null;
              return (
                <div 
                  key={attachment.id} 
                  className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg overflow-hidden hover:shadow-md transition-all group relative cursor-pointer"
                  onClick={() => setPreviewFile({ url: attachment.url, name: attachment.name, type: attachment.type })}
                >
                  {imageUrl ? (
                    <div className="aspect-square relative bg-gray-100 dark:bg-[#1e1e1e]">
                      <img 
                        src={imageUrl} 
                        alt={attachment.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                      {onDeleteAttachment && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Удалить вложение "${attachment.name}"?`)) {
                              onDeleteAttachment(task.id, attachment.id);
                            }
                          }} 
                          className="absolute top-2 right-2 text-white hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded bg-black/50 hover:bg-black/70"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="aspect-square bg-gray-50 dark:bg-[#1e1e1e] flex items-center justify-center relative">
                      <FileIcon size={32} className="text-gray-400" />
                      {onDeleteAttachment && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Удалить вложение "${attachment.name}"?`)) {
                              onDeleteAttachment(task.id, attachment.id);
                            }
                          }} 
                          className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                  <div className="p-2">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-xs mb-1 line-clamp-2">{attachment.name}</h3>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1">
                      Из: {task.title}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-gray-100 dark:border-[#333] rounded-xl bg-gray-50/50 dark:bg-[#202020] flex flex-col items-center">
            <Paperclip size={48} className="text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">Нет вложений</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm">Вложения из задач будут отображаться здесь</p>
          </div>
        )}
      </div>
    );
  };

  const renderBreadcrumbs = () => (
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4 bg-white dark:bg-[#1e1e1e] p-2 rounded-lg border border-gray-100 dark:border-[#333] shadow-sm w-fit flex-wrap">
          <span 
            className={`cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-2 py-1 rounded transition-colors ${!currentFolderId ? 'font-bold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-[#252525]' : ''}`}
            onClick={handleBackToRoot}
          >
              {showAll ? 'Все документы' : 'Документы'}
          </span>
          {folderPathArray.map((folder, index) => (
              <React.Fragment key={folder.id}>
                  <ChevronRight size={14} className="text-gray-400" />
                  <span 
                      className={`cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-2 py-1 rounded transition-colors flex items-center gap-2 ${index === folderPathArray.length - 1 ? 'font-bold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-[#252525]' : ''}`}
                      onClick={() => handleBreadcrumbClick(index)}
                  >
                      <FolderIcon size={14} className="text-blue-500"/>
                      {folder.name}
                  </span>
              </React.Fragment>
          ))}
      </div>
  );

  return (
    <>
    <div className="h-full flex flex-col min-h-0">
      <div className="max-w-7xl mx-auto w-full pt-8 px-6 flex-shrink-0">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-gray-800 dark:text-white truncate">Документы</h1>
              <p className="hidden md:block text-xs text-gray-500 dark:text-gray-400 mt-1">
                Управление документами и папками
              </p>
            </div>
            {activeTab === 'docs' && (
              <div className="flex gap-2">
                {!currentFolderId && (
                  <button onClick={() => setIsFolderModalOpen(true)} className="hidden sm:flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#303030] rounded-lg text-sm font-medium transition-colors">
                    <FolderPlus size={16} /> Папка
                  </button>
                )}
                <button onClick={() => onAddDoc(currentFolderId || undefined)} className="px-4 py-2 rounded-lg bg-yellow-600 text-white text-sm font-medium hover:bg-yellow-700 flex items-center gap-2 shadow-sm">
                  <Plus size={18} />
                  <span className="hidden sm:inline">Создать</span>
                </button>
              </div>
            )}
          </div>
          
          {/* Tabs: Документы / Вложения из задач + View Mode Toggle */}
          <div className="mb-4 flex items-center justify-between gap-4">
            <Tabs
                tabs={[
                    { id: 'docs', label: 'Документы' },
                    { id: 'attachments', label: 'Вложения' }
                ]}
                activeTab={activeTab}
                onChange={(tabId) => setActiveTab(tabId as 'docs' | 'attachments')}
            />
            {activeTab === 'docs' && (
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#252525] rounded-full p-1 text-xs">
                <button onClick={() => setViewMode('grid')} className={`px-3 py-1.5 rounded-full ${viewMode === 'grid' ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}>
                  Плитка
                </button>
                <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-full ${viewMode === 'list' ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}>
                  Список
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="max-w-7xl mx-auto w-full px-6 pb-20 h-full overflow-y-auto custom-scrollbar">
          {activeTab === 'docs' ? (
            <>
              {renderBreadcrumbs()}
              {viewMode === 'grid' ? (
               <div className="space-y-8">
                   {/* FOLDERS GRID */}
                   {visibleFolders.length > 0 && (
                       <div>
                           <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3 ml-1">Папки</h3>
                           <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                               {visibleFolders.map(folder => (
                                   <div 
                                        key={folder.id} 
                                        className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-4 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer group relative flex flex-col items-center text-center gap-3"
                                        onClick={() => handleFolderClick(folder.id)}
                                   >
                                        <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-500 rounded-full flex items-center justify-center">
                                            <FolderIcon size={24} fill="currentColor" className="opacity-20 text-blue-600 dark:text-blue-400"/>
                                            <FolderIcon size={24} className="absolute text-blue-600 dark:text-blue-400"/>
                                        </div>
                                        <div className="font-medium text-gray-800 dark:text-gray-200 text-sm truncate w-full px-2">{folder.name}</div>
                                        {showAll && (
                                            <div className="text-[10px] text-gray-400 bg-gray-100 dark:bg-[#333] px-2 py-0.5 rounded truncate max-w-full">
                                                {getTableName(folder.tableId)}
                                            </div>
                                        )}
                                        
                                        {!showAll && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteFolderSafe(folder); }}
                                                className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30"
                                                title="Удалить папку"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                   </div>
                               ))}
                           </div>
                       </div>
                   )}

                   {/* DOCS GRID */}
                   <div>
                       {visibleFolders.length > 0 && visibleDocs.length > 0 && <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3 mt-6 ml-1">Файлы</h3>}
                       
                       {visibleDocs.length === 0 && visibleFolders.length === 0 ? (
                           <div className="text-center py-12 border-2 border-dashed border-gray-100 dark:border-[#333] rounded-xl bg-gray-50/50 dark:bg-[#202020] flex flex-col items-center">
                               <FileText size={48} className="text-gray-300 dark:text-gray-600 mb-3" />
                               <p className="text-gray-500 dark:text-gray-400 font-medium">Здесь пока пусто</p>
                               <p className="text-gray-400 dark:text-gray-500 text-sm">Создайте папку или добавьте документ</p>
                           </div>
                       ) : (
                           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                               {visibleDocs.map(doc => (
                                    <div key={doc.id} className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg p-4 hover:shadow-md transition-all group relative">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className={`p-2 rounded-lg ${doc.type === 'internal' ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                                                {doc.type === 'internal' ? <FileText size={20}/> : <ExternalLink size={20}/>}
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {onEditDoc && (
                                                    <button onClick={(e) => { e.stopPropagation(); onEditDoc(doc); }} className="text-gray-300 hover:text-blue-500 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30" title="Редактировать">
                                                        <Edit2 size={14}/>
                                                    </button>
                                                )}
                                                {onDeleteDoc && !showAll && (
                                                    <button onClick={(e) => { e.stopPropagation(); onDeleteDoc(doc.id); }} className="text-gray-300 hover:text-red-500 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30" title="Удалить">
                                                        <Trash2 size={14}/>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div onClick={() => onOpenDoc(doc)} className="cursor-pointer">
                                            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">{doc.title}</h3>
                                            {showAll && (
                                                <div className="text-[10px] text-gray-400 mb-2 flex items-center gap-1">
                                                    <Box size={10} /> {getTableName(doc.tableId)}
                                                </div>
                                            )}
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {doc.tags.map(tag => <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-[#303030] text-gray-600 dark:text-gray-400 rounded border border-gray-200 dark:border-gray-600">{tag}</span>)}
                                            </div>
                                        </div>
                                    </div>
                               ))}
                           </div>
                       )}
                   </div>
               </div>
           ) : (
               // LIST VIEW (TABLE)
               <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] rounded-xl shadow-sm overflow-hidden">
                   <table className="w-full text-left text-sm">
                       <thead className="bg-gray-50 dark:bg-[#252525] border-b border-gray-200 dark:border-[#333] text-gray-500 dark:text-gray-400">
                           <tr>
                               <th className="px-4 py-3 font-semibold w-12"></th>
                               <th className="px-4 py-3 font-semibold">Название</th>
                               {showAll && <th className="px-4 py-3 font-semibold w-32">Источник</th>}
                               <th className="px-4 py-3 font-semibold w-32">Тип</th>
                               <th className="px-4 py-3 font-semibold w-48">Теги</th>
                               {!showAll && <th className="px-4 py-3 w-10"></th>}
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
                           {/* Folders first in List View */}
                           {visibleFolders.map(folder => (
                               <tr key={folder.id} onClick={() => handleFolderClick(folder.id)} className="hover:bg-gray-50 dark:hover:bg-[#252525] cursor-pointer group">
                                   <td className="px-4 py-3 text-center text-blue-500">
                                       <FolderIcon size={18} fill="currentColor" className="opacity-20"/>
                                   </td>
                                   <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-200">{folder.name}</td>
                                   {showAll && (
                                       <td className="px-4 py-3 text-xs text-gray-500">
                                           <span className="bg-gray-100 dark:bg-[#333] px-2 py-0.5 rounded">{getTableName(folder.tableId)}</span>
                                       </td>
                                   )}
                                   <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">Папка</td>
                                   <td className="px-4 py-3"></td>
                                   {!showAll && (
                                       <td className="px-4 py-3 text-right">
                                           <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteFolderSafe(folder); }} 
                                                className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={14}/>
                                            </button>
                                       </td>
                                   )}
                               </tr>
                           ))}

                           {visibleDocs.map(doc => {
                               return (
                                   <tr key={doc.id} onClick={() => onOpenDoc(doc)} className="hover:bg-gray-50 dark:hover:bg-[#252525] cursor-pointer group">
                                       <td className="px-4 py-3 text-center text-gray-400">
                                            {doc.type === 'internal' ? <FileText size={16} /> : <ExternalLink size={16} />}
                                       </td>
                                       <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{doc.title}</td>
                                       {showAll && (
                                           <td className="px-4 py-3 text-xs text-gray-500">
                                               <span className="bg-gray-100 dark:bg-[#333] px-2 py-0.5 rounded">{getTableName(doc.tableId)}</span>
                                           </td>
                                       )}
                                       <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                                           {doc.type === 'internal' ? 'Статья' : 'Ссылка'}
                                       </td>
                                       <td className="px-4 py-3">
                                           <div className="flex gap-1 flex-wrap">
                                               {doc.tags.map(t => <span key={t} className="text-[10px] bg-gray-100 dark:bg-[#303030] px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400 rounded border border-gray-200 dark:border-gray-600">{t}</span>)}
                                           </div>
                                       </td>
                                       {!showAll && (
                                           <td className="px-4 py-3 text-right">
                                                {onDeleteDoc && (
                                                    <button onClick={(e) => { e.stopPropagation(); onDeleteDoc(doc.id); }} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Trash2 size={14}/>
                                                    </button>
                                                )}
                                           </td>
                                       )}
                                   </tr>
                               );
                           })}
                           {visibleDocs.length === 0 && visibleFolders.length === 0 && <tr><td colSpan={showAll ? 6 : 5} className="text-center py-8 text-gray-400 dark:text-gray-500">Нет документов</td></tr>}
                       </tbody>
                   </table>
               </div>
           )}
            </>
          ) : (
            // Вкладка "Вложения из задач"
            renderAttachmentsTab()
          )}
        </div>
      </div>

      {/* Create Folder Modal */}
      {isFolderModalOpen && (
           <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80] animate-in fade-in duration-200">
               <div className="bg-white dark:bg-[#252525] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-200 dark:border-[#333] p-6">
                   <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                       <FolderPlus size={20} className="text-blue-500"/>
                       Новая папка
                   </h3>
                   <form onSubmit={handleCreateFolderSubmit}>
                       <input 
                            autoFocus
                            required
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="Название папки"
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 mb-4 focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100"
                       />
                       <div className="flex justify-end gap-2">
                           <Button type="button" variant="secondary" onClick={() => setIsFolderModalOpen(false)} size="md">Отмена</Button>
                           <Button type="submit" size="md">Создать</Button>
                       </div>
                   </form>
               </div>
           </div>
      )}
      {previewFile && (
        <FilePreviewModal
          url={previewFile.url}
          name={previewFile.name}
          type={previewFile.type}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
    </>
  );
};

export default DocumentsView;
