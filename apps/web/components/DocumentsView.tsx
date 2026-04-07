
import React, { useState, useRef, useLayoutEffect } from 'react';
import { Doc, Folder, TableCollection, Task, TaskAttachment, User, Department, EmployeeInfo } from '../types';
import { FileText, Folder as FolderIcon, Trash2, ExternalLink, ChevronRight, FolderPlus, Box, FileText as FileTextIcon, Paperclip, File as FileIcon, Edit2, Calendar, Users } from 'lucide-react';
import {
  Button,
  ModuleCreateDropdown,
  ModulePageShell,
  ModuleSegmentedControl,
  MODULE_PAGE_GUTTER,
} from './ui';
import { useAppToolbar } from '../contexts/AppToolbarContext';
import { FilePreviewModal } from './FilePreviewModal';
import { isImageFile } from '../utils/fileUtils';
import { WeeklyPlansView, type WeeklyPlansViewHandle } from './documents/WeeklyPlansView';
import { ProtocolsView, type ProtocolsViewHandle } from './documents/ProtocolsView';
import { ModuleFilterIconButton } from './ui/ModuleFilterIconButton';

interface DocumentsViewProps {
  docs: Doc[];
  folders: Folder[];
  tableId: string;
  showAll?: boolean; // Aggregator mode
  tables?: TableCollection[];
  tasks?: Task[];
  users?: User[];
  departments?: Department[];
  employees?: EmployeeInfo[];
  currentUser?: User;
  onOpenDoc: (doc: Doc) => void;
  onAddDoc: (folderId?: string) => void;
  onCreateFolder: (name: string, parentFolderId?: string) => void;
  onDeleteFolder: (id: string) => void;
  onUpdateFolder?: (folder: Folder) => void;
  onDeleteDoc?: (id: string) => void;
  onEditDoc?: (doc: Doc) => void;
  onOpenTask?: (task: Task) => void;
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void;
  onDeleteAttachment?: (taskId: string, attachmentId: string) => void;
}

const DocumentsView: React.FC<DocumentsViewProps> = ({ 
    docs, 
    folders, 
    tableId,
    showAll = false,
    tables = [],
    tasks = [],
    users = [],
    departments = [],
    employees = [],
    currentUser,
    onOpenDoc, 
    onAddDoc, 
    onCreateFolder,
    onDeleteFolder,
    onUpdateFolder,
    onDeleteDoc,
    onEditDoc,
    onOpenTask,
    onUpdateTask,
    onDeleteAttachment
}) => {
  const { setModule } = useAppToolbar();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [folderPath, setFolderPath] = useState<string[]>([]);
  const [docSection, setDocSection] = useState<'docs' | 'attachments' | 'weekly' | 'protocols'>('docs');
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const weeklyPlansRef = useRef<WeeklyPlansViewHandle>(null);
  const protocolsRef = useRef<ProtocolsViewHandle>(null);
  
  // Modal State
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameFolderTarget, setRenameFolderTarget] = useState<Folder | null>(null);
  const [renameFolderName, setRenameFolderName] = useState('');

  // Получаем текущую папку (последняя в пути)
  const currentFolderId = folderPath.length > 0 ? folderPath[folderPath.length - 1] : null;
  
  // Папки таблицы (архивные не показываем; GET /folders тоже отдаёт только неархивные)
  const allFolders = folders.filter(
    (f) => (showAll ? true : f.tableId === tableId) && !f.isArchived
  );
  
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

  const goToDocsRoot = () => {
    setDocSection('docs');
    setFolderPath([]);
  };

  const handleDeleteFolderSafe = (folder: Folder) => {
      const hasDocs = docs.some((d) => d.folderId === folder.id && !d.isArchived);
      const hasSubfolders = allFolders.some((f) => f.parentFolderId === folder.id);
      const msg =
          hasDocs || hasSubfolders
              ? `Папка «${folder.name}» не пуста. Переместить её в архив? Она скроется из списка.`
              : `Удалить папку «${folder.name}»?`;
      if (confirm(msg)) {
          onDeleteFolder(folder.id);
      }
  };

  const handleRenameFolderSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!renameFolderTarget || !onUpdateFolder) return;
      const name = renameFolderName.trim();
      if (!name) return;
      onUpdateFolder({ ...renameFolderTarget, name });
      setRenameFolderTarget(null);
      setRenameFolderName('');
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

  const renderBreadcrumbs = () => {
    if (docSection === 'attachments') {
      return (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4 flex-wrap">
          <button type="button" className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 px-1 py-0.5 rounded transition-colors text-left" onClick={goToDocsRoot}>
            Документы
          </button>
          <ChevronRight size={14} className="text-gray-400 shrink-0" />
          <span className="font-semibold text-gray-800 dark:text-gray-200">Вложения</span>
        </div>
      );
    }
    if (docSection === 'weekly') {
      return (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4 flex-wrap">
          <button type="button" className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 px-1 py-0.5 rounded transition-colors text-left" onClick={goToDocsRoot}>
            Документы
          </button>
          <ChevronRight size={14} className="text-gray-400 shrink-0" />
          <span className="font-semibold text-gray-800 dark:text-gray-200">Недельные планы</span>
        </div>
      );
    }
    if (docSection === 'protocols') {
      return (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4 flex-wrap">
          <button type="button" className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 px-1 py-0.5 rounded transition-colors text-left" onClick={goToDocsRoot}>
            Документы
          </button>
          <ChevronRight size={14} className="text-gray-400 shrink-0" />
          <span className="font-semibold text-gray-800 dark:text-gray-200">Протоколы</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4 flex-wrap">
        <button
          type="button"
          className={`cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 px-1 py-0.5 rounded transition-colors text-left ${!currentFolderId ? 'font-semibold text-gray-800 dark:text-gray-200' : ''}`}
          onClick={handleBackToRoot}
        >
          {showAll ? 'Все документы' : 'Документы'}
        </button>
        {folderPathArray.map((folder, index) => (
          <React.Fragment key={folder.id}>
            <ChevronRight size={14} className="text-gray-400 shrink-0" />
            <button
              type="button"
              className={`cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 px-1 py-0.5 rounded transition-colors flex items-center gap-2 text-left ${
                index === folderPathArray.length - 1 ? 'font-semibold text-gray-800 dark:text-gray-200' : ''
              }`}
              onClick={() => handleBreadcrumbClick(index)}
            >
              <FolderIcon size={14} className="text-blue-500 shrink-0" />
              {folder.name}
            </button>
          </React.Fragment>
        ))}
      </div>
    );
  };

  const systemFolderCards: { id: 'attachments' | 'weekly' | 'protocols'; label: string; desc: string; icon: typeof Paperclip }[] = [
    { id: 'attachments', label: 'Вложения', desc: 'Файлы из задач', icon: Paperclip },
    { id: 'weekly', label: 'Недельные планы', desc: 'Планы по неделям', icon: Calendar },
    { id: 'protocols', label: 'Протоколы', desc: 'Записи встреч', icon: Users },
  ];

  useLayoutEffect(() => {
    setModule(
      <div className="flex items-center gap-2 shrink-0">
        {docSection === 'docs' && (
          <ModuleSegmentedControl
            size="sm"
            variant="accent"
            accent="slate"
            value={viewMode}
            onChange={(v) => setViewMode(v)}
            options={[
              { value: 'grid', label: 'Плитка' },
              { value: 'list', label: 'Список' },
            ]}
          />
        )}
        {(docSection === 'weekly' || docSection === 'protocols') && (
          <ModuleFilterIconButton
            active={false}
            onClick={() => {
              if (docSection === 'weekly') weeklyPlansRef.current?.toggleFilters();
              else protocolsRef.current?.toggleFilters();
            }}
            title={docSection === 'weekly' ? 'Фильтры недельных планов' : 'Фильтры протоколов'}
          />
        )}
        <ModuleCreateDropdown
          accent="slate"
          items={[
            {
              id: 'doc',
              label: 'Документ',
              icon: FileTextIcon,
              onClick: () => onAddDoc(currentFolderId || undefined),
            },
            {
              id: 'weekly-plan',
              label: 'Недельный план',
              icon: Calendar,
              onClick: () => weeklyPlansRef.current?.openCreateModal(),
            },
            {
              id: 'protocol',
              label: 'Протокол',
              icon: Users,
              onClick: () => protocolsRef.current?.createProtocol(),
            },
            ...(docSection === 'docs'
              ? [
                  {
                    id: 'folder',
                    label: 'Папка',
                    icon: FolderPlus,
                    onClick: () => setIsFolderModalOpen(true),
                  },
                ]
              : []),
          ]}
        />
      </div>
    );
    return () => setModule(null);
  }, [docSection, viewMode, currentFolderId, setModule, onAddDoc]);

  return (
    <>
    <ModulePageShell>
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={`${MODULE_PAGE_GUTTER} pt-3 md:pt-5 pb-16 md:pb-20 h-full overflow-y-auto custom-scrollbar`}>
          {docSection === 'docs' ? (
            <>
              {renderBreadcrumbs()}
              {viewMode === 'grid' ? (
               <div className="space-y-8">
                   {/* FOLDERS GRID + системные разделы в той же сетке */}
                   {((!currentFolderId && systemFolderCards.length > 0) || visibleFolders.length > 0) && (
                       <div>
                           <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3 ml-1">
                             {!currentFolderId ? 'Папки и разделы' : 'Папки'}
                           </h3>
                           <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                               {!currentFolderId &&
                                 systemFolderCards.map((sys) => {
                                   const Icon = sys.icon;
                                   return (
                                     <div
                                       key={`sys-${sys.id}`}
                                       className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-4 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer group relative flex flex-col items-center text-center gap-3"
                                       onClick={() => {
                                         setDocSection(sys.id);
                                         setFolderPath([]);
                                       }}
                                       role="button"
                                       tabIndex={0}
                                       onKeyDown={(e) => {
                                         if (e.key === 'Enter' || e.key === ' ') {
                                           e.preventDefault();
                                           setDocSection(sys.id);
                                           setFolderPath([]);
                                         }
                                       }}
                                     >
                                       <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 rounded-full flex items-center justify-center">
                                         <Icon size={24} />
                                       </div>
                                       <div className="font-medium text-gray-800 dark:text-gray-200 text-sm truncate w-full px-2">
                                         {sys.label}
                                       </div>
                                       <div className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2 px-1">{sys.desc}</div>
                                     </div>
                                   );
                                 })}
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

                                        <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {onUpdateFolder && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setRenameFolderTarget(folder);
                                                        setRenameFolderName(folder.name);
                                                    }}
                                                    className="text-gray-300 hover:text-blue-500 p-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30"
                                                    title="Переименовать"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteFolderSafe(folder);
                                                }}
                                                className="text-gray-300 hover:text-red-500 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30"
                                                title="В архив"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                   </div>
                               ))}
                           </div>
                       </div>
                   )}

                   {/* DOCS GRID */}
                   <div>
                       {(visibleFolders.length > 0 || (!currentFolderId && systemFolderCards.length > 0)) &&
                         visibleDocs.length > 0 && (
                           <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3 mt-6 ml-1">Файлы</h3>
                         )}

                       {visibleDocs.length === 0 && visibleFolders.length === 0 && currentFolderId ? (
                           <div className="text-center py-12 border-2 border-dashed border-gray-100 dark:border-[#333] rounded-xl bg-gray-50/50 dark:bg-[#202020] flex flex-col items-center">
                               <FileText size={48} className="text-gray-300 dark:text-gray-600 mb-3" />
                               <p className="text-gray-500 dark:text-gray-400 font-medium">Здесь пока пусто</p>
                               <p className="text-gray-400 dark:text-gray-500 text-sm">Создайте папку или добавьте документ</p>
                           </div>
                       ) : visibleDocs.length === 0 && visibleFolders.length === 0 ? null : (
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
                                                {onDeleteDoc && (
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
               <div className="overflow-hidden">
                   <table className="w-full text-left text-sm">
                       <thead className="bg-gray-50 dark:bg-[#252525] border-b border-gray-200 dark:border-[#333] text-gray-500 dark:text-gray-400">
                           <tr>
                               <th className="px-4 py-3 font-semibold w-12"></th>
                               <th className="px-4 py-3 font-semibold">Название</th>
                               {showAll && <th className="px-4 py-3 font-semibold w-32">Источник</th>}
                               <th className="px-4 py-3 font-semibold w-32">Тип</th>
                               <th className="px-4 py-3 font-semibold w-48">Теги</th>
                               <th className="px-4 py-3 w-24 text-right"></th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
                           {!currentFolderId &&
                             systemFolderCards.map((sys) => {
                               const Icon = sys.icon;
                               return (
                                 <tr
                                   key={`sys-${sys.id}`}
                                   onClick={() => {
                                     setDocSection(sys.id);
                                     setFolderPath([]);
                                   }}
                                   className="hover:bg-gray-50 dark:hover:bg-[#252525] cursor-pointer group bg-indigo-50/40 dark:bg-indigo-950/15"
                                 >
                                   <td className="px-4 py-3 text-center text-indigo-600 dark:text-indigo-400">
                                     <Icon size={18} />
                                   </td>
                                   <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-200">
                                     {sys.label}
                                     <span className="block text-[11px] font-normal text-gray-500 dark:text-gray-400 mt-0.5">
                                       {sys.desc}
                                     </span>
                                   </td>
                                   {showAll && <td className="px-4 py-3 text-xs text-gray-500">—</td>}
                                   <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">Раздел</td>
                                   <td className="px-4 py-3"></td>
                                   <td className="px-4 py-3"></td>
                                 </tr>
                               );
                             })}
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
                                   <td className="px-4 py-3 text-right">
                                       <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                           {onUpdateFolder && (
                                               <button
                                                   type="button"
                                                   onClick={(e) => {
                                                       e.stopPropagation();
                                                       setRenameFolderTarget(folder);
                                                       setRenameFolderName(folder.name);
                                                   }}
                                                   className="text-gray-300 hover:text-blue-500 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30"
                                                   title="Переименовать"
                                               >
                                                   <Edit2 size={14} />
                                               </button>
                                           )}
                                           <button
                                               type="button"
                                               onClick={(e) => {
                                                   e.stopPropagation();
                                                   handleDeleteFolderSafe(folder);
                                               }}
                                               className="text-gray-300 hover:text-red-500 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30"
                                               title="В архив"
                                           >
                                               <Trash2 size={14} />
                                           </button>
                                       </div>
                                   </td>
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
                                       <td className="px-4 py-3 text-right">
                                                {onDeleteDoc && (
                                                    <button onClick={(e) => { e.stopPropagation(); onDeleteDoc(doc.id); }} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Trash2 size={14}/>
                                                    </button>
                                                )}
                                           </td>
                                   </tr>
                               );
                           })}
                           {visibleDocs.length === 0 && visibleFolders.length === 0 && currentFolderId && (
                             <tr><td colSpan={showAll ? 6 : 5} className="text-center py-8 text-gray-400 dark:text-gray-500">Нет документов</td></tr>
                           )}
                       </tbody>
                   </table>
               </div>
           )}
            </>
          ) : docSection === 'attachments' ? (
            <>
              {renderBreadcrumbs()}
              {renderAttachmentsTab()}
            </>
          ) : docSection === 'weekly' ? (
            <>
              {renderBreadcrumbs()}
              {currentUser ? (
                <WeeklyPlansView
                  ref={weeklyPlansRef}
                  layout="embedded"
                  hideEmbeddedToolbar
                  scope="all"
                  currentUser={currentUser}
                  users={users}
                  tasks={tasks}
                  onOpenTask={onOpenTask}
                  onUpdateTask={onUpdateTask}
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 dark:border-[#333] bg-gray-50/60 dark:bg-[#202020] p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  Нужна авторизация пользователя для просмотра недельных планов.
                </div>
              )}
            </>
          ) : (
            <>
              {renderBreadcrumbs()}
              <ProtocolsView
                ref={protocolsRef}
                layout="embedded"
                hideEmbeddedToolbar
                users={users}
                tasks={tasks}
                departments={departments}
                employees={employees}
                onOpenTask={onOpenTask}
              />
            </>
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
      {renameFolderTarget && onUpdateFolder && (
           <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80] animate-in fade-in duration-200">
               <div className="bg-white dark:bg-[#252525] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-200 dark:border-[#333] p-6">
                   <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                       <Edit2 size={20} className="text-blue-500"/>
                       Переименовать папку
                   </h3>
                   <form onSubmit={handleRenameFolderSubmit}>
                       <input 
                            autoFocus
                            required
                            value={renameFolderName}
                            onChange={(e) => setRenameFolderName(e.target.value)}
                            placeholder="Название папки"
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 mb-4 focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100"
                       />
                       <div className="flex justify-end gap-2">
                           <Button type="button" variant="secondary" onClick={() => { setRenameFolderTarget(null); setRenameFolderName(''); }} size="md">Отмена</Button>
                           <Button type="submit" size="md">Сохранить</Button>
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
    </ModulePageShell>
    </>
  );
};

export default DocumentsView;
