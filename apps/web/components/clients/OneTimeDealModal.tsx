import React, { useState, useEffect } from 'react';
import { Deal, Client } from '../../types';
import { X } from 'lucide-react';
import { TaskSelect } from '../TaskSelect';
import { normalizeDateForInput } from '../../utils/dateUtils';

interface OneTimeDealModalProps {
  isOpen: boolean;
  editingDeal: Deal | null;
  clientId?: string;
  clients: Client[];
  onClose: () => void;
  onSave: (deal: Deal) => void;
  onDelete?: (id: string) => void;
}

export const OneTimeDealModal: React.FC<OneTimeDealModalProps> = ({
  isOpen,
  editingDeal,
  clientId,
  clients,
  onClose,
  onSave,
  onDelete,
}) => {
  const [oneTimeDealClientId, setOneTimeDealClientId] = useState<string>('');
  const [oneTimeDealNumber, setOneTimeDealNumber] = useState('');
  const [oneTimeDealDate, setOneTimeDealDate] = useState(new Date().toISOString().split('T')[0]);
  const [oneTimeDealAmount, setOneTimeDealAmount] = useState('');
  const [oneTimeDealDescription, setOneTimeDealDescription] = useState('');
  const [oneTimeDealStatus, setOneTimeDealStatus] = useState<'pending' | 'paid' | 'overdue'>('pending');
  const [oneTimeDealDueDate, setOneTimeDealDueDate] = useState('');
  const [oneTimeDealPaidAmount, setOneTimeDealPaidAmount] = useState('');
  const [oneTimeDealPaidDate, setOneTimeDealPaidDate] = useState('');
  const [oneTimeDealNotes, setOneTimeDealNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editingDeal) {
        setOneTimeDealClientId(editingDeal.clientId);
        setOneTimeDealNumber(editingDeal.number || '');
        setOneTimeDealDate(normalizeDateForInput(editingDeal.date) || new Date().toISOString().split('T')[0]);
        setOneTimeDealAmount(editingDeal.amount.toString());
        setOneTimeDealDescription(editingDeal.description);
        setOneTimeDealStatus(editingDeal.status);
        setOneTimeDealDueDate(normalizeDateForInput(editingDeal.dueDate) || '');
        setOneTimeDealPaidAmount(editingDeal.paidAmount?.toString() || '');
        setOneTimeDealPaidDate(normalizeDateForInput(editingDeal.paidDate) || '');
        setOneTimeDealNotes(editingDeal.notes || '');
      } else {
        setOneTimeDealClientId(clientId || '');
        setOneTimeDealNumber('');
        setOneTimeDealDate(new Date().toISOString().split('T')[0]);
        setOneTimeDealAmount('');
        setOneTimeDealDescription('');
        setOneTimeDealStatus('pending');
        setOneTimeDealDueDate('');
        setOneTimeDealPaidAmount('');
        setOneTimeDealPaidDate('');
        setOneTimeDealNotes('');
      }
    }
  }, [isOpen, editingDeal, clientId]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Проверяем обязательные поля
    if (!oneTimeDealClientId) {
      alert('Выберите клиента');
      return;
    }
    if (!oneTimeDealDescription.trim()) {
      alert('Заполните описание');
      return;
    }
    if (!oneTimeDealAmount || parseFloat(oneTimeDealAmount) <= 0) {
      alert('Укажите сумму');
      return;
    }
    
    // Автоматически берем воронку от клиента
    const client = clients.find(c => c.id === oneTimeDealClientId);
    const now = new Date().toISOString();
    const deal: Deal = {
      id: editingDeal ? editingDeal.id : `deal-${Date.now()}`,
      clientId: oneTimeDealClientId,
      recurring: false, // Продажа = разово
      number: oneTimeDealNumber || `Продажа ${new Date().toLocaleDateString()}`,
      amount: parseFloat(oneTimeDealAmount) || 0,
      currency: 'UZS',
      status: oneTimeDealStatus,
      description: oneTimeDealDescription,
      date: oneTimeDealDate,
      dueDate: oneTimeDealDueDate || undefined,
      paidAmount: oneTimeDealPaidAmount ? parseFloat(oneTimeDealPaidAmount) : undefined,
      paidDate: oneTimeDealPaidDate || undefined,
      notes: oneTimeDealNotes || undefined,
      funnelId: client?.funnelId || undefined,
      createdAt: editingDeal?.createdAt || now,
      updatedAt: now
    };
    
    onSave(deal);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center z-[80] animate-in fade-in duration-200" 
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        className="bg-white dark:bg-[#252525] rounded-t-2xl md:rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-[#333] flex flex-col max-h-[95vh] md:max-h-[90vh]" 
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-100 dark:border-[#333] bg-white dark:bg-[#252525] shrink-0 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">
            {editingDeal ? 'Редактировать продажу' : 'Новая продажа'}
          </h2>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-gray-100 dark:hover:bg-[#333] rounded-lg"
          >
            <X size={20}/>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Клиент *</label>
            <TaskSelect
              value={oneTimeDealClientId}
              onChange={setOneTimeDealClientId}
              options={clients.map(c => ({ value: c.id, label: c.name }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Номер сделки</label>
              <input 
                type="text" 
                value={oneTimeDealNumber} 
                onChange={e => setOneTimeDealNumber(e.target.value)} 
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100" 
                placeholder="Опционально"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Дата сделки *</label>
              <input 
                type="date" 
                value={normalizeDateForInput(oneTimeDealDate) || oneTimeDealDate} 
                onChange={e => setOneTimeDealDate(e.target.value)} 
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100" 
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Описание услуги/товара *</label>
            <textarea 
              value={oneTimeDealDescription} 
              onChange={e => setOneTimeDealDescription(e.target.value)} 
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100" 
              rows={3} 
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Сумма (UZS) *</label>
              <input 
                type="number" 
                value={oneTimeDealAmount} 
                onChange={e => setOneTimeDealAmount(e.target.value)} 
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]" 
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Статус</label>
              <TaskSelect
                value={oneTimeDealStatus}
                onChange={(val) => setOneTimeDealStatus(val as any)}
                options={[
                  { value: 'pending', label: 'Ожидает оплаты' },
                  { value: 'paid', label: 'Оплачено' },
                  { value: 'overdue', label: 'Просрочено' }
                ]}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Срок оплаты</label>
              <input 
                type="date" 
                value={normalizeDateForInput(oneTimeDealDueDate) || oneTimeDealDueDate} 
                onChange={e => setOneTimeDealDueDate(e.target.value)} 
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Оплаченная сумма (UZS)</label>
              <input 
                type="number" 
                value={oneTimeDealPaidAmount} 
                onChange={e => setOneTimeDealPaidAmount(e.target.value)} 
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Дата оплаты</label>
            <input 
              type="date" 
              value={normalizeDateForInput(oneTimeDealPaidDate) || oneTimeDealPaidDate} 
              onChange={e => setOneTimeDealPaidDate(e.target.value)} 
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Примечания</label>
            <textarea 
              value={oneTimeDealNotes} 
              onChange={e => setOneTimeDealNotes(e.target.value)} 
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100" 
              rows={2}
            />
          </div>
          <div className="flex justify-between items-center pt-2">
            {editingDeal && onDelete && (
              <button 
                type="button" 
                onClick={() => { 
                  if (confirm('Удалить сделку?')) {
                    onDelete(editingDeal.id);
                    onClose();
                  }
                }} 
                className="text-red-500 text-sm hover:underline"
              >
                Удалить
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button 
                type="button" 
                onClick={onClose} 
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
          </div>
        </form>
      </div>
    </div>
  );
};

