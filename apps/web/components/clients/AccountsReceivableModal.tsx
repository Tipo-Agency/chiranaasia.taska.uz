import React, { useState, useEffect, useMemo } from 'react';
import { AccountsReceivable, Client, Deal } from '../../types';
import { X, Plus, Trash2, FileText, Receipt } from 'lucide-react';
import { TaskSelect } from '../TaskSelect';
import { normalizeDateForInput } from '../../utils/dateUtils';

interface ReceivableItem {
  id: string;
  dealId: string; // ID сделки (договора или продажи)
  amount: string; // Сумма задолженности
}

interface AccountsReceivableModalProps {
  isOpen: boolean;
  editingReceivable: AccountsReceivable | null;
  clientId?: string;
  clients: Client[];
  deals: Deal[]; // Объединенные договоры и продажи
  onClose: () => void;
  onSave: (receivables: AccountsReceivable[]) => void; // Может создать несколько записей
  onDelete?: (id: string) => void;
}

export const AccountsReceivableModal: React.FC<AccountsReceivableModalProps> = ({
  isOpen,
  editingReceivable,
  clientId,
  clients,
  deals,
  onClose,
  onSave,
  onDelete,
}) => {
  const [receivableClientId, setReceivableClientId] = useState<string>('');
  const [receivableDueDate, setReceivableDueDate] = useState('');
  const [receivableStatus, setReceivableStatus] = useState<'current' | 'overdue' | 'paid'>('current');
  const [receivableDescription, setReceivableDescription] = useState('');
  const [receivablePaidAmount, setReceivablePaidAmount] = useState('');
  const [receivablePaidDate, setReceivablePaidDate] = useState('');
  
  // Таблица для выбора продаж и договоров
  const [receivableItems, setReceivableItems] = useState<ReceivableItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (editingReceivable) {
        // Режим редактирования - показываем одну запись
        setReceivableClientId(editingReceivable.clientId);
        setReceivableDueDate(normalizeDateForInput(editingReceivable.dueDate) || '');
        setReceivableStatus(editingReceivable.status);
        setReceivableDescription(editingReceivable.description);
        setReceivablePaidAmount(editingReceivable.paidAmount?.toString() || '');
        setReceivablePaidDate(normalizeDateForInput(editingReceivable.paidDate) || '');
        // Для редактирования создаем одну строку
        setReceivableItems([{
          id: '1',
          dealId: editingReceivable.dealId,
          amount: editingReceivable.amount.toString(),
        }]);
      } else {
        setReceivableClientId(clientId || '');
        setReceivableDueDate('');
        setReceivableStatus('current');
        setReceivableDescription('');
        setReceivablePaidAmount('');
        setReceivablePaidDate('');
        setReceivableItems([]);
      }
    }
  }, [isOpen, editingReceivable, clientId]);

  const addReceivableItem = () => {
    setReceivableItems([...receivableItems, {
      id: `item-${Date.now()}`,
      dealId: '',
      amount: '',
    }]);
  };

  const removeReceivableItem = (id: string) => {
    setReceivableItems(receivableItems.filter(item => item.id !== id));
  };

  const updateReceivableItem = (id: string, updates: Partial<ReceivableItem>) => {
    setReceivableItems(receivableItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, ...updates };
        // Если выбрана новая сделка, устанавливаем сумму по умолчанию
        if (updates.dealId && updates.dealId !== item.dealId) {
          const deal = availableDeals.find(d => d.id === updates.dealId);
          if (deal && !item.amount) {
            updated.amount = deal.amount.toString();
          }
        }
        return updated;
      }
      return item;
    }));
  };

  const availableDeals = useMemo(() => {
    if (!receivableClientId) return [];
    return deals.filter(d => !d.isArchived && d.clientId === receivableClientId);
  }, [deals, receivableClientId]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!receivableClientId || receivableItems.length === 0) {
      alert('Выберите клиента и добавьте хотя бы одну продажу или договор');
      return;
    }

    const now = new Date().toISOString();
    const receivables: AccountsReceivable[] = receivableItems.map(item => {
      if (!item.dealId || !item.amount) {
        return null;
      }
      const deal = deals.find(d => d.id === item.dealId);
      return {
        id: editingReceivable && receivableItems.length === 1 ? editingReceivable.id : `ar-${Date.now()}-${Math.random()}`,
        clientId: receivableClientId,
        dealId: item.dealId,
        amount: parseFloat(item.amount) || 0,
        currency: 'UZS',
        dueDate: receivableDueDate,
        status: receivableStatus,
        description: receivableDescription || (deal?.recurring === false 
          ? `Задолженность по продаже`
          : `Задолженность по договору`),
        paidAmount: receivablePaidAmount ? parseFloat(receivablePaidAmount) : undefined,
        paidDate: receivablePaidDate || undefined,
        createdAt: editingReceivable ? editingReceivable.createdAt : now,
        updatedAt: now
      };
    }).filter((r): r is AccountsReceivable => r !== null);

    if (receivables.length === 0) {
      alert('Заполните все строки таблицы');
      return;
    }

    onSave(receivables);
    onClose();
  };

  if (!isOpen) return null;
  
  const totalAmount = receivableItems.reduce((sum, item) => {
    const amount = parseFloat(item.amount) || 0;
    return sum + amount;
  }, 0);

  return (
    <div 
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center z-[80] animate-in fade-in duration-200" 
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        className="bg-white dark:bg-[#252525] rounded-t-2xl md:rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden border border-gray-200 dark:border-[#333] flex flex-col max-h-[95vh] md:max-h-[90vh]" 
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-100 dark:border-[#333] bg-white dark:bg-[#252525] shrink-0 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">
            {editingReceivable ? 'Редактировать задолженность' : 'Новая задолженность'}
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
              value={receivableClientId}
              onChange={setReceivableClientId}
              options={clients.map(c => ({ value: c.id, label: c.name }))}
            />
          </div>

          {/* Таблица для выбора продаж и договоров */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400">Продажи и договоры *</label>
              <button
                type="button"
                onClick={addReceivableItem}
                className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg flex items-center gap-1"
              >
                <Plus size={14} />
                Добавить
              </button>
            </div>
            
            {receivableItems.length > 0 ? (
              <div className="space-y-3">
                {receivableItems.map((item, index) => {
                  const deal = availableDeals.find(d => d.id === item.dealId);
                  return (
                    <div key={item.id} className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-[#333] last:border-0">
                      <div className="flex-1">
                        <TaskSelect
                          value={item.dealId}
                          onChange={(val) => updateReceivableItem(item.id, { dealId: val })}
                          options={[
                            { value: '', label: 'Выберите сделку...' },
                            ...availableDeals.map(d => ({ 
                              value: d.id, 
                              label: `${d.recurring === false ? '💰 Продажа' : '📄 Договор'}: ${d.number} - ${d.amount.toLocaleString()} UZS` 
                            }))
                          ]}
                        />
                      </div>
                      <div className="w-32">
                        <input
                          type="number"
                          value={item.amount}
                          onChange={(e) => updateReceivableItem(item.id, { amount: e.target.value })}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                          placeholder="0"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeReceivableItem(item.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
                <div className="flex justify-end items-center gap-3 pt-2">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Итого:</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {totalAmount.toLocaleString()} UZS
                  </span>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg p-8 text-center">
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-2">Нет добавленных записей</p>
                <button
                  type="button"
                  onClick={addReceivableItem}
                  className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                >
                  Добавить продажу или договор
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Описание</label>
            <textarea 
              value={receivableDescription} 
              onChange={e => setReceivableDescription(e.target.value)} 
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100" 
              rows={3}
              placeholder="Описание задолженности..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Срок погашения *</label>
              <input 
                type="date" 
                value={normalizeDateForInput(receivableDueDate) || receivableDueDate} 
                onChange={e => setReceivableDueDate(e.target.value)} 
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100" 
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Статус</label>
              <TaskSelect
                value={receivableStatus}
                onChange={(val) => setReceivableStatus(val as any)}
                options={[
                  { value: 'current', label: 'Текущая' },
                  { value: 'overdue', label: 'Просрочена' },
                  { value: 'paid', label: 'Оплачена' }
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Оплаченная сумма (UZS)</label>
              <input 
                type="number" 
                value={receivablePaidAmount} 
                onChange={e => setReceivablePaidAmount(e.target.value)} 
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Дата оплаты</label>
              <input 
                type="date" 
                value={normalizeDateForInput(receivablePaidDate) || receivablePaidDate} 
                onChange={e => setReceivablePaidDate(e.target.value)} 
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            {editingReceivable && onDelete && (
              <button 
                type="button" 
                onClick={() => { 
                  if (confirm('Удалить задолженность?')) {
                    onDelete(editingReceivable.id);
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

