
import React, { useState } from 'react';
import { FinanceCategory } from '../../types';
import { Plus, X, Edit2, Trash2 } from 'lucide-react';
import { TaskSelect } from '../TaskSelect';

interface FinanceCategoriesSettingsProps {
    categories: FinanceCategory[];
    onSave: (cat: FinanceCategory) => void;
    onDelete: (id: string) => void;
}

const FinanceCategoriesSettings: React.FC<FinanceCategoriesSettingsProps> = ({ categories, onSave, onDelete }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<FinanceCategory | null>(null);
    const [catName, setCatName] = useState('');
    const [catType, setCatType] = useState<'fixed' | 'percent'>('fixed');

    const handleOpenCreate = () => {
        setEditingCategory(null);
        setCatName('');
        setCatType('fixed');
        setIsModalOpen(true);
    };

    const handleOpenEdit = (cat: FinanceCategory) => {
        setEditingCategory(cat);
        setCatName(cat.name);
        setCatType(cat.type);
        setIsModalOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!catName.trim()) return;

        const category: FinanceCategory = {
            id: editingCategory?.id || `fc-${Date.now()}`,
            name: catName.trim(),
            type: catType
        };

        onSave(category);
        setIsModalOpen(false);
        setEditingCategory(null);
        setCatName('');
        setCatType('fixed');
    };

    const handleBackdrop = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            setIsModalOpen(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Статьи расходов</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Управление статьями расходов для финансового планирования
                    </p>
                </div>
                <button 
                    onClick={handleOpenCreate} 
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 shadow-sm"
                >
                    <Plus size={18} /> Добавить статью
                </button>
            </div>

            <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-[#202020] border-b border-gray-200 dark:border-[#333]">
                        <tr>
                            <th className="px-4 py-3 text-gray-600 dark:text-gray-400 font-semibold">Название</th>
                            <th className="px-4 py-3 text-gray-600 dark:text-gray-400 font-semibold">Тип</th>
                            <th className="px-4 py-3 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
                        {categories.filter(cat => !cat.isArchived).length > 0 ? (
                            categories.filter(cat => !cat.isArchived).map(cat => (
                                <tr key={cat.id} className="hover:bg-gray-50 dark:hover:bg-[#303030]">
                                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{cat.name}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${cat.type === 'fixed' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                            {cat.type === 'fixed' ? 'Фикс' : 'Процент'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right flex gap-2 justify-end">
                                        <button onClick={() => handleOpenEdit(cat)} className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"><Edit2 size={14}/></button>
                                        <button onClick={() => { if(confirm('Удалить статью?')) onDelete(cat.id) }} className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"><Trash2 size={14}/></button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                                    Нет статей расходов. Добавьте первую статью.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Category Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80] animate-in fade-in duration-200" onClick={handleBackdrop}>
                    <div className="bg-white dark:bg-[#252525] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-200 dark:border-[#333]" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center bg-white dark:bg-[#252525]">
                            <h3 className="font-bold text-gray-800 dark:text-white">{editingCategory ? 'Редактировать статью' : 'Новая статья расходов'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#333]"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Название</label>
                                <input 
                                    required 
                                    value={catName} 
                                    onChange={e => setCatName(e.target.value)} 
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none" 
                                    placeholder="Например: Офис"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Тип распределения</label>
                                <TaskSelect
                                    value={catType}
                                    onChange={(val) => setCatType(val as 'fixed' | 'percent')}
                                    options={[
                                        { value: 'fixed', label: 'Фиксированная сумма' },
                                        { value: 'percent', label: 'Процент от дохода' }
                                    ]}
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => setIsModalOpen(false)} 
                                    className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#303030] rounded-lg"
                                >
                                    Отмена
                                </button>
                                <button 
                                    type="submit" 
                                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm"
                                >
                                    Сохранить
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinanceCategoriesSettings;

