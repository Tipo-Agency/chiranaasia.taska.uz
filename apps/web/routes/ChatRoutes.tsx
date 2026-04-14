import React from 'react';
import { MiniMessenger } from '../components/features/chat/MiniMessenger';
import { ClientChatsPage } from '../components/pages/ClientChatsPage';
import { PageLayout } from '../components/ui/PageLayout';
import { Container } from '../components/ui/Container';
import type { AppRouterProps } from '../components/appRouterTypes';
import { getChatDefaultTab, type ChatMainTab } from '../utils/chatPreference';
import { MODULE_ACCENTS } from '../components/ui';

export type ChatRoutesExtra = {
  createEntityFromChat: (type: 'task' | 'deal' | 'meeting' | 'doc', title: string) => void;
  updateEntityFromChat: (type: 'task' | 'deal' | 'meeting' | 'doc', id: string, patch: Record<string, unknown>) => void;
  startBusinessProcessFromTemplate: (processId: string) => void;
};

export function ChatRoutesView(props: AppRouterProps & ChatRoutesExtra) {
  const [chatMainTab, setChatMainTab] = React.useState<ChatMainTab>(() => getChatDefaultTab(props.currentUser.id));

  React.useEffect(() => {
    setChatMainTab(getChatDefaultTab(props.currentUser.id));
  }, [props.currentUser.id]);

  return (
    <PageLayout>
      <Container safeArea className="py-4 h-full flex flex-col min-h-0 max-w-6xl mx-auto w-full">
        <div className="flex-1 min-h-[70vh] flex flex-col min-h-0">
          <div className="flex items-center gap-1.5 px-3 py-2 border border-gray-200/90 dark:border-[#333] rounded-xl bg-white/70 dark:bg-[#252525]/90 backdrop-blur-sm shrink-0 mb-3">
            <button
              type="button"
              onClick={() => setChatMainTab('team')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                chatMainTab === 'team'
                  ? MODULE_ACCENTS.teal.navIconActive
                  : 'bg-white/70 dark:bg-[#1f1f1f]/60 text-gray-600 dark:text-gray-300 border border-gray-200/70 dark:border-[#3a3a3a] hover:border-teal-500/30'
              }`}
            >
              Сотрудники
            </button>
            <button
              type="button"
              onClick={() => setChatMainTab('clients')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                chatMainTab === 'clients'
                  ? MODULE_ACCENTS.teal.navIconActive
                  : 'bg-white/70 dark:bg-[#1f1f1f]/60 text-gray-600 dark:text-gray-300 border border-gray-200/70 dark:border-[#3a3a3a] hover:border-teal-500/30'
              }`}
            >
              Клиенты
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {chatMainTab === 'team' ? (
              <MiniMessenger
                className="h-full min-h-0"
                users={props.users}
                currentUser={props.currentUser}
                docs={props.docs}
                tasks={props.allTasks}
                deals={props.deals}
                meetings={props.meetings}
                onOpenTask={props.actions.openTaskModal}
                onOpenDocument={props.actions.handleDocClick}
                onOpenDocumentsModule={() => props.actions.setCurrentView('docs')}
                onOpenDeals={() => props.actions.setCurrentView('sales-funnel')}
                onOpenDeal={(deal) => {
                  props.actions.setCurrentView('sales-funnel');
                  window.setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('openDealFromChat', { detail: { dealId: deal.id } }));
                  }, 0);
                }}
                onOpenMeetings={() => props.actions.setCurrentView('meetings')}
                onOpenMeeting={(meeting) => {
                  props.actions.setCurrentView('meetings');
                  window.setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('openMeetingFromChat', { detail: { meetingId: meeting.id } }));
                  }, 0);
                }}
                onCreateEntity={props.createEntityFromChat}
                onUpdateEntity={props.updateEntityFromChat}
                processTemplates={props.businessProcesses}
                onStartProcessTemplate={props.startBusinessProcessFromTemplate}
              />
            ) : (
              <ClientChatsPage
                layout="embedded"
                deals={props.deals}
                clients={props.clients}
                users={props.users}
                currentUser={props.currentUser}
                salesFunnels={props.salesFunnels}
                onSaveDeal={props.actions.saveDeal}
                onOpenInFunnel={(deal) => {
                  props.actions.setCurrentView('sales-funnel');
                  window.setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('openDealFromChat', { detail: { dealId: deal.id } }));
                  }, 0);
                }}
              />
            )}
          </div>
        </div>
      </Container>
    </PageLayout>
  );
}
