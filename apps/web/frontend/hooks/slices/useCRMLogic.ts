
import { useState } from 'react';
import { Client, Deal, Contract, OneTimeDeal, EmployeeInfo, AccountsReceivable } from '../../../types';
import { api } from '../../../backend/api';
import { createSaveHandler, createDeleteHandler, saveItem } from '../../../utils/crudUtils';
import { NOTIFICATION_MESSAGES } from '../../../constants/messages';

export const useCRMLogic = (showNotification: (msg: string) => void) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]); // CRM воронка
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [oneTimeDeals, setOneTimeDeals] = useState<OneTimeDeal[]>([]);
  const [accountsReceivable, setAccountsReceivable] = useState<AccountsReceivable[]>([]);
  const [employeeInfos, setEmployeeInfos] = useState<EmployeeInfo[]>([]);

  // Clients — POST/PATCH на сервер, без PUT всего списка
  const saveClient = (client: Client) => {
    const now = new Date().toISOString();
    setClients((prev) => {
      const exists = prev.some((c) => c.id === client.id);
      const optimistic = { ...client, updatedAt: now } as Client;
      void (async () => {
        try {
          const saved = exists
            ? await api.clients.patch(client.id, {
                name: client.name,
                phone: client.phone,
                email: client.email,
                telegram: client.telegram,
                instagram: client.instagram,
                companyName: client.companyName,
                notes: client.notes,
                tags: client.tags,
                isArchived: client.isArchived ?? false,
                ...(client.version != null && Number.isFinite(client.version)
                  ? { version: client.version }
                  : {}),
              })
            : await api.clients.create(client);
          setClients((p) => saveItem(p, { ...saved, updatedAt: now }));
          showNotification(NOTIFICATION_MESSAGES.CLIENT_SAVED);
        } catch {
          showNotification('Ошибка сохранения. Проверьте подключение и повторите.');
        }
      })();
      return saveItem(prev, optimistic);
    });
  };

  const deleteClient = (id: string) => {
    const now = new Date().toISOString();
    setClients((prev) => {
      const prevRow = prev.find((c) => c.id === id);
      void (async () => {
        try {
          const saved = await api.clients.patch(id, {
            isArchived: true,
            ...(prevRow?.version != null && Number.isFinite(prevRow.version)
              ? { version: prevRow.version }
              : {}),
          });
          setClients((p) => saveItem(p, { ...saved, updatedAt: now }));
          showNotification(NOTIFICATION_MESSAGES.CLIENT_DELETED);
        } catch {
          showNotification('Ошибка удаления. Проверьте подключение и повторите.');
        }
      })();
      return prev.map((item) =>
        item.id === id ? ({ ...item, isArchived: true, updatedAt: now } as Client) : item
      );
    });
  };

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


  // AccountsReceivable — после PUT перезагружаем список (статус считает только бэкенд)
  const refetchAccountsReceivable = async () => {
    try {
      const rows = await api.accountsReceivable.getAll();
      setAccountsReceivable(rows as AccountsReceivable[]);
    } catch {
      /* оставляем оптимистичное состояние */
    }
  };

  const saveAccountsReceivable = (item: AccountsReceivable) => {
    setAccountsReceivable((prev) => {
      const updated = saveItem(prev, item);
      void (async () => {
        try {
          await api.accountsReceivable.updateAll(updated);
          await refetchAccountsReceivable();
          showNotification('Задолженность сохранена');
        } catch {
          showNotification('Ошибка сохранения. Проверьте подключение и повторите.');
        }
      })();
      return updated;
    });
  };

  const deleteAccountsReceivable = (id: string) => {
    const now = new Date().toISOString();
    setAccountsReceivable((prev) => {
      const updated = prev.map((r) =>
        r.id === id ? { ...r, isArchived: true, updatedAt: now } : r
      );
      void (async () => {
        try {
          await api.accountsReceivable.updateAll(updated);
          await refetchAccountsReceivable();
          showNotification('Задолженность удалена');
        } catch {
          showNotification('Ошибка удаления. Проверьте подключение и повторите.');
        }
      })();
      return updated;
    });
  };

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
