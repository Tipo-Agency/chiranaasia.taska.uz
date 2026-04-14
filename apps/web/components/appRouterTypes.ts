import type {
  Task,
  User,
  Project,
  StatusOption,
  PriorityOption,
  ActivityLog,
  Deal,
  Client,
  Contract,
  EmployeeInfo,
  Meeting,
  ContentPost,
  ShootPlan,
  Doc,
  Folder,
  TableCollection,
  Department,
  FinanceCategory,
  Fund,
  FinancePlan,
  PurchaseRequest,
  FinancialPlanDocument,
  FinancialPlanning,
  OrgPosition,
  BusinessProcess,
  SalesFunnel,
  ViewMode,
  AutomationRule,
  Warehouse,
  InventoryItem,
  StockBalance,
  StockMovement,
  InventoryRevision,
  OneTimeDeal,
  AccountsReceivable,
  Bdr,
  NotificationPreferences,
} from '../types';
import type { AppActions } from '../frontend/hooks/useAppLogic';

export interface AppRouterProps {
  currentView: string;
  /** Строка поиска в шапке (контекст зависит от экрана). */
  searchQuery: string;
  viewMode: ViewMode;
  activeTable?: TableCollection;
  /** Текущая выбранная таблица (spaces / table view). */
  activeTableId: string;
  filteredTasks: Task[];
  allTasks: Task[];
  users: User[];
  currentUser: User;
  projects: Project[];
  statuses: StatusOption[];
  priorities: PriorityOption[];
  activities: ActivityLog[];
  deals: Deal[];
  clients: Client[];
  contracts: Contract[];
  oneTimeDeals?: OneTimeDeal[];
  accountsReceivable?: AccountsReceivable[];
  employeeInfos: EmployeeInfo[];
  meetings: Meeting[];
  contentPosts: ContentPost[];
  shootPlans?: ShootPlan[];
  docs: Doc[];
  folders: Folder[];
  activeDoc?: Doc;
  tables: TableCollection[];
  departments: Department[];
  financeCategories: FinanceCategory[];
  funds: Fund[];
  financePlan: FinancePlan | null;
  purchaseRequests: PurchaseRequest[];
  financialPlanDocuments?: FinancialPlanDocument[];
  financialPlannings?: FinancialPlanning[];
  bdr?: Bdr | null;
  warehouses: Warehouse[];
  inventoryItems: InventoryItem[];
  inventoryBalances: StockBalance[];
  inventoryMovements: StockMovement[];
  inventoryRevisions?: InventoryRevision[];
  orgPositions: OrgPosition[];
  businessProcesses: BusinessProcess[];
  automationRules?: AutomationRule[];
  salesFunnels?: SalesFunnel[];
  settingsActiveTab?: string;
  activeSpaceTab?: 'content-plan' | 'backlog' | 'functionality';
  workdeskTab?: 'dashboard' | 'weekly' | 'tasks' | 'deals' | 'meetings' | 'documents';
  crmHubTab?: 'funnel' | 'chats' | 'clients';
  notificationPrefs?: NotificationPreferences;
  actions: AppActions;
}
