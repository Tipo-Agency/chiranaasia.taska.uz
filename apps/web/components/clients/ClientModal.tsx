import React, { useState, useEffect, useMemo } from 'react';
import { Client, SalesFunnel, Deal } from '../../types';
import { X, Edit2, Receipt, FileText } from 'lucide-react';
import { TaskSelect } from '../TaskSelect';

interface ClientModalProps {
  isOpen: boolean;
  editingClient: Client | null;
  salesFunnels?: SalesFunnel[];
  contracts?: Deal[];
  oneTimeDeals?: Deal[];
  onClose: () => void;
  onSave: (client: Client) => void;
  onDelete?: (id: string) => void;
  onEditContract?: (contract: Deal) => void;
  onEditOneTimeDeal?: (deal: Deal) => void;
}

export const ClientModal: React.FC<ClientModalProps> = ({
  isOpen,
  editingClient,
  salesFunnels = [],
  contracts = [],
  oneTimeDeals = [],
  onClose,
  onSave,
  onDelete,
  onEditContract,
  onEditOneTimeDeal,
}) => {
  const [clientModalTab, setClientModalTab] = useState<'company' | 'notes' | 'contracts'>('company');
  const [clientName, setClientName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientTelegram, setClientTelegram] = useState('');
  const [clientInstagram, setClientInstagram] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyInfo, setCompanyInfo] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [clientFunnelId, setClientFunnelId] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (editingClient) {
        setClientName(editingClient.name);
        setContactPerson(editingClient.contactPerson || '');
        setClientPhone(editingClient.phone || '');
        setClientEmail(editingClient.email || '');
        setClientTelegram(editingClient.telegram || '');
        setClientInstagram(editingClient.instagram || '');
        setCompanyName(editingClient.companyName || '');
        setCompanyInfo(editingClient.companyInfo || '');
        setClientNotes(editingClient.notes || '');
        setClientFunnelId(editingClient.funnelId || '');
      } else {
        setClientName('');
        setContactPerson('');
        setClientPhone('');
        setClientEmail('');
        setClientTelegram('');
        setClientInstagram('');
        setCompanyName('');
        setCompanyInfo('');
        setClientNotes('');
        setClientFunnelId('');
      }
      setClientModalTab('company');
    }
  }, [isOpen, editingClient]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSave({
      id: editingClient ? editingClient.id : `cl-${Date.now()}`,
      name: clientName,
      contactPerson: contactPerson || undefined,
      phone: clientPhone || undefined,
      email: clientEmail || undefined,
      telegram: clientTelegram || undefined,
      instagram: clientInstagram || undefined,
      companyName: companyName || undefined,
      companyInfo: companyInfo || undefined,
      notes: clientNotes || undefined,
      funnelId: clientFunnelId || undefined
    });
    onClose();
  };

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      if (window.confirm("Сохранить изменения?")) handleSubmit();
      else onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center z-[80] animate-in fade-in duration-200" 
      onClick={handleBackdrop}
    >
      <div 
        className="bg-white dark:bg-[#252525] rounded-t-2xl md:rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-[#333] flex flex-col max-h-[95vh] md:max-h-[90vh]" 
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-100 dark:border-[#333] bg-white dark:bg-[#252525] shrink-0">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-gray-800 dark:text-white">
              {editingClient ? 'Редактировать клиента' : 'Новый клиент'}
            </h3>
            <button 
              onClick={onClose} 
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#333]"
            >
              <X size={18} />
            </button>
          </div>
          {/* Вкладки */}
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#333] rounded-full p-1 text-xs">
            <button 
              type="button"
              onClick={() => setClientModalTab('company')} 
              className={`px-3 py-1.5 rounded-full flex items-center gap-1 ${
                clientModalTab === 'company'
                  ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              Компания
            </button>
            <button 
              type="button"
              onClick={() => setClientModalTab('notes')} 
              className={`px-3 py-1.5 rounded-full flex items-center gap-1 ${
                clientModalTab === 'notes'
                  ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              Заметки
            </button>
            {editingClient && (
              <button 
                type="button"
                onClick={() => setClientModalTab('contracts')} 
                className={`px-3 py-1.5 rounded-full flex items-center gap-1 ${
                  clientModalTab === 'contracts'
                    ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                Договоры и продажи
              </button>
            )}
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {clientModalTab === 'company' ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Название компании</label>
                  <input 
                    required 
                    value={clientName} 
                    onChange={e => setClientName(e.target.value)} 
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100" 
                    placeholder="OOO Company"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Контактное лицо</label>
                  <input 
                    value={contactPerson} 
                    onChange={e => setContactPerson(e.target.value)} 
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Телефон</label>
                    <input 
                      value={clientPhone} 
                      onChange={e => setClientPhone(e.target.value)} 
                      className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Email</label>
                    <input 
                      value={clientEmail} 
                      onChange={e => setClientEmail(e.target.value)} 
                      className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Telegram</label>
                    <input 
                      value={clientTelegram} 
                      onChange={e => setClientTelegram(e.target.value)} 
                      className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100" 
                      placeholder="@username"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Instagram</label>
                    <input 
                      value={clientInstagram} 
                      onChange={e => setClientInstagram(e.target.value)} 
                      className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100" 
                      placeholder="@username"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">О компании</label>
                  <textarea 
                    value={companyInfo} 
                    onChange={e => setCompanyInfo(e.target.value)} 
                    className="w-full h-32 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 resize-none" 
                    placeholder="Чем занимается компания..."
                  />
                </div>
                {salesFunnels && salesFunnels.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Воронка продаж</label>
                    <TaskSelect
                      value={clientFunnelId}
                      onChange={setClientFunnelId}
                      options={[
                        { value: '', label: 'Не выбрано' },
                        ...salesFunnels.map(f => ({ value: f.id, label: f.name }))
                      ]}
                      className="bg-white dark:bg-[#333] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                )}
              </>
            ) : clientModalTab === 'notes' ? (
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Заметки</label>
                <textarea 
                  value={clientNotes} 
                  onChange={e => setClientNotes(e.target.value)} 
                  className="w-full h-64 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 resize-none" 
                  placeholder="Дополнительные заметки о клиенте..."
                />
              </div>
            ) : clientModalTab === 'contracts' && editingClient ? (
              <div className="space-y-4">
                {/* Договоры */}
                <div>
                  <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <FileText size={16} />
                    Договоры
                  </h4>
                  {contracts.filter(c => !c.isArchived && c.clientId === editingClient.id).length > 0 ? (
                    <div className="space-y-2">
                      {contracts.filter(c => !c.isArchived && c.clientId === editingClient.id).map(contract => (
                        <div 
                          key={contract.id} 
                          className="p-3 bg-gray-50 dark:bg-[#333] rounded-lg border border-gray-200 dark:border-[#444] flex justify-between items-center hover:bg-gray-100 dark:hover:bg-[#404040] transition-colors cursor-pointer"
                          onClick={() => onEditContract && onEditContract(contract)}
                        >
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{contract.number}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{contract.description}</div>
                            <div className="text-sm font-bold text-gray-900 dark:text-white mt-1">{contract.amount.toLocaleString()} {contract.currency || 'UZS'}</div>
                          </div>
                          {onEditContract && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onEditContract(contract); }}
                              className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 dark:text-gray-500">Нет договоров</p>
                  )}
                </div>

                {/* Продажи */}
                <div>
                  <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <Receipt size={16} />
                    Продажи
                  </h4>
                  {oneTimeDeals.filter(d => !d.isArchived && d.clientId === editingClient.id).length > 0 ? (
                    <div className="space-y-2">
                      {oneTimeDeals.filter(d => !d.isArchived && d.clientId === editingClient.id).map(deal => (
                        <div 
                          key={deal.id} 
                          className="p-3 bg-gray-50 dark:bg-[#333] rounded-lg border border-gray-200 dark:border-[#444] flex justify-between items-center hover:bg-gray-100 dark:hover:bg-[#404040] transition-colors cursor-pointer"
                          onClick={() => onEditOneTimeDeal && onEditOneTimeDeal(deal)}
                        >
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                              {deal.number || `Продажа от ${new Date(deal.date).toLocaleDateString()}`}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{deal.description}</div>
                            <div className="text-sm font-bold text-gray-900 dark:text-white mt-1">{deal.amount.toLocaleString()} {deal.currency || 'UZS'}</div>
                          </div>
                          {onEditOneTimeDeal && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onEditOneTimeDeal(deal); }}
                              className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 dark:text-gray-500">Нет продаж</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
          <div className="p-6 border-t border-gray-100 dark:border-[#333] flex justify-between items-center shrink-0">
            {editingClient && onDelete && (
              <button 
                type="button" 
                onClick={() => { 
                  if (confirm('Удалить?')) {
                    onDelete(editingClient.id);
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

