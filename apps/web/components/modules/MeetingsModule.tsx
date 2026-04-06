import React from 'react';
import { TableCollection, Meeting, User, Client, Deal, Project, TableCollection as Table, NotificationPreferences, ShootPlan } from '../../types';
import type { AppActions } from '../../frontend/hooks/useAppLogic';
import MeetingsView from '../MeetingsView';

interface MeetingsModuleProps {
  table: TableCollection;
  meetings: Meeting[];
  users: User[];
  clients?: Client[];
  deals?: Deal[];
  projects?: Project[];
  tables: Table[];
  notificationPrefs?: NotificationPreferences;
  shootPlans?: ShootPlan[];
  actions: AppActions;
}

export const MeetingsModule: React.FC<MeetingsModuleProps> = ({
  table,
  meetings,
  users,
  clients = [],
  deals = [],
  projects = [],
  tables,
  notificationPrefs,
  shootPlans = [],
  actions,
}) => {
  return (
    <div className="h-full flex flex-col min-h-0 bg-white dark:bg-[#191919]">
      <MeetingsView 
        meetings={meetings} 
        users={users}
        projects={projects}
        clients={clients}
        deals={deals}
        tableId={table.id} 
        showAll={table.isSystem} 
        tables={tables} 
        onSaveMeeting={actions.saveMeeting}
        onDeleteMeeting={actions.deleteMeeting}
        onUpdateSummary={actions.updateMeetingSummary}
        notificationPrefs={notificationPrefs}
        shootPlans={shootPlans}
        onNavigateToShootPlan={actions.openShootPlanFromCalendar}
      />
    </div>
  );
};

