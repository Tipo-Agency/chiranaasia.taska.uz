/**
 * Unified Backend API — использует HTTP API (Python FastAPI).
 * Все импорты api.* остаются без изменений.
 */
import {
  authEndpoint,
  tasksEndpoint,
  projectsEndpoint,
  tablesEndpoint,
  activityEndpoint,
  messagesEndpoint,
  statusesEndpoint,
  prioritiesEndpoint,
  notificationPrefsEndpoint,
  automationEndpoint,
  notificationQueueEndpoint,
  clientsEndpoint,
  contractsEndpoint,
  employeesEndpoint,
  dealsEndpoint,
  oneTimeDealsEndpoint,
  accountsReceivableEndpoint,
  docsEndpoint,
  foldersEndpoint,
  meetingsEndpoint,
  contentPostsEndpoint,
  departmentsEndpoint,
  financeEndpoint,
  bpmEndpoint,
  inventoryEndpoint,
  funnelsEndpoint,
  partnerLogosEndpoint,
  newsEndpoint,
  casesEndpoint,
  tagsEndpoint,
  publicSitesEndpoint,
} from "../services/apiClient";

export const api = {
  users: authEndpoint,

  tasks: tasksEndpoint,
  projects: projectsEndpoint,

  tables: tablesEndpoint,
  activity: activityEndpoint,
  messages: messagesEndpoint,
  statuses: statusesEndpoint,
  priorities: prioritiesEndpoint,
  notificationPrefs: notificationPrefsEndpoint,
  automation: automationEndpoint,
  notificationQueue: notificationQueueEndpoint,

  clients: clientsEndpoint,
  contracts: contractsEndpoint,
  oneTimeDeals: oneTimeDealsEndpoint,
  accountsReceivable: accountsReceivableEndpoint,
  employees: employeesEndpoint,
  deals: dealsEndpoint,

  docs: docsEndpoint,
  folders: foldersEndpoint,
  meetings: meetingsEndpoint,
  contentPosts: contentPostsEndpoint,

  departments: departmentsEndpoint,
  finance: financeEndpoint,
  bpm: bpmEndpoint,
  inventory: inventoryEndpoint,
  funnels: funnelsEndpoint,

  partnerLogos: partnerLogosEndpoint,
  news: newsEndpoint,
  cases: casesEndpoint,
  tags: tagsEndpoint,
  publicSites: publicSitesEndpoint,
};
