
import { useState } from 'react';
import { Client, Deal, Contract, OneTimeDeal, EmployeeInfo, AccountsReceivable } from '../../../types';
import { api } from '../../../backend/api';
import { createSaveHandler, createDeleteHandler } from '../../../utils/crudUtils';
import { NOTIFICATION_MESSAGES } from '../../../constants/messages';

export const useCRMLogic = (showNotification: (msg: string) => void) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]); // CRM воронка
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [oneTimeDeals, setOneTimeDeals] = useState<OneTimeDeal[]>([]);
  const [accountsReceivable, setAccountsReceivable] = useState<AccountsReceivable[]>([]);
  const [employeeInfos, setEmployeeInfos] = useState<EmployeeInfo[]>([]);

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

  // CRM deals
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
  
  // Contracts / one-time sales
  const saveContractBase = createSaveHandler(
    setContracts,
    api.contracts.updateAll,
    showNotification,
    'Договор сохранен'
  );
  const deleteContractBase = createDeleteHandler(
    setContracts,
    api.contracts.updateAll,
    showNotification,
    'Договор удален'
  );
  const saveOneTimeDealBase = createSaveHandler(
    setOneTimeDeals,
    api.oneTimeDeals.updateAll,
    showNotification,
    'Продажа сохранена'
  );
  const deleteOneTimeDealBase = createDeleteHandler(
    setOneTimeDeals,
    api.oneTimeDeals.updateAll,
    showNotification,
    'Продажа удалена'
  );

  const saveContract = (deal: Deal) => {
    const contractDeal: Contract = { ...deal, recurring: true, dealKind: 'contract' };
    saveContractBase(contractDeal);
  };
  const deleteContract = (id: string) => {
    deleteContractBase(id);
  };
  const saveOneTimeDeal = (deal: Deal) => {
    const oneTimeDeal: OneTimeDeal = { ...deal, recurring: false, dealKind: 'contract' };
    saveOneTimeDealBase(oneTimeDeal);
  };
  const deleteOneTimeDeal = (id: string) => {
    deleteOneTimeDealBase(id);
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
      setContracts,
      setOneTimeDeals,
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
