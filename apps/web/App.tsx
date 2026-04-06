
import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import type { SidebarProps } from './components/Sidebar';
import { AppRouter } from './components/AppRouter';
import { LoginView } from './components/LoginView';
import { AppHeader } from './components/AppHeader';
import TaskModal from './components/TaskModal';
import IdeaModal from './components/IdeaModal';
import FeatureModal from './components/FeatureModal';
import DocModal from './components/DocModal';
import ProfileModal from './components/ProfileModal';
import SettingsModal from './components/SettingsModal';
import CreateTableModal from './components/CreateTableModal';
import PublicContentPlanView from './components/PublicContentPlanView';
import { MiniMessenger } from './components/features/chat/MiniMessenger';
import { MessageCircle } from 'lucide-react';
import { useAppLogic } from './frontend/hooks/useAppLogic';
import { NotificationCenterProvider, useNotificationCenter } from './frontend/contexts/NotificationCenterContext';
import type { AppHeaderProps } from './components/AppHeader';
import { StandardModal, Input, Button } from './components/ui';
import { resolveAssigneesForOrgPosition } from './utils/orgPositionAssignee';

/** Синхронно из pathname — чтобы не монтировать useAppLogic на публичной странице (избегаем React #310). */
function getPublicContentPlanIdFromPath(): string | null {
  if (typeof window === 'undefined') return null;
  const m = window.location.pathname.match(/^\/content-plan\/(.+)$/);
  return m ? decodeURIComponent(m[1].trim()) : null;
}

function AppHeaderWithNotifications(
  props: Omit<AppHeaderProps, 'activityLogs' | 'unreadNotificationsCount' | 'onMarkAllRead'>
) {
  const { notifications, unreadCount, markAllRead } = useNotificationCenter();
  return (
    <AppHeader
      {...props}
      activityLogs={notifications}
      unreadNotificationsCount={unreadCount}
      onMarkAllRead={markAllRead}
    />
  );
}

function SidebarWithUnread(props: Omit<SidebarProps, 'unreadCount'>) {
  const { unreadCount } = useNotificationCenter();
  return <Sidebar {...props} unreadCount={unreadCount} />;
}

function MainApp() {
  const { state, actions } = useAppLogic();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [chatOpenToSystemFeed, setChatOpenToSystemFeed] = useState(false);
  const deepLinkHandledRef = useRef(false);
  const [mustChangePwdOpen, setMustChangePwdOpen] = useState(false);
  const [mustChangePwdDraft, setMustChangePwdDraft] = useState('');
  const [mustChangePwdConfirm, setMustChangePwdConfirm] = useState('');

  // Важно: useEffect должен вызываться безусловно, до любых ранних return,
  // иначе React бросает ошибку "Rendered fewer/more hooks than expected" (#310).
  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    if (!state.currentUser) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const openTaskId = params.get("openTaskId");
    const openDealId = params.get("openDealId");
    const openMeetingId = params.get("openMeetingId");

    if (!openTaskId && !openDealId && !openMeetingId) return;
    deepLinkHandledRef.current = true;

    if (openTaskId) {
      actions.setCurrentView("tasks");
      const task = (state.tasks || []).find((t) => t && t.id === openTaskId) || null;
      if (task) actions.openTaskModal(task);
      return;
    }
    if (openDealId) {
      actions.setCurrentView("sales-funnel");
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("openDealFromChat", { detail: { dealId: openDealId } }));
      }, 0);
      return;
    }
    if (openMeetingId) {
      actions.setCurrentView("meetings");
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("openMeetingFromChat", { detail: { meetingId: openMeetingId } }));
      }, 0);
      return;
    }
  }, [state.currentUser, state.tasks, actions, state.meetings]);

  // Prompt password setup once per login/session if required.
  useEffect(() => {
    const u = state.currentUser;
    if (!u) return;
    if (!u.mustChangePassword) return;
    try {
      const key = `must_change_password_prompt_shown:${u.id}`;
      if (sessionStorage.getItem(key) === '1') return;
      sessionStorage.setItem(key, '1');
    } catch {
      // ignore
    }
    setMustChangePwdOpen(true);
  }, [state.currentUser?.id, state.currentUser?.mustChangePassword]);

  if (state.isLoading) return <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-[#121212] dark:text-white">Загрузка...</div>;

  if (!state.currentUser) {
    return <LoginView users={state.users} onLogin={user => { actions.login(user); }} />;
  }

  const handleOpenEditCurrentTable = () => {
      if (state.activeTable) actions.openEditTable(state.activeTable);
  };

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

  const createEntityFromChat = async (
    type: 'task' | 'deal' | 'meeting' | 'doc',
    title: string
  ): Promise<{ id: string; label: string } | null> => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const nowIso = now.toISOString();

    if (type === 'task') {
      const task = {
        id: `chat-task-${Date.now()}`,
        entityType: 'task' as const,
        tableId: '',
        title,
        status: state.statuses?.[0]?.name || 'Не начато',
        priority: state.priorities?.[1]?.name || state.priorities?.[0]?.name || 'Средний',
        assigneeId: state.currentUser.id,
        projectId: null,
        startDate: today,
        endDate: today,
        description: '',
        createdByUserId: state.currentUser.id,
        createdAt: nowIso,
      };
      await actions.saveTask(task);
      return { id: task.id, label: task.title };
    }

    if (type === 'deal') {
      const deal = {
        id: `chat-deal-${Date.now()}`,
        dealKind: 'funnel' as const,
        title,
        amount: 0,
        currency: 'UZS',
        stage: 'new',
        assigneeId: state.currentUser.id,
        createdAt: nowIso,
      };
      await actions.saveDeal(deal);
      return { id: deal.id, label: deal.title || title };
    }

    if (type === 'meeting') {
      const meeting = {
        id: `chat-meeting-${Date.now()}`,
        tableId: 'meetings-system',
        title,
        date: today,
        time: '10:00',
        participantIds: [state.currentUser.id],
        summary: '',
        type: 'work' as const,
      };
      await actions.saveMeeting(meeting);
      return { id: meeting.id, label: meeting.title };
    }

    const doc = {
      id: `chat-doc-${Date.now()}`,
      tableId: 'docs-system',
      title,
      type: 'internal',
      tags: [],
      content: '',
    };
    await actions.saveDoc(doc);
    return { id: doc.id, label: doc.title };
  };

  return (
    <NotificationCenterProvider userId={state.currentUser.id}>
    <div 
      className={`flex h-screen w-full transition-colors duration-200 overflow-hidden ${state.darkMode ? 'dark bg-[#191919] text-gray-100' : 'bg-white text-gray-900'}`}
      style={{
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
      }}
    >
        {/* Sidebar */}
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
            onOpenSettings={() => { actions.openSettings('users'); }}
            onDeleteTable={actions.deleteTable}
            onEditTable={actions.openEditTable}
            activeSpaceTab={state.activeSpaceTab}
            onNavigateToType={(type) => {
              actions.setCurrentView('spaces');
              actions.setActiveSpaceTab(type as 'content-plan' | 'backlog' | 'functionality');
            }}
        />

        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#191919] relative">
            {/* Header */}
            <AppHeaderWithNotifications
              darkMode={state.darkMode}
              currentView={state.currentView}
              activeTable={state.activeTable}
              currentUser={state.currentUser}
              searchQuery={state.searchQuery}
              onToggleDarkMode={actions.toggleDarkMode}
              onSearchChange={actions.setSearchQuery}
              onSearchFocus={() => { if(state.currentView !== 'search') actions.setCurrentView('search'); }}
              onNavigateToInbox={() => actions.setCurrentView('inbox')}
              onOpenSystemChat={() => {
                setChatOpenToSystemFeed(true);
                setChatPanelOpen(true);
              }}
              onOpenSettings={(tab?: string) => { actions.openSettings(tab || 'users'); }}
              onLogout={actions.logout}
              onEditTable={handleOpenEditCurrentTable}
              onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
            />

            {/* Notification Toast */}
            {state.notification && (
                <div className="absolute top-20 right-4 z-50 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-in fade-in slide-in-from-top-2 duration-200">
                    {state.notification}
                </div>
            )}

            {/* Кнопка чата справа внизу — десктоп/планшет, в т.ч. на главной (рабочий стол) */}
            <button
              type="button"
              onClick={() => {
                setChatOpenToSystemFeed(false);
                setChatPanelOpen(true);
              }}
              className="hidden md:flex fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#3337AD] text-white shadow-lg hover:bg-[#292b8a] items-center justify-center"
              title="Чат"
            >
              <MessageCircle size={24} />
            </button>

            {/* Чат в модальном окне (десктоп) */}
            {chatPanelOpen && (
              <div
                className="hidden md:flex fixed inset-0 z-50 items-center justify-center p-3 sm:p-6 bg-black/45 backdrop-blur-md animate-in fade-in duration-200"
                role="dialog"
                aria-modal="true"
                aria-label="Чат"
                onClick={() => setChatPanelOpen(false)}
              >
                <div
                  className="w-full max-w-5xl max-h-[min(720px,92vh)] h-[min(640px,90vh)] flex flex-col rounded-2xl shadow-2xl overflow-hidden bg-white dark:bg-[#252525] border border-gray-200/90 dark:border-[#333]"
                  onClick={e => e.stopPropagation()}
                >
                  <MiniMessenger
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
                        window.dispatchEvent(new CustomEvent('openMeetingFromChat', { detail: { meetingId: meeting.id } }));
                      }, 0);
                      setChatPanelOpen(false);
                    }}
                    onCreateEntity={createEntityFromChat}
                    processTemplates={state.businessProcesses}
                    onStartProcessTemplate={async (processId) => {
                      const selected = state.businessProcesses.find((p) => p.id === processId && !p.isArchived);
                      if (!selected) return null;
                      if (!selected.steps?.length) return null;
                      const firstStep = selected.steps[0];
                      let assigneeId: string | null = null;
                      let assigneeIds: string[] | undefined;
                      if (firstStep.assigneeType === 'position') {
                        const position = state.orgPositions.find((p) => p.id === firstStep.assigneeId);
                        const resolved = resolveAssigneesForOrgPosition(position, state.employeeInfos);
                        assigneeId = resolved.assigneeId;
                        assigneeIds = resolved.assigneeIds;
                        if (resolved.positionPatch && position) {
                          actions.savePosition({ ...position, ...resolved.positionPatch });
                        }
                      } else {
                        assigneeId = firstStep.assigneeId || null;
                      }
                      if (!assigneeId) return null;
                      const instanceId = `inst-${Date.now()}`;
                      const taskId = `task-${Date.now()}`;
                      const now = new Date();
                      const latestVersion =
                        state.businessProcesses
                          .filter((p) => p.id === selected.id)
                          .sort((a, b) => (b.version || 1) - (a.version || 1))[0] || selected;
                      await actions.saveProcess({
                        ...latestVersion,
                        instances: [
                          ...(latestVersion.instances || []),
                          {
                            id: instanceId,
                            processId: latestVersion.id,
                            processVersion: latestVersion.version || 1,
                            currentStepId: firstStep.id,
                            status: 'active',
                            startedAt: now.toISOString(),
                            taskIds: [taskId],
                          },
                        ],
                      });
                      await actions.saveTask({
                        id: taskId,
                        entityType: 'task',
                        tableId: '',
                        title: `${latestVersion.title}: ${firstStep.title}`,
                        description: firstStep.description || '',
                        status: 'Не начато',
                        priority: state.priorities?.[1]?.name || state.priorities?.[0]?.name || 'Средний',
                        assigneeId,
                        assigneeIds,
                        source: 'Процесс',
                        startDate: now.toISOString().slice(0, 10),
                        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                        processId: latestVersion.id,
                        processInstanceId: instanceId,
                        stepId: firstStep.id,
                        createdAt: now.toISOString(),
                        createdByUserId: state.currentUser.id,
                      });
                      return { id: taskId, label: `${latestVersion.title}: ${firstStep.title}` };
                    }}
                    initialOpenSystemFeed={chatOpenToSystemFeed}
                    onConsumedInitialSystemFeed={() => setChatOpenToSystemFeed(false)}
                    onUpdateEntity={async (type, id, patch) => {
                      if (type === 'task') {
                        const current = state.tasks.find((t) => t.id === id);
                        if (!current) return false;
                        await actions.saveTask({ ...current, ...patch });
                        return true;
                      }
                      if (type === 'deal') {
                        const current = state.deals.find((d) => d.id === id);
                        if (!current) return false;
                        await actions.saveDeal({ ...current, ...patch });
                        return true;
                      }
                      if (type === 'meeting') {
                        const current = state.meetings.find((m) => m.id === id);
                        if (!current) return false;
                        await actions.saveMeeting({ ...current, ...patch });
                        return true;
                      }
                      const current = state.docs.find((d) => d.id === id);
                      if (!current) return false;
                      await actions.saveDoc({ ...current, ...patch });
                      return true;
                    }}
                    onClose={() => setChatPanelOpen(false)}
                  />
                </div>
              </div>
            )}

            {/* Main Content Router */}
            <div className="flex-1 min-h-0 overflow-hidden h-full">
            <AppRouter 
                currentView={state.currentView}
                viewMode={state.viewMode}
                activeTable={state.activeTable}
                filteredTasks={state.tasks.filter(t => 
                    state.currentView === 'search' 
                    ? t.title.toLowerCase().includes(state.searchQuery.toLowerCase()) 
                    : true
                )}
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
                notificationPrefs={state.notificationPrefs}
                actions={actions}
            />
            </div>
        </div>

        {/* Modals */}
        {state.isTaskModalOpen && (
            (() => {
                const task = state.editingTask;
                
                // Если задача не определена, показываем обычную модалку задачи
                if (!task) {
                    return (
                        <TaskModal 
                            users={state.users} projects={state.projects} statuses={state.statuses} priorities={state.priorities}
                            currentUser={state.currentUser} tables={state.tables} docs={state.docs} allTasks={state.tasks} onSave={actions.saveTask} onClose={actions.closeTaskModal} 
                            onCreateProject={actions.quickCreateProject} onDelete={actions.deleteTask}
                            onAddComment={actions.addTaskComment} onAddAttachment={actions.addTaskAttachment}
                            onAddDocAttachment={actions.addTaskDocAttachment}
                            task={null}
                        />
                    );
                }
                
                const table = state.tables.find(t => t.id === task.tableId);
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
                        users={state.users} projects={state.projects} statuses={state.statuses} priorities={state.priorities}
                        currentUser={state.currentUser} tables={state.tables} docs={state.docs} allTasks={state.tasks} onSave={actions.saveTask} onClose={actions.closeTaskModal} 
                        onCreateProject={actions.quickCreateProject} onDelete={actions.deleteTask}
                        onAddComment={actions.addTaskComment} onAddAttachment={actions.addTaskAttachment}
                        onAddDocAttachment={actions.addTaskDocAttachment}
                        task={task}
                    />
                );
            })()
        )}

        {state.isDocModalOpen && (
            <DocModal 
                onSave={actions.saveDoc} 
                onClose={actions.closeDocModal}
                folders={state.folders}
                initialFolderId={state.targetFolderId}
                editingDoc={state.editingDoc ? {
                    id: state.editingDoc.id,
                    title: state.editingDoc.title,
                    url: state.editingDoc.url,
                    tags: state.editingDoc.tags,
                    type: state.editingDoc.type,
                    folderId: state.editingDoc.folderId
                } : undefined}
            />
        )}

        {state.isProfileOpen && (
            <ProfileModal user={state.currentUser} onSave={actions.updateProfile} onClose={actions.closeProfile} onOpenSettings={actions.openSettings} onLogout={actions.logout} />
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
             <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={() => actions.closeEditTable()}>
                 <div className="bg-white dark:bg-[#252525] p-6 rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                     <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white">Редактировать страницу</h3>
                     <SettingsModal 
                        users={state.users} projects={state.projects} statuses={state.statuses} priorities={state.priorities} tables={state.tables}
                        initialTab="pages" onClose={actions.closeEditTable}
                        onUpdateTable={actions.updateTable}
                        onCreateTable={() => {}} onDeleteTable={() => {}}
                        onUpdateUsers={() => {}} onUpdateProjects={() => {}} onUpdateStatuses={() => {}} onUpdatePriorities={() => {}}
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
          Для безопасности установите пароль. Можно закрыть и сделать позже — окно не будет повторяться до следующего входа.
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
    </NotificationCenterProvider>
  );
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: unknown }
> {
  declare props: { children: React.ReactNode };
  state: { hasError: boolean; error?: unknown } = { hasError: false };

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    // Keep console output: helps debugging production issues (minified React errors).
    // eslint-disable-next-line no-console
    console.error('App crashed:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-white dark:bg-[#121212] flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] p-6">
          <div className="text-lg font-bold text-gray-900 dark:text-white">Ошибка приложения</div>
          <div className="text-sm text-gray-600 dark:text-gray-300 mt-2">
            Похоже, приложение упало при рендере. Обновите страницу. Если повторяется — пришлите скрин консоли.
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Обновить
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

const App = () => {
  const [publicContentPlanId, setPublicContentPlanId] = useState<string | null>(() => getPublicContentPlanIdFromPath());

  useEffect(() => {
    const sync = () => setPublicContentPlanId(getPublicContentPlanIdFromPath());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  if (publicContentPlanId) {
    return <PublicContentPlanView tableId={publicContentPlanId} />;
  }

  return (
    <AppErrorBoundary>
      <MainApp />
    </AppErrorBoundary>
  );
};

export default App;
