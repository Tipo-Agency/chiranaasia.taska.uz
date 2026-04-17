import React, { useState, useEffect } from 'react';
import { Deal, Client } from '../../types';
import { X } from 'lucide-react';
import { EntitySearchSelect } from '../ui/EntitySearchSelect';
import { normalizeDateForInput } from '../../utils/dateUtils';
import { DateInput } from '../ui/DateInput';

interface ContractModalProps {
  isOpen: boolean;
  editingContract: Deal | null;
  targetClientId: string;
  clients: Client[];
  onClose: () => void;
  onSave: (deal: Deal) => void;
}

export const ContractModal: React.FC<ContractModalProps> = ({
  isOpen,
  editingContract,
  targetClientId,
  clients,
  onClose,
  onSave,
}) => {
  const [contractNumber, setContractNumber] = useState('');
  const [contractAmount, setContractAmount] = useState('');
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractPaymentDay, setContractPaymentDay] = useState('5');
  const [contractStatus, setContractStatus] = useState<'active' | 'pending' | 'completed'>('active');
  const [contractServices, setContractServices] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editingContract) {
        setContractNumber(editingContract.number);
        setContractAmount(editingContract.amount.toString());
        setContractStartDate(normalizeDateForInput(editingContract.startDate || editingContract.date) || '');
        setContractPaymentDay((editingContract.paymentDay || 5).toString());
        setContractStatus(editingContract.status as 'active' | 'pending' | 'completed');
        setContractServices(editingContract.description);
      } else {
        setContractNumber('');
        setContractAmount('');
        setContractStartDate(new Date().toISOString().split('T')[0]);
        setContractPaymentDay('5');
        setContractStatus('active');
        setContractServices('');
      }
    }
  }, [isOpen, editingContract]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const now = new Date().toISOString();
    onSave({
      id: editingContract ? editingContract.id : `deal-${Date.now()}`,
      clientId: targetClientId,
      recurring: true, // Договор всегда регулярный
      number: contractNumber,
      amount: parseFloat(contractAmount) || 0,
      currency: 'UZS',
      status: contractStatus,
      description: contractServices,
      startDate: contractStartDate,
      date: contractStartDate, // Для отображения
      paymentDay: parseInt(contractPaymentDay) || 1,
      funnelId: editingContract?.funnelId ?? undefined,
      createdAt: editingContract?.createdAt || now,
      updatedAt: now
    });
    onClose();
  };

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/35 backdrop-blur-sm flex items-end md:items-center justify-center z-[210] animate-in fade-in duration-200" 
      onClick={handleBackdrop}
    >
      <div 
        className="bg-white dark:bg-[#252525] rounded-t-2xl md:rounded-xl shadow-2xl w-full max-w-md max-h-[95vh] md:max-h-[90vh] overflow-hidden border border-gray-200 dark:border-[#333]" 
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center bg-white dark:bg-[#252525]">
          <h3 className="font-bold text-gray-800 dark:text-white">
            {editingContract ? 'Редактировать договор' : 'Новый договор'}
          </h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#333]"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Номер договора</label>
              <input 
                required 
                value={contractNumber} 
                onChange={e => setContractNumber(e.target.value)} 
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100" 
                placeholder="№ 123-A"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Дата подписания</label>
              <DateInput
                value={normalizeDateForInput(contractStartDate) || contractStartDate}
                onChange={setContractStartDate}
                className="w-full"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Услуги / Предмет</label>
            <input 
              required 
              value={contractServices} 
              onChange={e => setContractServices(e.target.value)} 
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100" 
              placeholder="SMM Продвижение"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Сумма (в месяц)</label>
              <input 
                type="number" 
                value={contractAmount} 
                onChange={e => setContractAmount(e.target.value)} 
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Валюта</label>
              <input 
                disabled 
                value="UZS" 
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-gray-100 dark:bg-[#333] text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">День оплаты</label>
              <input 
                type="number" 
                min="1" 
                max="31" 
                value={contractPaymentDay} 
                onChange={e => setContractPaymentDay(e.target.value)} 
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100" 
                placeholder="5"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Статус</label>
              <EntitySearchSelect
                value={contractStatus}
                onChange={(val) => setContractStatus(val as any)}
                options={[
                  { value: 'active', label: 'Активен', searchText: 'активен active' },
                  { value: 'pending', label: 'Ожидание', searchText: 'ожидание pending' },
                  { value: 'completed', label: 'Закрыт', searchText: 'закрыт completed' },
                ]}
                searchPlaceholder="Статус…"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
        </form>
      </div>
    </div>
  );
};

