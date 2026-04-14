import React from 'react';
import { InboxPage } from '../components/pages/InboxPage';
import type { AppRouterProps } from '../components/appRouterTypes';

export function InboxRoutesView(props: AppRouterProps) {
  const { actions } = props;
  return (
    <InboxPage
      activities={props.activities}
      users={props.users}
      currentUser={props.currentUser}
      tasks={props.allTasks}
      deals={props.deals}
      purchaseRequests={props.purchaseRequests}
      onMarkAllRead={actions.markAllRead}
    />
  );
}
