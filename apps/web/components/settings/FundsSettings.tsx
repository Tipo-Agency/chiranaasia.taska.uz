
import React, { useState } from 'react';
import { Fund } from '../../types';
import { Plus, X, Edit2, Trash2 } from 'lucide-react';

interface FundsSettingsProps {
  funds: Fund[];
  onSave: (fund: Fund) => void;
  onDelete: (id: string) => void;
}

const FundsSettings: React.FC<FundsSettingsProps> = ({ funds, onSave, onDelete }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFund, setEditingFund] = useState<Fund | null>(null);
  const [fundName, setFundName] = useState('');
  const [fundOrder, setFundOrder] = useState(0);

  const handleOpenCreate = () => {
    setEditingFund(null);
    setFundName('');
    setFundOrder((funds.filter(f => !f.isArchived).length + 1) || 1);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (fund: Fund) => {
    setEditingFund(fund);
    setFundName(fund.name);
    setFundOrder(fund.order ?? 0);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fundName.trim()) return;

    const fund: Fund = {
      id: editingFund?.id || `fund-${Date.now()}`,
      name: fundName.trim(),
      order: fundOrder,
    };

    onSave(fund);
    setIsModalOpen(false);
    setEditingFund(null);
    setFundName('');
    setFundOrder(0);
  };

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsModalOpen(false);
    }
  };

  const activeFunds = funds.filter(f => !f.isArchived);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Фонды</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Распределение дохода по фондам для финансового планирования
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 shadow-sm"
        >
          <Plus size={18} /> Добавить фонд
        </button>
      </div>

      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-[#202020] border-b border-gray-200 dark:border-[#333]">
            <tr>
              <th className="px-4 py-3 text-gray-600 dark:text-gray-400 font-semibold">Порядок</th>
              <th className="px-4 py-3 text-gray-600 dark:text-gray-400 font-semibold">Название</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
            {activeFunds.length > 0 ? (
              activeFunds.map(fund => (
                <tr key={fund.id} className="hover:bg-gray-50 dark:hover:bg-[#303030]">
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{fund.order ?? 0}</td>
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{fund.name}</td>
                  <td className="px-4 py-3 text-right flex gap-2 justify-end">
                    <button onClick={() => handleOpenEdit(fund)} className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"><Edit2 size={14}/></button>
                    <button onClick={() => { if (confirm('Удалить фонд?')) onDelete(fund.id); }} className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"><Trash2 size={14}/></button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                  Нет фондов. Добавьте первый фонд или используйте моковые из сида.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80] animate-in fade-in duration-200" onClick={handleBackdrop}>
          <div className="bg-white dark:bg-[#252525] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-200 dark:border-[#333]" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center bg-white dark:bg-[#252525]">
              <h3 className="font-bold text-gray-800 dark:text-white">{editingFund ? 'Редактировать фонд' : 'Новый фонд'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#333]"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Название</label>
                <input
                  value={fundName}
                  onChange={e => setFundName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-[#333] rounded-lg bg-white dark:bg-[#252525] text-gray-800 dark:text-white text-sm"
                  placeholder="Например: Зарплаты"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Порядок</label>
                <input
                  type="number"
                  min={0}
                  value={fundOrder}
                  onChange={e => setFundOrder(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-[#333] rounded-lg bg-white dark:bg-[#252525] text-gray-800 dark:text-white text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Сохранить</button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-200 dark:border-[#333] rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#252525]">Отмена</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FundsSettings;
