
import React, { useState } from 'react';
import { Project, StatusOption, PriorityOption, TableCollection } from '../../types';
import { Trash2, Plus, Pencil, CheckSquare, FileText, Users, Instagram, Archive, Layers } from 'lucide-react';
import { LABEL_COLORS, PRIORITY_COLORS, ICON_OPTIONS, COLOR_OPTIONS } from '../../constants';
import { DynamicIcon } from '../AppIcons';

interface SpaceSettingsProps {
  activeTab: string;
  tables: TableCollection[];
  projects: Project[];
  statuses: StatusOption[];
  priorities: PriorityOption[];
  onUpdateTable: (table: TableCollection) => void;
  onCreateTable: () => void;
  onDeleteTable: (id: string) => void;
  onUpdateProjects: (projects: Project[]) => void;
  onUpdateStatuses: (statuses: StatusOption[]) => void;
  onUpdatePriorities: (priorities: PriorityOption[]) => void;
}

export const SpaceSettings: React.FC<SpaceSettingsProps> = ({
    activeTab, tables, projects, statuses, priorities,
    onUpdateTable, onCreateTable, onDeleteTable,
    onUpdateProjects, onUpdateStatuses, onUpdatePriorities
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  // Projects
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectIcon, setNewProjectIcon] = useState('Briefcase');
  const [newProjectColor, setNewProjectColor] = useState(COLOR_OPTIONS[0]);

  // Status/Priority
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState(LABEL_COLORS[0].class);
  const [newPriorityName, setNewPriorityName] = useState('');
  const [newPriorityColor, setNewPriorityColor] = useState(PRIORITY_COLORS[0].class);

  // Pages
  const [newPageName, setNewPageName] = useState('');
  const [newPageIcon, setNewPageIcon] = useState('');
  const [newPageColor, setNewPageColor] = useState('');
  const [newPageType, setNewPageType] = useState('tasks');

  // --- Handlers ---
  
  const handleSaveProject = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newProjectName.trim()) return;
      if (editingId) {
          onUpdateProjects(projects.map(p => p.id === editingId ? { ...p, name: newProjectName, icon: newProjectIcon, color: newProjectColor } : p));
          setEditingId(null);
      } else {
          onUpdateProjects([...projects, { id: `p-${Date.now()}`, name: newProjectName, icon: newProjectIcon, color: newProjectColor }]);
      }
      setNewProjectName('');
  };
  const handleEditProject = (p: Project) => { setEditingId(p.id); setNewProjectName(p.name); setNewProjectIcon(p.icon || 'Briefcase'); setNewProjectColor(p.color || 'text-blue-500'); };

  const handleSaveStatus = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newStatusName.trim()) return;
      if (editingId) {
          onUpdateStatuses(statuses.map(s => s.id === editingId ? { ...s, name: newStatusName, color: newStatusColor } : s));
          setEditingId(null);
      } else {
          onUpdateStatuses([...statuses, { id: `s-${Date.now()}`, name: newStatusName, color: newStatusColor }]);
      }
      setNewStatusName('');
  };
  const handleEditStatus = (s: StatusOption) => { setEditingId(s.id); setNewStatusName(s.name); setNewStatusColor(s.color); };

  const handleSavePriority = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newPriorityName.trim()) return;
      if (editingId) {
          onUpdatePriorities(priorities.map(p => p.id === editingId ? { ...p, name: newPriorityName, color: newPriorityColor } : p));
          setEditingId(null);
      } else {
          onUpdatePriorities([...priorities, { id: `pr-${Date.now()}`, name: newPriorityName, color: newPriorityColor }]);
      }
      setNewPriorityName('');
  };
  const handleEditPriority = (p: PriorityOption) => { setEditingId(p.id); setNewPriorityName(p.name); setNewPriorityColor(p.color); };

  const handleSavePage = (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingId) return;
      const table = tables.find(t => t.id === editingId);
      if (table) {
          onUpdateTable({ ...table, name: newPageName, icon: newPageIcon, color: newPageColor, type: newPageType as any });
          setEditingId(null);
      }
  };
  const handleEditPage = (t: TableCollection) => {
      setEditingId(t.id); setNewPageName(t.name); setNewPageIcon(t.icon); setNewPageColor(t.color || 'text-gray-500'); setNewPageType(t.type);
  };

  // --- Render ---

  if (activeTab === 'pages') {
      return (
          <div className="space-y-6 max-w-3xl">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-gray-800 dark:text-white">Проекты</h3>
                  <button onClick={onCreateTable} className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-100">
                      <Plus size={16}/> Создать проект
                  </button>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Здесь отображаются только проекты внутри модулей (Контент планы, Беклог, Функционал). 
                  Системные модули (Встречи, Документы) не требуют создания страниц.
              </p>

              {editingId && (
                  <form onSubmit={handleSavePage} className="p-6 bg-gray-50 dark:bg-[#202020] rounded-xl border border-gray-200 dark:border-[#333] space-y-4 mb-6">
                      <h3 className="font-bold text-gray-800 dark:text-white">Редактировать страницу</h3>
                      <input value={newPageName} onChange={e => setNewPageName(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100" placeholder="Название" />
                      
                      <div className="p-3 bg-white dark:bg-[#252525] rounded border border-gray-200 dark:border-[#333]">
                          <label className="block text-xs font-bold text-gray-500 mb-2">Отображение</label>
                          <div className="space-y-2">
                              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked disabled className="rounded text-blue-600"/> Таблица</label>
                              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked disabled className="rounded text-blue-600"/> Канбан Доска</label>
                              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked disabled className="rounded text-blue-600"/> Таймлайн (Гант)</label>
                          </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-2">Тип</label>
                            <div className="grid grid-cols-2 gap-2">
                                {/* Только проекты внутри модулей - системные модули больше не создаются */}
                                {[{id:'content-plan',icon:<Instagram size={16}/>,l:'Контент-план'},{id:'backlog',icon:<Archive size={16}/>,l:'Бэклог'},{id:'functionality',icon:<Layers size={16}/>,l:'Функционал'}].map(t => (
                                    <div key={t.id} onClick={() => setNewPageType(t.id)} className={`cursor-pointer border rounded p-2 text-center text-xs flex flex-col items-center gap-1 ${newPageType === t.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'border-gray-200 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#303030]'}`}>
                                        {t.icon}{t.l}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-2">Иконка</label>
                            <div className="grid grid-cols-6 gap-2 bg-white dark:bg-[#252525] p-2 rounded border border-gray-200 dark:border-gray-600 max-h-32 overflow-y-auto custom-scrollbar">
                                {ICON_OPTIONS.map(icon => (
                                    <div key={icon} onClick={() => setNewPageIcon(icon)} className={`p-1.5 rounded cursor-pointer flex justify-center hover:bg-gray-100 dark:hover:bg-[#404040] ${newPageIcon === icon ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-500' : 'text-gray-400'}`}>
                                        <DynamicIcon name={icon} size={16} />
                                    </div>
                                ))}
                            </div>
                        </div>
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-2">Цвет</label>
                          <div className="grid grid-cols-9 gap-2">
                              {COLOR_OPTIONS.map(c => (
                                  <div key={c} onClick={() => setNewPageColor(c)} className={`w-6 h-6 rounded-full cursor-pointer border-2 ${newPageColor === c ? 'border-gray-900 dark:border-white' : 'border-transparent'}`}><div className={`w-full h-full rounded-full ${c.replace('text-', 'bg-').replace('500', '400')}`}></div></div>
                              ))}
                          </div>
                      </div>

                      <div className="flex gap-2 justify-end pt-2">
                          <button type="button" onClick={() => setEditingId(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Отмена</button>
                          <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Сохранить</button>
                      </div>
                  </form>
              )}

              <div className="space-y-3">
                  {tables
                      .filter(table => {
                          // Фильтруем архивные таблицы
                          if (table.isArchived) return false;
                          // Фильтруем системные страницы - они больше не нужны
                          // Встречи, документы, контент-планы, беклог и функционал теперь хардкодные модули
                          const systemTypes = ['meetings', 'docs', 'content-plan', 'backlog', 'functionality'];
                          // Показываем только если НЕ системная страница с типом из списка системных
                          return !(table.isSystem && systemTypes.includes(table.type));
                      })
                      .map(table => (
                      <div key={table.id} className="flex items-center justify-between p-4 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl hover:shadow-sm transition-all group">
                          <div className="flex items-center gap-4">
                              <div className={`p-2 rounded-lg ${table.isSystem ? 'bg-gray-100 dark:bg-[#333]' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'}`}>
                                  <DynamicIcon name={table.icon} className={table.color} />
                              </div>
                              <div>
                                  <div className="font-bold text-gray-900 dark:text-white text-sm">{table.name}</div>
                                  {table.isSystem && <span className="text-[10px] uppercase font-bold text-gray-400">Системная</span>}
                              </div>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEditPage(table)} className="p-2 text-gray-400 hover:text-blue-500 rounded-lg bg-gray-50 dark:bg-[#333]"><Pencil size={16}/></button>
                              {!table.isSystem && onDeleteTable && (
                                  <button onClick={() => { if(confirm('Удалить?')) onDeleteTable(table.id) }} className="p-2 text-gray-400 hover:text-red-500 rounded-lg bg-gray-50 dark:bg-[#333]"><Trash2 size={16}/></button>
                              )}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      );
  }

  if (activeTab === 'projects') {
      return (
          <div className="space-y-6 max-w-3xl">
              <form onSubmit={handleSaveProject} className="p-6 bg-gray-50 dark:bg-[#202020] rounded-xl border border-gray-200 dark:border-[#333] space-y-4">
                  <input value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="Название модуля" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100" />
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Иконка</label>
                          <div className="grid grid-cols-6 gap-2 bg-white dark:bg-[#252525] p-2 rounded border border-gray-200 dark:border-gray-600 max-h-32 overflow-y-auto custom-scrollbar">{ICON_OPTIONS.map(icon => (<div key={icon} onClick={() => setNewProjectIcon(icon)} className={`p-1.5 rounded cursor-pointer flex justify-center hover:bg-gray-100 dark:hover:bg-[#404040] ${newProjectIcon === icon ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-500' : 'text-gray-400'}`}><DynamicIcon name={icon} size={16}/></div>))}</div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Цвет</label>
                          <div className="grid grid-cols-5 gap-2">{COLOR_OPTIONS.map(c => (<div key={c} onClick={() => setNewProjectColor(c)} className={`w-6 h-6 rounded-full cursor-pointer border-2 ${newProjectColor === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'}`}><div className={`w-full h-full rounded-full ${c.replace('text-', 'bg-').replace('500', '400')}`}></div></div>))}</div>
                      </div>
                  </div>
                  <div className="flex justify-end gap-2">
                      {editingId && <button type="button" onClick={() => { setEditingId(null); setNewProjectName(''); }} className="text-gray-500 px-3 text-sm">Отмена</button>}
                      <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium">{editingId ? 'Сохранить' : 'Добавить'}</button>
                  </div>
              </form>
              <div className="grid grid-cols-2 gap-4">
                  {projects.map(p => (
                      <div key={p.id} className="p-4 border border-gray-200 dark:border-[#333] rounded-xl flex justify-between items-center gap-3 bg-white dark:bg-[#252525]">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Use resolveColorClass or direct color here if projects have mixed data formats, but for now use DynamicIcon and assume new format */}
                            <DynamicIcon name={p.icon || 'Briefcase'} className={p.color} size={20} />
                            <span className="text-sm font-bold text-gray-800 dark:text-white truncate">{p.name}</span>
                          </div>
                          <div className="flex gap-1 shrink-0"><button onClick={() => handleEditProject(p)} className="p-1.5 text-gray-400 hover:text-blue-500"><Pencil size={14}/></button><button onClick={() => onUpdateProjects(projects.filter(pr => pr.id !== p.id))} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={14}/></button></div>
                      </div>
                  ))}
              </div>
          </div>
      );
  }

  if (activeTab === 'statuses' || activeTab === 'priorities') {
      const isStatus = activeTab === 'statuses';
      const items = isStatus ? statuses : priorities;
      const saveHandler = isStatus ? handleSaveStatus : handleSavePriority;
      const editHandler = isStatus ? handleEditStatus : handleEditPriority;
      const deleteHandler = isStatus ? onUpdateStatuses : onUpdatePriorities;
      const nameVal = isStatus ? newStatusName : newPriorityName;
      const setName = isStatus ? setNewStatusName : setNewPriorityName;
      const colorVal = isStatus ? newStatusColor : newPriorityColor;
      const setColor = isStatus ? setNewStatusColor : setNewPriorityColor;
      const colorsList = isStatus ? LABEL_COLORS : PRIORITY_COLORS;

      return (
          <div className="space-y-6 max-w-2xl">
              <form onSubmit={saveHandler} className="p-6 bg-gray-50 dark:bg-[#202020] rounded-xl border border-gray-200 dark:border-[#333] space-y-4">
                  <input value={nameVal} onChange={e => setName(e.target.value)} placeholder={isStatus ? "Название статуса" : "Название приоритета"} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100" />
                  <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">ВЫБЕРИТЕ ЦВЕТ</label>
                      <div className="flex gap-3 flex-wrap">
                          {colorsList.map(c => {
                              const colorClass = c.class || c.name;
                              // Извлекаем цвет из класса для отображения в кружке
                              // Ищем первый bg- класс в строке
                              const bgMatches = colorClass.match(/bg-(\w+)-(\d+)/g);
                              let bgColor = 'bg-gray-400';
                              if (bgMatches && bgMatches.length > 0) {
                                  // Берем первый bg- класс и используем его напрямую
                                  bgColor = bgMatches[0];
                              }
                              return (
                                  <div key={colorClass} onClick={() => setColor(colorClass)} className={`w-10 h-10 rounded-full cursor-pointer border-2 transition-all flex items-center justify-center ${colorVal === colorClass ? 'border-gray-900 dark:border-white scale-110 ring-2 ring-offset-2 ring-blue-500' : 'border-gray-300 dark:border-gray-600 hover:scale-105'}`}>
                                      <div className={`w-8 h-8 rounded-full ${bgColor}`}></div>
                                  </div>
                              );
                          })}
                      </div>
                  </div>
                  <div className="flex justify-end gap-2">
                      {editingId && <button type="button" onClick={() => { setEditingId(null); setName(''); }} className="text-gray-500 px-3 text-sm">Отмена</button>}
                      <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium">{editingId ? 'Сохранить' : 'Добавить'}</button>
                  </div>
              </form>
              <div className="space-y-2">
                  {items.map((item: any) => {
                      // Используем цвет напрямую из item.color, он уже содержит полный класс
                      const colorClass = item.color || 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700';
                      return (
                        <div key={item.id} className="flex items-center justify-between p-3 border border-gray-100 dark:border-[#333] rounded-lg bg-white dark:bg-[#252525]">
                            <span className={`px-3 py-1.5 rounded-md text-xs font-bold ${colorClass}`}>{item.name}</span>
                            <div className="flex gap-1">
                                <button onClick={() => editHandler(item)} className="p-1.5 text-gray-400 hover:text-blue-500"><Pencil size={14}/></button>
                                <button onClick={() => deleteHandler(items.filter((i: any) => i.id !== item.id) as any)} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                            </div>
                        </div>
                      );
                  })}
              </div>
          </div>
      );
  }

  return null;
};
