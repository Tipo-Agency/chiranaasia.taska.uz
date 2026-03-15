import React from 'react';
import { TableCollection, Meeting, User, Client, Deal, TableCollection as Table } from '../../types';
import MeetingsView from '../MeetingsView';

interface MeetingsModuleProps {
  table: TableCollection;
  meetings: Meeting[];
  users: User[];
  clients?: Client[];
  deals?: Deal[];
  tables: Table[];
  actions: any;
}

export const MeetingsModule: React.FC<MeetingsModuleProps> = ({
  table,
  meetings,
  users,
  clients = [],
  deals = [],
  tables,
  actions,
}) => {
  return (
    <div className="h-full flex flex-col min-h-0 bg-white dark:bg-[#191919]">
      <MeetingsView 
        meetings={meetings} 
        users={users}
        clients={clients}
        deals={deals}
        tableId={table.id} 
        showAll={table.isSystem} 
        tables={tables} 
        onSaveMeeting={actions.saveMeeting}
        onDeleteMeeting={actions.deleteMeeting}
        onUpdateSummary={actions.updateMeetingSummary} 
      />
    </div>
  );
};

