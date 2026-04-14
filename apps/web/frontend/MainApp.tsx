import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import type { SidebarProps } from '../components/Sidebar';
import { AppRouter } from '../components/AppRouter';
import { LoginView } from '../components/LoginView';
import { AppHeader } from '../components/AppHeader';
import TaskModal from '../components/TaskModal';
import IdeaModal from '../components/IdeaModal';
import FeatureModal from '../components/FeatureModal';
import DocModal from '../components/DocModal';
import ProfileModal from '../components/ProfileModal';
import SettingsModal from '../components/SettingsModal';
import CreateTableModal from '../components/CreateTableModal';
import { MiniMessenger } from '../components/features/chat/MiniMessenger';
import { ClientChatsPage } from '../components/pages/ClientChatsPage';
import { ChatFloatingButton } from '../components/features/chat/ChatFloatingButton';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useAppLogic } from './hooks/useAppLogic';
import { useNotificationCenter } from './contexts/NotificationCenterContext';
import { AppShellProviders } from '../providers/AppShellProviders';
import { StandardModal, Input, Button, MODULE_ACCENTS } from '../components/ui';
import {
  createEntityFromChat as createEntityFromChatBridge,
  updateEntityFromChat as updateEntityFromChatBridge,
  startBusinessProcessFromTemplate as startBusinessProcessFromTemplateBridge,
} from '../utils/miniMessengerBridge';
import { getChatDefaultTab, setChatDefaultTab, type ChatMainTab } from '../utils/chatPreference';
import { takeMustChangePasswordPromptSlot } from '../utils/authUiOnce';

function SidebarWithUnread(props: Omit<SidebarProps, 'unreadCount'>) {
  const { unreadCount } = useNotificationCenter();
  return <Sidebar {...props} unreadCount={unreadCount} />;
}

/**
 * Основное приложение после логина: layout, чат, view-based «роутинг» через {@link AppRouter}.
 */
export function MainApp() {
  const { state, actions } = useAppLogic();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [chatOpenToSystemFeed, setChatOpenToSystemFeed] = useState(false);
  const [chatMainTab, setChatMainTab] = useState<ChatMainTab>('team');
  const deepLinkHandledRef = useRef(false);
  const [mustChangePwdOpen, setMustChangePwdOpen] = useState(false);
  const [mustChangePwdDraft, setMustChangePwdDraft] = useState('');
  const [mustChangePwdConfirm, setMustChangePwdConfirm] = useState('');

  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    if (!state.currentUser) return;
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const openTaskId = params.get('openTaskId');
    const openDealId = params.get('openDealId');
    const openMeetingId = params.get('openMeetingId');

    if (!openTaskId && !openDealId && !openMeetingId) return;
    deepLinkHandledRef.current = true;

    if (openTaskId) {
      actions.setCurrentView('tasks');
      const task = (state.tasks || []).find((t) => t && t.id === openTaskId) || null;
      if (task) actions.openTaskModal(task);
      return;
    }
    if (openDealId) {
      actions.setCurrentView('sales-funnel');
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('openDealFromChat', { detail: { dealId: openDealId } }));
      }, 0);
      return;
    }
    if (openMeetingId) {
      actions.setCurrentView('meetings');
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('openMeetingFromChat', { detail: { meetingId: openMeetingId } }));
      }, 0);
      return;
    }
  }, [state.currentUser, state.tasks, actions, state.meetings]);

  useEffect(() => {
    const u = state.currentUser;
    if (!u) return;
    if (!u.mustChangePassword) return;
    if (!takeMustChangePasswordPromptSlot(u.id)) return;
    setMustChangePwdOpen(true);
  }, [state.currentUser?.id, state.currentUser?.mustChangePassword]);

  useEffect(() => {
    const u = state.currentUser;
    if (!u) return;
    setChatMainTab(getChatDefaultTab(u.id));
  }, [state.currentUser?.id]);

  const createEntityFromChat = useCallback(
    (type: 'task' | 'deal' | 'meeting' | 'doc', title: string) => {
      if (!state.currentUser) return Promise.resolve(null);
      return createEntityFromChatBridge(
        {
          currentUser: state.currentUser,
          statuses: state.statuses,
          priorities: state.priorities,
          tasks: state.tasks,
          deals: state.deals,
          meetings: state.meetings,
          docs: state.docs,
          orgPositions: state.orgPositions,
          employeeInfos: state.employeeInfos,
          businessProcesses: state.businessProcesses,
          actions,
        },
        type,
        title
      );
    },
    [
      state.currentUser,
      state.statuses,
      state.priorities,
      state.tasks,
      state.deals,
      state.meetings,
      state.docs,
      state.orgPositions,
      state.employeeInfos,
      state.businessProcesses,
      actions,
    ]
  );

  const updateEntityFromChat = useCallback(
    (type: 'task' | 'deal' | 'meeting' | 'doc', id: string, patch: Record<string, unknown>) => {
      if (!state.currentUser) return Promise.resolve(false);
      return updateEntityFromChatBridge(
        {
          currentUser: state.currentUser,
          statuses: state.statuses,
          priorities: state.priorities,
          tasks: state.tasks,
          deals: state.deals,
          meetings: state.meetings,
          docs: state.docs,
          orgPositions: state.orgPositions,
          employeeInfos: state.employeeInfos,
          businessProcesses: state.businessProcesses,
          actions,
        },
        type,
        id,
        patch
      );
    },
    [
      state.currentUser,
      state.statuses,
      state.priorities,
      state.tasks,
      state.deals,
      state.meetings,
      state.docs,
      state.orgPositions,
      state.employeeInfos,
      state.businessProcesses,
      actions,
    ]
  );

  const onStartProcessTemplate = useCallback(
    (processId: string) => {
      if (!state.currentUser) return Promise.resolve(null);
      return startBusinessProcessFromTemplateBridge(
        {
          currentUser: state.currentUser,
          statuses: state.statuses,
          priorities: state.priorities,
          tasks: state.tasks,
          deals: state.deals,
          meetings: state.meetings,
          docs: state.docs,
          orgPositions: state.orgPositions,
          employeeInfos: state.employeeInfos,
          businessProcesses: state.businessProcesses,
          actions,
        },
        processId
      );
    },
    [
      state.currentUser,
      state.statuses,
      state.priorities,
      state.tasks,
      state.deals,
      state.meetings,
      state.docs,
      state.orgPositions,
      state.employeeInfos,
      state.businessProcesses,
      actions,
    ]
  );

  if (state.isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-[#121212] dark:text-white">
        Загрузка...
      </div>
    );
  }

  if (!state.currentUser) {
    return <LoginView users={state.users} onLogin={(user) => actions.login(user)} />;
  }

  const handleSelectTable = (tableId: string) => {
    actions.setActiveTableId(tableId);
    actions.setCurrentView('table');
  };

  const myTasks = (state.tasks || [])
    .filter(
      (t) =>
        !t.isArchived &&
        t.entityType !== 'idea' &&
        t.entityType !== 'feature' &&
        (t.assigneeId === state.currentUser.id || t.assigneeIds?.includes(state.currentUser.id))
    )
    .slice(0, 30);

  const myDeals = (state.deals || []).filter((d) => !d.isArchived && d.assigneeId === state.currentUser.id).slice(0, 30);

  const myMeetings = (state.meetings || [])
    .filter((m) => !m.isArchived && (m.participantIds || []).includes(state.currentUser.id))
    .slice(0, 30);

  return (
    <AppShellProviders userId={state.currentUser.id}>
      <div
        className={`flex h-screen w-full transition-colors duration-200 overflow-hidden ${state.darkMode ? 'dark bg-[#191919] text-gray-100' : 'bg-white text-gray-900'}`}
        style={{
          height: '100vh',
          maxHeight: '100vh',
          overflow: 'hidden',
        }}
      >
        <SidebarWithUnread
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          tables={state.tables}
          activeTableId={state.activeTableId}
          onSelectTable={handleSelectTable}
          onNavigate={actions.navigate}
          currentView={state.currentView}
          currentUser={state.currentUser}
          onCreateTable={actions.openCreateTable}
          onOpenSettings={() => {
            actions.openSettings('users');
          }}
          onDeleteTable={actions.deleteTable}
          onEditTable={actions.openEditTable}
          activeSpaceTab={state.activeSpaceTab}
          onNavigateToType={(type) => {
            actions.setCurrentView('spaces');
            actions.setActiveSpaceTab(type as 'content-plan' | 'backlog' | 'functionality');
          }}
        />

        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#191919] relative">
          <AppHeader
            darkMode={state.darkMode}
            currentView={state.currentView}
            currentUser={state.currentUser}
            searchQuery={state.searchQuery}
            searchPlaceholder={
              state.currentView === 'sales-funnel'
                ? 'Поиск по сделкам в воронке'
                : state.currentView === 'tasks'
                  ? 'Поиск в задачах'
                  : 'Поиск по системе…'
            }
            onToggleDarkMode={actions.toggleDarkMode}
            onSearchChange={actions.setSearchQuery}
            onSearchFocus={() => {
              if (state.currentView === 'sales-funnel' || state.currentView === 'tasks') return;
              if (state.currentView !== 'search') actions.setCurrentView('search');
            }}
            onOpenSystemChat={() => {
              setChatOpenToSystemFeed(true);
              setChatMainTab('team');
              setChatPanelOpen(true);
            }}
            onOpenSettings={(tab?: string) => {
              actions.openSettings(tab || 'users');
            }}
            onLogout={actions.logout}
            onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
          />

          {state.notification && (
            <div className="absolute top-20 right-4 z-50 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-in fade-in slide-in-from-top-2 duration-200">
              {state.notification}
            </div>
          )}

          {chatPanelOpen && (
            <div
              className="fixed inset-0 z-50 flex flex-col md:items-center md:justify-center md:p-3 sm:p-6 bg-black/45 backdrop-blur-md animate-in fade-in duration-200"
              role="dialog"
              aria-modal="true"
              aria-label="Чат"
              onClick={() => setChatPanelOpen(false)}
            >
              <div
                className="flex flex-col flex-1 min-h-0 w-full md:flex-none md:max-w-5xl md:max-h-[min(720px,92vh)] md:h-[min(640px,90vh)] h-full md:rounded-2xl shadow-2xl overflow-hidden bg-white dark:bg-[#252525] border-0 md:border border-gray-200/90 dark:border-[#333]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-200/80 dark:border-[#333] bg-white/70 dark:bg-[#252525]/90 backdrop-blur-sm shrink-0">
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
                    onClick={() => {
                      setChatOpenToSystemFeed(false);
                      setChatMainTab('clients');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      chatMainTab === 'clients'
                        ? MODULE_ACCENTS.teal.navIconActive
                        : 'bg-white/70 dark:bg-[#1f1f1f]/60 text-gray-600 dark:text-gray-300 border border-gray-200/70 dark:border-[#3a3a3a] hover:border-teal-500/30'
                    }`}
                  >
                    Клиенты
                  </button>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => {
                      if (!state.currentUser) return;
                      setChatDefaultTab(state.currentUser.id, chatMainTab);
                    }}
                    className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#333] transition-colors"
                    title="Сделать вкладку основной"
                  >
                    По умолчанию
                  </button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  {chatMainTab === 'team' ? (
                    <MiniMessenger
                      className="h-full min-h-0 rounded-none border-0 shadow-none"
                      users={state.users}
                      currentUser={state.currentUser}
                      docs={state.docs}
                      tasks={myTasks}
                      deals={myDeals}
                      meetings={myMeetings}
                      onOpenDocument={(doc) => {
                        actions.handleDocClick(doc);
                        setChatPanelOpen(false);
                      }}
                      onOpenTask={(task) => {
                        actions.openTaskModal(task);
                        setChatPanelOpen(false);
                      }}
                      onOpenDeals={() => {
                        actions.setCurrentView('sales-funnel');
                        setChatPanelOpen(false);
                      }}
                      onOpenDeal={(deal) => {
                        actions.setCurrentView('sales-funnel');
                        window.setTimeout(() => {
                          window.dispatchEvent(new CustomEvent('openDealFromChat', { detail: { dealId: deal.id } }));
                        }, 0);
                        setChatPanelOpen(false);
                      }}
                      onOpenMeetings={() => {
                        actions.setCurrentView('meetings');
                        setChatPanelOpen(false);
                      }}
                      onOpenMeeting={(meeting) => {
                        actions.setCurrentView('meetings');
                        window.setTimeout(() => {
                          window.dispatchEvent(
                            new CustomEvent('openMeetingFromChat', { detail: { meetingId: meeting.id } })
                          );
                        }, 0);
                        setChatPanelOpen(false);
                      }}
                      onCreateEntity={createEntityFromChat}
                      processTemplates={state.businessProcesses}
                      onStartProcessTemplate={onStartProcessTemplate}
                      initialOpenSystemFeed={chatOpenToSystemFeed}
                      onConsumedInitialSystemFeed={() => setChatOpenToSystemFeed(false)}
                      onUpdateEntity={updateEntityFromChat}
                      onClose={() => setChatPanelOpen(false)}
                    />
                  ) : (
                    <ClientChatsPage
                      layout="embedded"
                      deals={state.deals}
                      clients={state.clients}
                      users={state.users}
                      currentUser={state.currentUser}
                      salesFunnels={state.salesFunnels}
                      onSaveDeal={actions.saveDeal}
                      onOpenInFunnel={(deal) => {
                        actions.setCurrentView('sales-funnel');
                        window.setTimeout(() => {
                          window.dispatchEvent(new CustomEvent('openDealFromChat', { detail: { dealId: deal.id } }));
                        }, 0);
                        setChatPanelOpen(false);
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-hidden h-full">
            <ErrorBoundary>
              <AppRouter
                currentView={state.currentView}
                searchQuery={state.searchQuery}
                viewMode={state.viewMode}
                activeTableId={state.activeTableId}
                activeTable={state.activeTable}
                filteredTasks={state.tasks}
                allTasks={state.tasks}
                users={state.users}
                currentUser={state.currentUser}
                projects={state.projects}
                statuses={state.statuses}
                priorities={state.priorities}
                activities={state.activityLogs}
                deals={state.deals}
                clients={state.clients}
                contracts={state.contracts}
                oneTimeDeals={state.oneTimeDeals}
                accountsReceivable={state.accountsReceivable}
                employeeInfos={state.employeeInfos}
                meetings={state.meetings}
                contentPosts={state.contentPosts}
                shootPlans={state.shootPlans}
                docs={state.docs}
                folders={state.folders}
                activeDoc={state.activeDoc}
                tables={state.tables}
                departments={state.departments}
                financeCategories={state.financeCategories}
                funds={state.funds}
                financePlan={state.financePlan}
                purchaseRequests={state.purchaseRequests}
                financialPlanDocuments={state.financialPlanDocuments}
                financialPlannings={state.financialPlannings}
                bdr={state.bdr}
                warehouses={state.warehouses}
                inventoryItems={state.inventoryItems}
                inventoryBalances={state.inventoryBalances}
                inventoryMovements={state.inventoryMovements}
                inventoryRevisions={state.inventoryRevisions}
                orgPositions={state.orgPositions}
                businessProcesses={state.businessProcesses}
                salesFunnels={state.salesFunnels}
                automationRules={state.automationRules}
                settingsActiveTab={state.settingsActiveTab}
                activeSpaceTab={state.activeSpaceTab}
                workdeskTab={state.workdeskTab}
                crmHubTab={state.crmHubTab}
                employeesHubTab={state.employeesHubTab}
                notificationPrefs={state.notificationPrefs}
                actions={actions}
              />
            </ErrorBoundary>
          </div>

          <ChatFloatingButton
            hidden={
              state.currentView === 'chat' ||
              chatPanelOpen ||
              (state.currentView === 'sales-funnel' && state.crmHubTab === 'chats')
            }
            onOpen={() => {
              setChatOpenToSystemFeed(false);
              if (state.currentUser) setChatMainTab(getChatDefaultTab(state.currentUser.id));
              setChatPanelOpen(true);
            }}
          />
        </div>

        {state.isTaskModalOpen &&
          state.editingTask &&
          (() => {
            const task = state.editingTask!;

            const table = state.tables.find((t) => t.id === task.tableId);
            const isIdea = table?.type === 'backlog' || task.entityType === 'idea';
            const isFeature = table?.type === 'functionality' || task.entityType === 'feature';

            if (isIdea) {
              return (
                <IdeaModal
                  idea={task}
                  users={state.users}
                  projects={state.projects}
                  currentUser={state.currentUser}
                  onSave={actions.saveTask}
                  onClose={actions.closeTaskModal}
                  onCreateProject={actions.quickCreateProject}
                />
              );
            }

            if (isFeature) {
              return (
                <FeatureModal
                  feature={task}
                  users={state.users}
                  projects={state.projects}
                  statuses={state.statuses}
                  currentUser={state.currentUser}
                  onSave={actions.saveTask}
                  onClose={actions.closeTaskModal}
                  onCreateProject={actions.quickCreateProject}
                />
              );
            }

            return (
              <TaskModal
                users={state.users}
                projects={state.projects}
                statuses={state.statuses}
                priorities={state.priorities}
                currentUser={state.currentUser}
                tables={state.tables}
                docs={state.docs}
                allTasks={state.tasks}
                onSave={actions.saveTask}
                onClose={actions.closeTaskModal}
                onCreateProject={actions.quickCreateProject}
                onDelete={actions.deleteTask}
                onAddComment={actions.addTaskComment}
                onAddAttachment={actions.addTaskAttachment}
                onAddDocAttachment={actions.addTaskDocAttachment}
                onRemoveAttachment={actions.removeTaskAttachment}
                task={task}
              />
            );
          })()}

        {state.isDocModalOpen && (
          <DocModal
            onSave={actions.saveDoc}
            onClose={actions.closeDocModal}
            folders={state.folders}
            initialFolderId={state.targetFolderId}
            editingDoc={
              state.editingDoc
                ? {
                    id: state.editingDoc.id,
                    title: state.editingDoc.title,
                    url: state.editingDoc.url,
                    tags: state.editingDoc.tags,
                    type: state.editingDoc.type,
                    folderId: state.editingDoc.folderId,
                  }
                : undefined
            }
          />
        )}

        {state.isProfileOpen && (
          <ProfileModal
            user={state.currentUser}
            onSave={actions.updateProfile}
            onClose={actions.closeProfile}
            onOpenSettings={actions.openSettings}
            onLogout={actions.logout}
          />
        )}

        {state.isCreateTableModalOpen && (
          <CreateTableModal
            onClose={actions.closeCreateTable}
            onCreate={(name, type, icon, color) => {
              actions.createTable(name, type, icon, color);
            }}
            initialType={state.createTableType}
          />
        )}

        {state.isEditTableModalOpen && state.editingTable && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100]"
            onClick={() => actions.closeEditTable()}
          >
            <div
              className="bg-white dark:bg-[#252525] p-6 rounded-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white">Редактировать страницу</h3>
              <SettingsModal
                users={state.users}
                projects={state.projects}
                statuses={state.statuses}
                priorities={state.priorities}
                tables={state.tables}
                initialTab="pages"
                onClose={actions.closeEditTable}
                onUpdateTable={actions.updateTable}
                onCreateTable={() => {}}
                onDeleteTable={() => {}}
                onUpdateUsers={() => {}}
                onUpdateProjects={() => {}}
                onUpdateStatuses={() => {}}
                onUpdatePriorities={() => {}}
                onUpdateNotificationPrefs={() => {}}
              />
            </div>
          </div>
        )}
      </div>

      <StandardModal
        isOpen={mustChangePwdOpen}
        onClose={() => setMustChangePwdOpen(false)}
        title="Установите пароль"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setMustChangePwdOpen(false);
                setMustChangePwdDraft('');
                setMustChangePwdConfirm('');
              }}
            >
              Позже
            </Button>
            <Button
              onClick={() => {
                const p1 = mustChangePwdDraft.trim();
                const p2 = mustChangePwdConfirm.trim();
                if (!p1 || p1 !== p2) return;
                actions.updateProfile({ ...state.currentUser!, password: p1, mustChangePassword: false } as any);
                setMustChangePwdOpen(false);
                setMustChangePwdDraft('');
                setMustChangePwdConfirm('');
              }}
              disabled={!mustChangePwdDraft.trim() || mustChangePwdDraft.trim() !== mustChangePwdConfirm.trim()}
            >
              Сохранить
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="text-sm text-gray-700 dark:text-gray-200">
            Для безопасности установите пароль. Можно закрыть и сделать позже — окно не будет повторяться до следующего
            входа.
          </div>
          <Input
            label="Новый пароль"
            type="password"
            value={mustChangePwdDraft}
            onChange={(e) => setMustChangePwdDraft(e.target.value)}
          />
          <Input
            label="Повторите пароль"
            type="password"
            value={mustChangePwdConfirm}
            onChange={(e) => setMustChangePwdConfirm(e.target.value)}
          />
        </div>
      </StandardModal>
    </AppShellProviders>
  );
}
