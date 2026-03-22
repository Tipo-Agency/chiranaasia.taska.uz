
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

  if (state.isLoading) return <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-[#121212] dark:text-white">Загрузка...</div>;

  if (!state.currentUser) {
    return <LoginView users={state.users} onLogin={user => { actions.login(user); }} />;
  }

  const unreadNotifications = state.activityLogs.filter(a => !a.read);

  const handleOpenEditCurrentTable = () => {
      if (state.activeTable) actions.openEditTable(state.activeTable);
  };

  const handleSelectTable = (tableId: string) => {
      actions.setActiveTableId(tableId);
      actions.setCurrentView('table');
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
            unreadCount={unreadNotifications.length}
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
              unreadNotificationsCount={unreadNotifications.length}
              activityLogs={state.activityLogs}
              onToggleDarkMode={actions.toggleDarkMode}
              onSearchChange={actions.setSearchQuery}
              onSearchFocus={() => { if(state.currentView !== 'search') actions.setCurrentView('search'); }}
              onNavigateToInbox={() => actions.setCurrentView('inbox')}
              onMarkAllRead={actions.markAllRead}
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

            {/* Панель чата (выезжает справа) — только когда открыта */}
            {chatPanelOpen && (
              <>
                <div
                  className="hidden md:block fixed inset-0 bg-black/30 z-40"
                  onClick={() => setChatPanelOpen(false)}
                  aria-hidden
                />
                <div className="hidden md:flex fixed top-0 right-0 bottom-0 w-full max-w-md bg-white dark:bg-[#252525] border-l border-gray-200 dark:border-[#333] z-50 flex-col shadow-xl">
                  <MiniMessenger
                    users={state.users}
                    currentUser={state.currentUser}
                    onClose={() => setChatPanelOpen(false)}
                    className="rounded-none border-0 h-full"
                  />
                </div>
              </>
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
