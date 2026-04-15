import React from 'react';
import { TableCollection, Doc, Folder, TableCollection as Table, User, Department, EmployeeInfo, Task, Deal, InventoryItem } from '../../types';
import type { AppActions } from '../../frontend/hooks/useAppLogic';
import DocumentsView from '../DocumentsView';

interface DocumentsModuleProps {
  embedInWorkdesk?: boolean;
  table: TableCollection;
  docs: Doc[];
  folders: Folder[];
  tables: Table[];
  tasks?: Task[];
  deals?: Deal[];
  inventoryItems?: InventoryItem[];
  users: User[];
  departments?: Department[];
  employees?: EmployeeInfo[];
  currentUser: User;
  actions: AppActions;
}

export const DocumentsModule: React.FC<DocumentsModuleProps> = ({
  embedInWorkdesk = false,
  table,
  docs,
  folders,
  tables,
  tasks = [],
  deals = [],
  inventoryItems = [],
  users,
  departments = [],
  employees = [],
  currentUser,
  actions,
}) => {
  return (
    <div className="h-full flex flex-col min-h-0 min-w-0">
      <DocumentsView
        embedInWorkdesk={embedInWorkdesk}
        docs={docs}
        folders={folders} 
        tableId={table.id} 
        showAll={table.isSystem} 
        tables={tables}
        tasks={tasks}
        users={users}
        departments={departments}
        employees={employees}
        currentUser={currentUser}
        onOpenDoc={actions.handleDocClick} 
        onAddDoc={(folderId) => actions.openDocModal(folderId)} 
        onEditDoc={actions.openEditDocModal}
        onCreateFolder={(name, parentFolderId) => actions.createFolder(name, table.id, parentFolderId)} 
        onDeleteFolder={actions.deleteFolder}
        onUpdateFolder={actions.updateFolder}
        onDeleteDoc={actions.deleteDoc}
        onOpenTask={actions.openTaskModal}
        onUpdateTask={(taskId, updates) => actions.saveTask({ id: taskId, ...updates })}
        onDeleteAttachment={(taskId, attachmentId) => {
          const task = tasks.find(t => t.id === taskId);
          if (task) {
            const updatedAttachments = (task.attachments || []).filter(a => a.id !== attachmentId);
            actions.saveTask({ id: taskId, attachments: updatedAttachments });
          }
        }}
        deals={deals}
        inventoryItems={inventoryItems}
        onSaveDeal={actions.saveDeal}
        onSaveInventoryItem={actions.saveInventoryItem}
      />
    </div>
  );
};

