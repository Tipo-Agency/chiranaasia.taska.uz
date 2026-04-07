
import React, { useState, useMemo, useLayoutEffect, useCallback } from 'react';
import { EmployeeInfo, User, OrgPosition, Department } from '../types';
import { Search, Trash2, Edit2, Calendar, FileText, X, Save, User as UserIcon, Phone, Send, Cake, Network, Building2, UserPlus, ChevronDown, ChevronRight, FolderTree } from 'lucide-react';
import { ModuleCreateDropdown, ModulePageShell, MODULE_PAGE_GUTTER, MODULE_PAGE_TOP_PAD } from './ui';
import { useAppToolbar } from '../contexts/AppToolbarContext';
import { TaskSelect } from './TaskSelect';
import { getDefaultAvatarForId } from '../constants/avatars';
import { formatDate, normalizeDateForInput } from '../utils/dateUtils';
import { DateInput } from './ui/DateInput';

interface EmployeesViewProps {
  employees: EmployeeInfo[];
  users: User[]; // Auth users to link
  departments?: Department[]; // For OrgChart
  orgPositions?: OrgPosition[]; // For OrgChart
  onSave: (info: EmployeeInfo) => void;
  onDelete: (id: string) => void;
  onSavePosition?: (pos: OrgPosition) => void;
  onDeletePosition?: (id: string) => void;
}

const EmployeesView: React.FC<EmployeesViewProps> = ({ 
    employees, users, 
    departments = [], orgPositions = [], 
    onSave, onDelete, onSavePosition, onDeletePosition 
}) => {
  const { setLeading, setModule } = useAppToolbar();
  const [activeTab, setActiveTab] = useState<'cards' | 'orgchart' | 'structure'>('cards');
  
  // Card Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInfo, setEditingInfo] = useState<EmployeeInfo | null>(null);
  
  // Org Position Modal
  const [isPosModalOpen, setIsPosModalOpen] = useState(false);
  const [editingPos, setEditingPos] = useState<OrgPosition | null>(null);

  // Form (Cards)
  const [userId, setUserId] = useState('');
  const [orgPositionId, setOrgPositionId] = useState('');
  const [position, setPosition] = useState('');
  const [hireDate, setHireDate] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [draggedUserId, setDraggedUserId] = useState<string | null>(null);

  // Form (Org Position)
  const [posTitle, setPosTitle] = useState('');
  const [posDep, setPosDep] = useState('');
  const [posManager, setPosManager] = useState('');
  const [posHolder, setPosHolder] = useState('');
  const [posOrder, setPosOrder] = useState<number>(0);
  const [posTaskMode, setPosTaskMode] = useState<'round_robin' | 'all'>('round_robin');

  const activeOrgPositions = useMemo(
      () => orgPositions.filter((p) => !p.isArchived),
      [orgPositions]
  );

  const getEmployeeName = (uid: string) => users.find(u => u.id === uid)?.name || 'Неизвестный';
  const getEmployeeUser = (uid: string) => users.find(u => u.id === uid);

  // --- Handlers Cards ---
  const handleOpenCreate = useCallback(() => {
      setEditingInfo(null);
      setUserId(users[0]?.id || '');
      setOrgPositionId('');
      setPosition(''); setHireDate(''); setBirthDate('');
      setIsModalOpen(true);
  }, [users]);

  const handleOpenEdit = (info: EmployeeInfo) => {
      const byLink = info.orgPositionId ? orgPositions.find((p) => p.id === info.orgPositionId) : undefined;
      const legacy = orgPositions.find((p) => p.holderUserId === info.userId);
      const linkedPosition = byLink || legacy;
      setEditingInfo(info);
      setUserId(info.userId);
      setOrgPositionId(linkedPosition?.id || info.orgPositionId || '');
      setPosition(info.position || linkedPosition?.title || '');
      setHireDate(normalizeDateForInput(info.hireDate) || '');
      setBirthDate(normalizeDateForInput(info.birthDate) || '');
      setIsModalOpen(true);
  };

  const handleSubmit = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const selectedPos = activeOrgPositions.find((p) => p.id === orgPositionId);
      const oldPosId = editingInfo?.orgPositionId;
      onSave({
          id: editingInfo ? editingInfo.id : `emp-${Date.now()}`,
          userId,
          orgPositionId: orgPositionId || undefined,
          position: (selectedPos?.title || position || '').trim(),
          hireDate,
          birthDate: birthDate || undefined,
      });

      if (onSavePosition && userId) {
          const syncPrimary = (pid: string, includeCurrentUser: boolean) => {
              const pos = orgPositions.find((p) => p.id === pid);
              if (!pos) return;
              const others = employees
                  .filter((e) => e.id !== editingInfo?.id && !e.isArchived && e.orgPositionId === pid)
                  .map((e) => e.userId);
              if (includeCurrentUser && orgPositionId === pid) others.push(userId);
              const sorted = [...new Set(others.filter(Boolean))].sort();
              const primary = sorted[0];
              if (pos.holderUserId !== primary) {
                  onSavePosition({ ...pos, holderUserId: primary });
              }
          };

          if (oldPosId && oldPosId !== orgPositionId) {
              const pos = orgPositions.find((p) => p.id === oldPosId);
              if (pos) {
                  const remaining = employees
                      .filter((e) => e.id !== editingInfo?.id && !e.isArchived && e.orgPositionId === oldPosId)
                      .map((e) => e.userId)
                      .sort();
                  const primary = remaining[0];
                  if (pos.holderUserId !== primary) {
                      onSavePosition({ ...pos, holderUserId: primary });
                  }
              }
          }
          if (orgPositionId) {
              syncPrimary(orgPositionId, true);
          }
      }
      setIsModalOpen(false);
  };

  const handleDelete = () => {
      if(editingInfo && confirm('Удалить сотрудника?')) {
          onDelete(editingInfo.id);
          setIsModalOpen(false);
      }
  };

  // --- Handlers OrgChart ---
  const handleOpenPosCreate = useCallback(() => {
      setEditingPos(null);
      setPosTitle(''); setPosDep(''); setPosManager(''); setPosHolder(''); setPosOrder(0);
      setPosTaskMode('round_robin');
      setIsPosModalOpen(true);
  }, []);

  const handleOpenPosEdit = (pos: OrgPosition) => {
      setEditingPos(pos);
      setPosTitle(pos.title);
      setPosDep(pos.departmentId || '');
      setPosManager(pos.managerPositionId || '');
      setPosHolder(pos.holderUserId || '');
      setPosOrder(pos.order || 0);
      setPosTaskMode(pos.taskAssigneeMode === 'all' ? 'all' : 'round_robin');
      setIsPosModalOpen(true);
  };

  const handleSubmitPos = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!onSavePosition) return;
      const newId = editingPos ? editingPos.id : `op-${Date.now()}`;
      const payload: OrgPosition = {
          id: newId,
          title: posTitle,
          departmentId: posDep || undefined,
          managerPositionId: posManager || undefined,
          holderUserId: posHolder || undefined,
          order: posOrder,
          isArchived: editingPos?.isArchived ?? false,
          taskAssigneeMode: posTaskMode,
      };
      onSavePosition(payload);
      if (posHolder) {
          const holderInfo = employees.find((emp) => emp.userId === posHolder && !emp.isArchived);
          if (holderInfo) {
              onSave({ ...holderInfo, orgPositionId: newId, position: posTitle });
          }
      }
      setIsPosModalOpen(false);
  };

  const handleDeletePos = () => {
      if (editingPos && onDeletePosition && confirm('Удалить должность?')) {
          onDeletePosition(editingPos.id);
          setIsPosModalOpen(false);
      }
  };

  // Backdrops
  const handleCardBackdrop = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
          setIsModalOpen(false);
      }
  };

  const handlePosBackdrop = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
          if(window.confirm("Сохранить изменения?")) handleSubmitPos();
          else setIsPosModalOpen(false);
      }
  };

  // --- Render ---

  const renderCards = () => (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {employees.filter(info => !info.isArchived).map(info => {
               const user = getEmployeeUser(info.userId);
               const linkedPosition =
                   (info.orgPositionId !== undefined && orgPositions.find((p) => p.id === info.orgPositionId)) ||
                   orgPositions.find((p) => p.holderUserId === info.userId);
               return (
                   <div key={info.id} className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow group relative flex flex-col">
                       <button onClick={() => handleOpenEdit(info)} className="absolute top-4 right-4 text-gray-300 hover:text-slate-700 dark:hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity">
                           <Edit2 size={16}/>
                       </button>
                       
                       <div className="flex items-center gap-4 mb-4">
                            <img 
                                src={user?.avatar || getDefaultAvatarForId(user?.id)} 
                                className="w-12 h-12 rounded-full border border-gray-200 dark:border-gray-600 object-cover object-center" 
                                alt=""
                            />
                            <div className="overflow-hidden">
                                <h3 className="font-bold text-gray-900 dark:text-gray-200 truncate">{user?.name}</h3>
                                <div className="text-xs text-slate-700 dark:text-slate-200 font-medium bg-slate-100 dark:bg-slate-900/30 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 inline-block mt-1 truncate max-w-full">{linkedPosition?.title || info.position}</div>
                            </div>
                       </div>
                       
                       <div className="space-y-2 text-sm flex-1 mb-4">
                           <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-[#303030] rounded">
                               <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400"><Calendar size={14}/> Нанят:</div>
                               <div className="font-medium text-gray-700 dark:text-gray-300">{formatDate(info.hireDate)}</div>
                           </div>
                           {info.birthDate && (
                                <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-[#303030] rounded">
                                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400"><Cake size={14}/> ДР:</div>
                                    <div className="font-medium text-gray-700 dark:text-gray-300">{formatDate(info.birthDate)}</div>
                                </div>
                           )}
                       </div>

                       <div className="grid grid-cols-2 gap-2 mb-4">
                           {user?.phone && (
                               <a href={`tel:${user.phone}`} className="flex items-center justify-center gap-1 p-1.5 rounded bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors">
                                   <Phone size={12}/> {user.phone}
                               </a>
                           )}
                           {user?.telegram && (
                               <a href={user.telegram.startsWith('http') ? user.telegram : `https://t.me/${user.telegram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 p-1.5 rounded bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-200 text-xs hover:bg-slate-200/60 dark:hover:bg-slate-900/45 transition-colors">
                                   <Send size={12}/> Telegram
                               </a>
                           )}
                       </div>

                   </div>
               );
           })}
      </div>
  );

  const renderOrgChart = () => {
      // Create hierarchy
      const roots = activeOrgPositions
        .filter((p) => !p.managerPositionId || !activeOrgPositions.find((op) => op.id === p.managerPositionId))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      
      const renderNode = (node: OrgPosition, level: number = 0) => {
          // Получаем детей и сортируем по order (меньше = левее)
          const children = activeOrgPositions
              .filter(p => p.managerPositionId === node.id)
              .sort((a, b) => (a.order || 0) - (b.order || 0));
          
          const holdersFromCards = employees
              .filter((e) => !e.isArchived && e.orgPositionId === node.id)
              .map((e) => users.find((u) => u.id === e.userId))
              .filter(Boolean) as User[];
          const legacyHolder = node.holderUserId ? users.find((u) => u.id === node.holderUserId) : undefined;
          const displayHolders = holdersFromCards.length > 0 ? holdersFromCards : legacyHolder ? [legacyHolder] : [];
          const dept = departments.find(d => d.id === node.departmentId);
          
          // Проверяем, есть ли родитель
          const hasParent = node.managerPositionId && activeOrgPositions.find(op => op.id === node.managerPositionId);

          return (
              <div key={node.id} className="relative flex flex-col items-center">
                  {/* Линия вверх к родителю (если есть родитель) */}
                  {hasParent && (
                      <div
                        className="pointer-events-none absolute -top-4 left-1/2 z-[1] w-px -translate-x-1/2 bg-gray-300 dark:bg-gray-600"
                        style={{ height: 'calc(1rem + 1px)' }}
                        aria-hidden
                      />
                  )}

                  {/* Node card */}
                  <div className="relative z-10">
                      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg p-3 w-64 shadow-sm relative group">
                          <button onClick={() => handleOpenPosEdit(node)} className="absolute top-2 right-2 text-gray-300 hover:text-blue-600 opacity-0 group-hover:opacity-100"><Edit2 size={12}/></button>
                          
                          <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">{dept?.name || 'Без отдела'}</div>
                          <div className="font-bold text-gray-900 dark:text-gray-100 text-sm mb-2">{node.title}</div>
                          
                          {displayHolders.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 bg-gray-50 dark:bg-[#303030] p-1.5 rounded">
                                  {displayHolders.map((h) => (
                                      <div key={h.id} className="flex items-center gap-1.5 min-w-0">
                                          <img src={h.avatar || getDefaultAvatarForId(h.id)} className="w-6 h-6 rounded-full object-cover object-center shrink-0" alt="" />
                                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{h.name}</span>
                                      </div>
                                  ))}
                              </div>
                          ) : (
                              <div className="text-xs text-gray-400 italic bg-gray-50 dark:bg-[#303030] p-1.5 rounded">Вакансия</div>
                          )}
                      </div>
                  </div>

                  {/* Children container */}
                  {children.length > 0 && (
                      <div className="relative mt-4 overflow-visible">
                          {/* Вертикальная линия вниз от карточки родителя к горизонтальной линии (чуть длиннее — перекрытие стыка) */}
                          <div
                            className="pointer-events-none absolute -top-4 left-1/2 z-[1] w-px -translate-x-1/2 bg-gray-300 dark:bg-gray-600"
                            style={{ height: 'calc(1.25rem + 2px)' }}
                            aria-hidden
                          />

                          {/* Горизонталь: расстояние между центрами = w-64 (16rem) + gap-8 (2rem); +2px на стыки с вертикалями */}
                          {children.length > 1 && (
                              <div
                                className="pointer-events-none absolute left-1/2 top-0 z-[1] h-0.5 -translate-x-1/2 bg-gray-300 dark:bg-gray-600"
                                style={{
                                  width: `calc(${children.length - 1} * (16rem + 2rem) + 2px)`,
                                }}
                                aria-hidden
                              />
                          )}

                          {/* Children nodes */}
                          <div className="flex items-start justify-center gap-8 pt-6">
                              {children.map((child) => {
                                  const isMultiple = children.length > 1;
                                  return (
                                      <div key={child.id} className="relative z-10 w-64 shrink-0">
                                          {isMultiple && (
                                              <div
                                                className="pointer-events-none absolute -top-6 left-1/2 z-[1] w-px -translate-x-1/2 bg-gray-300 dark:bg-gray-600"
                                                style={{ height: 'calc(1.5rem + 2px)' }}
                                                aria-hidden
                                              />
                                          )}
                                          {!isMultiple && (
                                              <div
                                                className="pointer-events-none absolute -top-4 left-1/2 z-[1] w-px -translate-x-1/2 bg-gray-300 dark:bg-gray-600"
                                                style={{ height: 'calc(1rem + 1px)' }}
                                                aria-hidden
                                              />
                                          )}
                                          {renderNode(child, level + 1)}
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  )}
              </div>
          );
      };

      return (
          <div className="overflow-x-auto pb-8">
              {roots.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 dark:text-gray-500">Оргсхема пуста. Добавьте первую должность.</div>
              ) : (
                  <div className="min-w-max w-fit mx-auto px-6 sm:px-10">
                      <div className="flex items-start justify-start gap-6 min-h-[400px]">
                          {roots.map((root) => renderNode(root))}
                      </div>
                  </div>
              )}
          </div>
      );
  };

  const handleAssignUserToPosition = (targetPositionId: string, incomingUserId: string) => {
      const target = orgPositions.find((p) => p.id === targetPositionId);
      if (!target) return;
      const emp = employees.find((e) => e.userId === incomingUserId && !e.isArchived);
      if (emp) {
          onSave({ ...emp, orgPositionId: targetPositionId, position: target.title });
      } else {
          onSave({
              id: `emp-${Date.now()}`,
              userId: incomingUserId,
              orgPositionId: targetPositionId,
              position: target.title,
              hireDate: '',
          });
      }
      if (onSavePosition) {
          const members = new Set(
              employees.filter((e) => !e.isArchived && e.orgPositionId === targetPositionId).map((e) => e.userId)
          );
          members.add(incomingUserId);
          const primary = [...members].sort()[0];
          if (target.holderUserId !== primary) {
              onSavePosition({ ...target, holderUserId: primary });
          }
      }
  };

  const renderStructure = () => {
      const roots = activeOrgPositions
          .filter((p) => !p.managerPositionId || !activeOrgPositions.some((x) => x.id === p.managerPositionId))
          .sort((a, b) => (a.order || 0) - (b.order || 0));
      const childrenMap = new Map<string, OrgPosition[]>();
      activeOrgPositions.forEach((p) => {
          if (!p.managerPositionId) return;
          const arr = childrenMap.get(p.managerPositionId) || [];
          arr.push(p);
          childrenMap.set(p.managerPositionId, arr);
      });
      childrenMap.forEach((arr, key) => childrenMap.set(key, arr.sort((a, b) => (a.order || 0) - (b.order || 0))));

      const renderNode = (node: OrgPosition, depth = 0): React.ReactNode => {
          const children = childrenMap.get(node.id) || [];
          const hasChildren = children.length > 0;
          const isOpen = expandedNodes[node.id] ?? true;
          const holdersFromCards = employees
              .filter((e) => !e.isArchived && e.orgPositionId === node.id)
              .map((e) => users.find((u) => u.id === e.userId))
              .filter(Boolean) as User[];
          const legacyHolder = node.holderUserId ? users.find((u) => u.id === node.holderUserId) : undefined;
          const displayHolders = holdersFromCards.length > 0 ? holdersFromCards : legacyHolder ? [legacyHolder] : [];
          const dept = departments.find((d) => d.id === node.departmentId);

          return (
              <div key={node.id} className="select-none">
                  <div
                      className="group rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] hover:border-indigo-300 dark:hover:border-indigo-700"
                      style={{ marginLeft: depth * 16 }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                          e.preventDefault();
                          const uid = draggedUserId || e.dataTransfer.getData('text/plain');
                          if (!uid) return;
                          handleAssignUserToPosition(node.id, uid);
                          setDraggedUserId(null);
                      }}
                  >
                      <div className="flex items-center gap-2 px-3 py-2.5">
                          <button
                              type="button"
                              onClick={() => setExpandedNodes((prev) => ({ ...prev, [node.id]: !isOpen }))}
                              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-[#303030]"
                          >
                              {hasChildren ? <ChevronDown size={14} className={!isOpen ? '-rotate-90 transition-transform' : 'transition-transform'} /> : <ChevronRight size={14} className="opacity-30" />}
                          </button>
                          <FolderTree size={15} className="text-indigo-500" />
                          <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{node.title}</div>
                              <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{dept?.name || 'Без отдела'}</div>
                          </div>
                          <button type="button" onClick={() => handleOpenPosEdit(node)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600 transition-opacity">
                              <Edit2 size={14} />
                          </button>
                      </div>
                      <div className="px-3 pb-2.5">
                          {displayHolders.length > 0 ? (
                              <div className="space-y-1">
                                  {displayHolders.map((holder) => (
                                      <div
                                          key={holder.id}
                                          draggable
                                          onDragStart={(e) => {
                                              setDraggedUserId(holder.id);
                                              e.dataTransfer.setData('text/plain', holder.id);
                                              e.dataTransfer.effectAllowed = 'move';
                                          }}
                                          className="flex items-center gap-2 rounded-md border border-gray-200 dark:border-[#3a3a3a] bg-gray-50 dark:bg-[#2f2f2f] px-2 py-1.5 cursor-move"
                                      >
                                          <img src={holder.avatar || getDefaultAvatarForId(holder.id)} className="w-6 h-6 rounded-full object-cover object-center" alt="" />
                                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{holder.name}</span>
                                      </div>
                                  ))}
                              </div>
                          ) : (
                              <div className="text-xs text-gray-400 italic rounded-md border border-dashed border-gray-200 dark:border-[#3a3a3a] px-2 py-1.5">
                                  Перетащите сотрудника сюда
                              </div>
                          )}
                      </div>
                  </div>
                  {hasChildren && isOpen && (
                      <div className="mt-2 space-y-2">
                          {children.map((child) => renderNode(child, depth + 1))}
                      </div>
                  )}
              </div>
          );
      };

      const assignedIds = new Set<string>();
      employees.filter((info) => !info.isArchived && info.orgPositionId).forEach((info) => assignedIds.add(info.userId));
      activeOrgPositions.forEach((p) => {
          if (p.holderUserId) assignedIds.add(p.holderUserId);
      });
      // "Свободные" = пользователи, которые не закреплены ни за одной должностью,
      // включая тех, у кого ещё нет карточки сотрудника (EmployeeInfo).
      const freeEmployees = users
          .filter((u) => !u.isArchived)
          .filter((u) => !assignedIds.has(u.id));

      return (
          <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50/60 dark:bg-[#202020] p-3">
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Свободные сотрудники</h4>
                  {freeEmployees.length === 0 ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400">Все сотрудники уже назначены на должности.</p>
                  ) : (
                      <div className="flex flex-wrap gap-2">
                          {freeEmployees.map((u) => (
                              <div
                                  key={u.id}
                                  draggable
                                  onDragStart={(e) => {
                                      setDraggedUserId(u.id);
                                      e.dataTransfer.setData('text/plain', u.id);
                                      e.dataTransfer.effectAllowed = 'move';
                                  }}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-[#3a3a3a] bg-white dark:bg-[#252525] text-xs text-gray-700 dark:text-gray-300 cursor-move"
                              >
                                  <img src={u.avatar || getDefaultAvatarForId(u.id)} className="w-5 h-5 rounded-full object-cover object-center" />
                                  <span>{u.name}</span>
                              </div>
                          ))}
                      </div>
                  )}
              </div>

              {roots.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 dark:text-gray-500">Структура пуста. Добавьте должности в оргсхеме.</div>
              ) : (
                  <div className="space-y-2">
                      {roots.map((root) => renderNode(root))}
                  </div>
              )}
          </div>
      );
  };

  useLayoutEffect(() => {
    const orange = 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
    const idle = 'text-gray-600 dark:text-gray-400';
    const tabs: { id: 'cards' | 'orgchart' | 'structure'; label: string }[] = [
      { id: 'cards', label: 'Карточки' },
      { id: 'orgchart', label: 'Оргсхема' },
      { id: 'structure', label: 'Структура' },
    ];
    setLeading(
      <div className="flex items-center gap-0.5 shrink-0 flex-wrap sm:flex-nowrap" role="tablist" aria-label="Сотрудники">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === t.id ? orange : `${idle} hover:bg-gray-100 dark:hover:bg-[#252525]`
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
    setModule(
      <ModuleCreateDropdown
        accent="orange"
        align="left"
        buttonSize="sm"
        items={[
          {
            id: 'employee',
            label: 'Сотрудник',
            icon: UserPlus,
            onClick: handleOpenCreate,
          },
          {
            id: 'position',
            label: 'Должность в оргсхеме',
            icon: Building2,
            onClick: handleOpenPosCreate,
          },
        ]}
      />
    );
    return () => {
      setLeading(null);
      setModule(null);
    };
  }, [activeTab, setLeading, setModule, handleOpenCreate, handleOpenPosCreate]);

  return (
    <ModulePageShell>
       <div className="flex-1 min-h-0 overflow-hidden">
         <div className={`${MODULE_PAGE_GUTTER} ${MODULE_PAGE_TOP_PAD} pb-20 h-full overflow-y-auto custom-scrollbar`}>
       {activeTab === 'cards' && renderCards()}
       {activeTab === 'orgchart' && renderOrgChart()}
       {activeTab === 'structure' && renderStructure()}
         </div>
       </div>

       {/* Employee Modal */}
       {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80] animate-in fade-in duration-200" onClick={handleCardBackdrop}>
            <div className="bg-white dark:bg-[#252525] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-[#333]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center gap-2 bg-white dark:bg-[#252525]">
                    <h3 className="font-bold text-gray-800 dark:text-white truncate">{editingInfo ? 'Сотрудник' : 'Новый сотрудник'}</h3>
                    <div className="flex items-center gap-1 shrink-0">
                        {editingInfo && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDelete();
                                }}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                            >
                                <Trash2 size={16} />
                                <span className="hidden sm:inline">Удалить</span>
                            </button>
                        )}
                        <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-[#333]"><X size={18} /></button>
                    </div>
                </div>
                
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Сотрудник (из пользователей)</label>
                        <TaskSelect
                            value={userId}
                            onChange={setUserId}
                            options={[
                                { value: '', label: 'Не назначен' },
                                ...users.map(u => ({ value: u.id, label: u.name }))
                            ]}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Пост в оргструктуре</label>
                        <TaskSelect
                            value={orgPositionId}
                            onChange={(value) => {
                                setOrgPositionId(value);
                                const linked = activeOrgPositions.find((p) => p.id === value);
                                if (linked?.title) setPosition(linked.title);
                            }}
                            options={[
                                { value: '', label: 'Не выбран' },
                                ...activeOrgPositions.map((p) => ({ value: p.id, label: p.title }))
                            ]}
                        />
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                          На одну должность можно завести несколько карточек сотрудников. Задачи по должности: по очереди или всем — настраивается в карточке должности.
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Должность</label>
                        <input required value={position} onChange={e => setPosition(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500" placeholder="Маркетолог"/>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <DateInput
                            label="Дата найма"
                            value={normalizeDateForInput(hireDate) || ''}
                            onChange={setHireDate}
                        />
                        <DateInput
                            label="Дата рождения"
                            value={normalizeDateForInput(birthDate) || ''}
                            onChange={setBirthDate}
                        />
                    </div>

                    <div className="flex justify-end items-center gap-2 pt-2 border-t border-gray-100 dark:border-[#333] mt-2">
                         <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#303030] rounded-lg">Отмена</button>
                         <button type="submit" className="px-4 py-2 text-sm font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white rounded-lg shadow-sm flex items-center gap-2"><Save size={16}/> Сохранить</button>
                    </div>
                </form>
            </div>
        </div>
       )}

       {/* Org Position Modal */}
       {isPosModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80] animate-in fade-in duration-200" onClick={handlePosBackdrop}>
            <div className="bg-white dark:bg-[#252525] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-200 dark:border-[#333]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center bg-white dark:bg-[#252525]">
                    <h3 className="font-bold text-gray-800 dark:text-white">{editingPos ? 'Редактировать должность' : 'Новая должность'}</h3>
                    <button onClick={() => setIsPosModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#333]"><X size={18} /></button>
                </div>
                
                <form onSubmit={handleSubmitPos} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Название должности</label>
                        <input required value={posTitle} onChange={e => setPosTitle(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100" placeholder="Например: Коммерческий директор"/>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Подразделение</label>
                        <TaskSelect
                            value={posDep}
                            onChange={setPosDep}
                            options={[
                                { value: '', label: 'Без отдела' },
                                ...departments.map(d => ({ value: d.id, label: d.name }))
                            ]}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Прямой руководитель</label>
                        <TaskSelect
                            value={posManager}
                            onChange={setPosManager}
                            options={[
                                { value: '', label: 'Нет (Верхний уровень)' },
                                ...activeOrgPositions.filter(p => p.id !== editingPos?.id).map(p => ({ value: p.id, label: p.title }))
                            ]}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Задачи BPM на эту должность</label>
                        <TaskSelect
                            value={posTaskMode}
                            onChange={(v) => setPosTaskMode(v as 'round_robin' | 'all')}
                            options={[
                                { value: 'round_robin', label: 'По очереди (один исполнитель на задачу)' },
                                { value: 'all', label: 'Все сотрудники на должности (одна задача, несколько ответственных)' },
                            ]}
                        />
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                          «По очереди» — исполнитель ротируется между людьми на посту. «Все» — в задаче указываются все ответственные.
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Основной сотрудник (для отображения)</label>
                        <TaskSelect
                            value={posHolder}
                            onChange={setPosHolder}
                            options={[
                                { value: '', label: 'Вакансия' },
                                ...users.map(u => ({ value: u.id, label: u.name }))
                            ]}
                        />
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                          Дополнительно привяжите людей через карточки сотрудников — тот же пост у нескольких карточек.
                        </p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Порядок (для позиционирования слева/справа)</label>
                        <input 
                            type="number" 
                            value={posOrder} 
                            onChange={e => setPosOrder(parseInt(e.target.value) || 0)} 
                            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100" 
                            placeholder="0"
                        />
                        <p className="text-xs text-gray-400 mt-1">Меньшее значение = левее</p>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                         {editingPos && (
                             <button type="button" onClick={handleDeletePos} className="text-red-500 text-sm hover:underline hover:text-red-600 flex items-center gap-1"><Trash2 size={14}/> Удалить</button>
                         )}
                         <div className="flex gap-2 ml-auto">
                            <button type="button" onClick={() => setIsPosModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#303030] rounded-lg">Отмена</button>
                            <button type="submit" className="px-4 py-2 text-sm font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white rounded-lg shadow-sm flex items-center gap-2"><Save size={16}/> Сохранить</button>
                         </div>
                    </div>
                </form>
            </div>
        </div>
       )}
    </ModulePageShell>
  );
};

export default EmployeesView;
