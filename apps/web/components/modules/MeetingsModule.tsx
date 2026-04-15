import React from 'react';
import { TableCollection, Meeting, User, Client, Deal, Project, TableCollection as Table, NotificationPreferences, ShootPlan, ContentPost } from '../../types';
import type { AppActions } from '../../frontend/hooks/useAppLogic';
import MeetingsView from '../MeetingsView';

interface MeetingsModuleProps {
  /** Рабочий стол: без второго фона и без дублирующих полей — отступы даёт WorkdeskView */
  embedInWorkdesk?: boolean;
  table: TableCollection;
  meetings: Meeting[];
  users: User[];
  clients?: Client[];
  deals?: Deal[];
  projects?: Project[];
  tables: Table[];
  notificationPrefs?: NotificationPreferences;
  shootPlans?: ShootPlan[];
  contentPosts?: ContentPost[];
  actions: AppActions;
}

export const MeetingsModule: React.FC<MeetingsModuleProps> = ({
  embedInWorkdesk = false,
  table,
  meetings,
  users,
  clients = [],
  deals = [],
  projects = [],
  tables,
  notificationPrefs,
  shootPlans = [],
  contentPosts = [],
  actions,
}) => {
  return (
    <div
      className={
        embedInWorkdesk
          ? 'h-full flex flex-col min-h-0 min-w-0'
          : 'h-full flex flex-col min-h-0 bg-white dark:bg-[#191919]'
      }
    >
      <MeetingsView
        embedInWorkdesk={embedInWorkdesk}
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
        contentPosts={contentPosts}
        onSaveShootPlan={actions.saveShootPlan}
      />
    </div>
  );
};

