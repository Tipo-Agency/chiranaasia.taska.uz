
import React, { useState } from 'react';
import { Department, User } from '../types';
import { Plus, X, Edit2, Trash2, Building, User as UserIcon, GitFork } from 'lucide-react';
import { TaskSelect } from './TaskSelect';

interface DepartmentsViewProps {
  departments: Department[];
  users: User[];
  onSave: (dep: Department) => void;
  onDelete: (id: string) => void;
}

const DepartmentsView: React.FC<DepartmentsViewProps> = ({ departments, users, onSave, onDelete }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDep, setEditingDep] = useState<Department | null>(null);
  
  const [name, setName] = useState('');
  const [headId, setHeadId] = useState('');
  const [description, setDescription] = useState('');

  const handleOpenCreate = () => {
      setEditingDep(null);
      setName(''); setHeadId(''); setDescription('');
      setIsModalOpen(true);
  };

  const handleOpenEdit = (dep: Department) => {
      setEditingDep(dep);
      setName(dep.name); setHeadId(dep.headId || ''); setDescription(dep.description || '');
      setIsModalOpen(true);
  };

  const handleSubmit = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      onSave({
          id: editingDep ? editingDep.id : `dep-${Date.now()}`,
          name,
          headId: headId || undefined,
          description
      });
      setIsModalOpen(false);
  };

  const handleDelete = () => {
      if(editingDep && confirm('Удалить подразделение?')) {
          onDelete(editingDep.id);
          setIsModalOpen(false);
      }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
          if(window.confirm("Сохранить изменения?")) handleSubmit();
          else setIsModalOpen(false);
      }
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="max-w-5xl mx-auto w-full pt-8 px-6 flex-shrink-0">
       <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded-lg text-orange-600 dark:text-orange-400">
                        <GitFork size={24} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Подразделения</h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Управление структурой подразделений компании
                        </p>
                    </div>
                </div>
                <button onClick={handleOpenCreate} className="px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 flex items-center gap-2 shadow-sm">
                    <Plus size={18} /> Создать
                </button>
            </div>
       </div>
       </div>
       <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
         <div className="max-w-5xl mx-auto w-full px-6 pb-20">
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {departments.filter(dep => !dep.isArchived).map(dep => {
               const head = users.find(u => u.id === dep.headId);
               return (
                   <div key={dep.id} className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-6 shadow-sm hover:shadow-md transition-all group relative">
                       <button onClick={() => handleOpenEdit(dep)} className="absolute top-4 right-4 text-gray-300 hover:text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity">
                           <Edit2 size={16}/>
                       </button>
                       
                       <div className="flex items-center gap-3 mb-4">
                           <div className="w-10 h-10 rounded bg-gray-100 dark:bg-[#303030] flex items-center justify-center text-gray-500 dark:text-gray-400">
                               <Building size={20}/>
                           </div>
                           <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{dep.name}</h3>
                       </div>

                       <div className="space-y-4">
                           <div className="flex items-center gap-3 bg-gray-50 dark:bg-[#303030] p-2 rounded-lg">
                               {head ? (
                                   <>
                                       <img src={head.avatar} className="w-8 h-8 rounded-full border border-gray-200 object-cover object-center" alt=""/>
                                       <div>
                                           <div className="text-xs text-gray-500 dark:text-gray-400">Руководитель</div>
                                           <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{head.name}</div>
                                       </div>
                                   </>
                               ) : (
                                   <div className="text-sm text-gray-400 italic px-1">Руководитель не назначен</div>
                               )}
                           </div>
                           {dep.description && (
                               <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3">{dep.description}</p>
                           )}
                       </div>
                   </div>
               );
           })}
       </div>
         </div>
       </div>

       {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80] animate-in fade-in duration-200" onClick={handleBackdropClick}>
            <div className="bg-white dark:bg-[#252525] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-[#333]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center bg-white dark:bg-[#252525]">
                    <h3 className="font-bold text-gray-800 dark:text-white">{editingDep ? 'Редактировать' : 'Новое подразделение'}</h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#303030]"><X size={18} /></button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Название</label>
                        <input required value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500" placeholder="Например: Маркетинг"/>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Руководитель</label>
                        <TaskSelect
                            value={headId}
                            onChange={setHeadId}
                            options={[
                                { value: '', label: 'Не назначен' },
                                ...users.map(u => ({ value: u.id, label: u.name }))
                            ]}
                        />
                    </div>

                    <div>
                         <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Описание</label>
                         <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full h-24 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 resize-none"/>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                         {editingDep && (
                             <button type="button" onClick={handleDelete} className="text-red-500 text-sm hover:underline hover:text-red-600 flex items-center gap-1"><Trash2 size={14}/> Удалить</button>
                         )}
                         <div className="flex gap-2 ml-auto">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#303030] rounded-lg">Отмена</button>
                            <button type="submit" className="px-4 py-2 text-sm font-medium bg-orange-600 text-white hover:bg-orange-700 rounded-lg shadow-sm">Сохранить</button>
                         </div>
                    </div>
                </form>
            </div>
        </div>
       )}
    </div>
  );
};

export default DepartmentsView;
