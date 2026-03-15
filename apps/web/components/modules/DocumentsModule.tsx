import React from 'react';
import { TableCollection, Doc, Folder, TableCollection as Table } from '../../types';
import DocumentsView from '../DocumentsView';

interface DocumentsModuleProps {
  table: TableCollection;
  docs: Doc[];
  folders: Folder[];
  tables: Table[];
  tasks?: any[];
  actions: any;
}

export const DocumentsModule: React.FC<DocumentsModuleProps> = ({
  table,
  docs,
  folders,
  tables,
  tasks = [],
  actions,
}) => {
  return (
    <div className="h-full flex flex-col min-h-0 bg-white dark:bg-[#191919]">
      <DocumentsView 
        docs={docs} 
        folders={folders} 
        tableId={table.id} 
        showAll={table.isSystem} 
        tables={tables}
        tasks={tasks}
        onOpenDoc={actions.handleDocClick} 
        onAddDoc={(folderId) => actions.openDocModal(folderId)} 
        onEditDoc={actions.openEditDocModal}
        onCreateFolder={(name, parentFolderId) => actions.createFolder(name, table.id, parentFolderId)} 
        onDeleteFolder={actions.deleteFolder} 
        onDeleteDoc={actions.deleteDoc}
        onDeleteAttachment={(taskId, attachmentId) => {
          const task = tasks.find(t => t.id === taskId);
          if (task) {
            const updatedAttachments = (task.attachments || []).filter(a => a.id !== attachmentId);
            actions.saveTask({ id: taskId, attachments: updatedAttachments });
          }
        }}
      />
    </div>
  );
};

