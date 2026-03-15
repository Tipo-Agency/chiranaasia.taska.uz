
import { useState, useMemo } from 'react';
import { Client, Deal, EmployeeInfo, AccountsReceivable } from '../../../types';
import { api } from '../../../backend/api';
import { createSaveHandler, createDeleteHandler } from '../../../utils/crudUtils';
import { NOTIFICATION_MESSAGES } from '../../../constants/messages';

export const useCRMLogic = (showNotification: (msg: string) => void) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]); // Объединенная сущность для договоров и продаж
  const [accountsReceivable, setAccountsReceivable] = useState<AccountsReceivable[]>([]);
  const [employeeInfos, setEmployeeInfos] = useState<EmployeeInfo[]>([]);
  
  // Алиасы для обратной совместимости (мемоизированы для правильного обновления)
  const contracts = useMemo(() => deals.filter(d => d.recurring === true), [deals]);
  const oneTimeDeals = useMemo(() => deals.filter(d => d.recurring === false), [deals]);

  // Clients
  const saveClient = createSaveHandler(
    setClients,
    api.clients.updateAll,
    showNotification,
    NOTIFICATION_MESSAGES.CLIENT_SAVED
  );
  const deleteClient = createDeleteHandler(
    setClients,
    api.clients.updateAll,
    showNotification,
    NOTIFICATION_MESSAGES.CLIENT_DELETED
  );

  // Deals (объединенные договоры и продажи)
  const saveDeal = createSaveHandler(
    setDeals,
    api.deals.updateAll,
    showNotification,
    'Сделка сохранена'
  );
  const deleteDeal = createDeleteHandler(
    setDeals,
    api.deals.updateAll,
    showNotification,
    'Сделка удалена'
  );
  
  // Алиасы для обратной совместимости
  const saveContract = (deal: Deal) => {
    const contractDeal: Deal = { ...deal, recurring: true };
    saveDeal(contractDeal);
  };
  const deleteContract = (id: string) => {
    deleteDeal(id);
  };
  const saveOneTimeDeal = (deal: Deal) => {
    const oneTimeDeal: Deal = { ...deal, recurring: false };
    saveDeal(oneTimeDeal);
  };
  const deleteOneTimeDeal = (id: string) => {
    deleteDeal(id);
  };

  // Employees
  const saveEmployee = createSaveHandler(
    setEmployeeInfos,
    api.employees.updateAll,
    showNotification,
    NOTIFICATION_MESSAGES.EMPLOYEE_SAVED
  );
  const deleteEmployee = createDeleteHandler(
    setEmployeeInfos,
    api.employees.updateAll,
    showNotification,
    NOTIFICATION_MESSAGES.EMPLOYEE_DELETED
  );


  // AccountsReceivable
  const saveAccountsReceivable = createSaveHandler(
    setAccountsReceivable,
    api.accountsReceivable.updateAll,
    showNotification,
    'Задолженность сохранена'
  );
  const deleteAccountsReceivable = createDeleteHandler(
    setAccountsReceivable,
    api.accountsReceivable.updateAll,
    showNotification,
    'Задолженность удалена'
  );

  return {
    state: { 
      clients, 
      deals, // Основная сущность
      contracts, // Алиас для обратной совместимости
      oneTimeDeals, // Алиас для обратной совместимости
      accountsReceivable, 
      employeeInfos 
    },
    setters: { 
      setClients, 
      setDeals, // Основной setter
      setAccountsReceivable, 
      setEmployeeInfos 
    },
    actions: { 
      saveClient, deleteClient, 
      saveDeal, deleteDeal, // Основные методы
      saveContract, deleteContract, // Алиасы
      saveOneTimeDeal, deleteOneTimeDeal, // Алиасы
      saveAccountsReceivable, deleteAccountsReceivable,
      saveEmployee, deleteEmployee
    }
  };
};
