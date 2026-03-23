
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
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
import { api } from './backend/api';

interface SystemNotification {
  id: string;
  title: string;
  body: string;
  priority?: string;
  isRead?: boolean;
  createdAt?: string;
}

/** Синхронно из pathname — чтобы не монтировать useAppLogic на публичной странице (избегаем React #310). */
function getPublicContentPlanIdFromPath(): string | null {
  if (typeof window === 'undefined') return null;
  const m = window.location.pathname.match(/^\/content-plan\/(.+)$/);
  return m ? decodeURIComponent(m[1].trim()) : null;
}

function MainApp() {
  const { state, actions } = useAppLogic();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [systemNotifications, setSystemNotifications] = useState<SystemNotification[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  useEffect(() => {
    if (!state.currentUser?.id) return;
    let mounted = true;
    api.notifications
      .list(state.currentUser.id, false, 100)
      .then((list) => {
        if (!mounted) return;
        const typed = (list || []) as SystemNotification[];
        setSystemNotifications(typed);
        setUnreadNotificationsCount(typed.filter((n) => !n.isRead).length);
      })
      .catch(() => {});

    api.notifications
      .unreadCount(state.currentUser.id)
      .then((res) => {
        if (!mounted) return;
        setUnreadNotificationsCount(res.unreadCount || 0);
      })
      .catch(() => {});

    const ws = new WebSocket(api.notifications.wsUrl(state.currentUser.id));
    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data?.type === 'notification.created' && data.notification && mounted) {
          setSystemNotifications((prev) => [
            {
              id: data.notification.id,
              title: data.notification.title,
              body: data.notification.body,
              priority: data.notification.priority,
              isRead: false,
              createdAt: new Date().toISOString(),
            },
            ...prev,
          ]);
          setUnreadNotificationsCount((prev) => prev + 1);
        }
      } catch {
        // ignore malformed ws payload
      }
    };
    const pollId = window.setInterval(() => {
      api.notifications
        .unreadCount(state.currentUser.id)
        .then((res) => {
          if (!mounted) return;
          setUnreadNotificationsCount(res.unreadCount || 0);
        })
        .catch(() => {});
    }, 30000);
    return () => {
      mounted = false;
      window.clearInterval(pollId);
      try {
        ws.close();
      } catch {
        // ignore close errors
      }
    };
  }, [state.currentUser?.id]);

  if (state.isLoading) return <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-[#121212] dark:text-white">Загрузка...</div>;

  if (!state.currentUser) {
    return <LoginView users={state.users} onLogin={user => { actions.login(user); }} />;
  }

  const handleMarkAllNotificationsRead = async () => {
    const unread = systemNotifications.filter((n) => !n.isRead);
    await Promise.all(unread.map((n) => api.notifications.markRead(n.id, true).catch(() => {})));
    setSystemNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadNotificationsCount(0);
  };

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
        entityType: 'task',
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
        title,
        amount: 0,
        currency: 'UZS',
        stage: 'new',
        assigneeId: state.currentUser.id,
        createdAt: nowIso,
      };
      await actions.saveDeal(deal);
      return { id: deal.id, label: deal.title };
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
        type: 'work',
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
    <div 
      className={`flex h-screen w-full transition-colors duration-200 overflow-hidden ${state.darkMode ? 'dark bg-[#191919] text-gray-100' : 'bg-white text-gray-900'}`}
      style={{
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
      }}
    >
        {/* Sidebar */}
        <Sidebar 
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
            unreadCount={unreadNotificationsCount}
            activeSpaceTab={state.activeSpaceTab}
            onNavigateToType={(type) => {
              actions.setCurrentView('spaces');
              actions.setActiveSpaceTab(type as 'content-plan' | 'backlog' | 'functionality');
            }}
        />

        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#191919] relative">
            {/* Header */}
            <AppHeader
              darkMode={state.darkMode}
              currentView={state.currentView}
              activeTable={state.activeTable}
              currentUser={state.currentUser}
              searchQuery={state.searchQuery}
              unreadNotificationsCount={unreadNotificationsCount}
              activityLogs={systemNotifications}
              onToggleDarkMode={actions.toggleDarkMode}
              onSearchChange={actions.setSearchQuery}
              onSearchFocus={() => { if(state.currentView !== 'search') actions.setCurrentView('search'); }}
              onNavigateToInbox={() => actions.setCurrentView('inbox')}
              onMarkAllRead={handleMarkAllNotificationsRead}
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

            {/* Кнопка чата справа внизу — только десктоп и планшет */}
            <button
              type="button"
              onClick={() => setChatPanelOpen(true)}
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
                    onCreateEntity={createEntityFromChat}
                    processTemplates={state.businessProcesses}
                    onStartProcessTemplate={async (processId) => {
                      const selected = state.businessProcesses.find((p) => p.id === processId && !p.isArchived);
                      if (!selected || !selected.steps?.length) return null;
                      const firstStep = selected.steps[0];
                      const assigneeId =
                        firstStep.assigneeType === 'position'
                          ? state.orgPositions.find((p) => p.id === firstStep.assigneeId)?.holderUserId || null
                          : firstStep.assigneeId || null;
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
                searchQuery={state.searchQuery}
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
                inboxMessages={state.inboxMessages}
                outboxMessages={state.outboxMessages}
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
  );
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

  return <MainApp />;
};

export default App;
