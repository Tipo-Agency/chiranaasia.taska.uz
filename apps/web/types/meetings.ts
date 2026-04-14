export interface MeetingParticipant {
  userId: string;
  role?: string;
}

export interface Meeting {
  id: string;
  tableId: string;
  title: string;
  date: string;
  time: string;
  participantIds: string[];
  participants?: MeetingParticipant[];
  summary: string;
  type: 'client' | 'work' | 'project' | 'shoot';
  dealId?: string;
  clientId?: string;
  projectId?: string;
  shootPlanId?: string;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  isArchived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShootPlanItem {
  postId: string;
  brief?: string;
  referenceUrl?: string;
  referenceImages?: string[];
}

export interface ShootPlan {
  id: string;
  tableId: string;
  title: string;
  date: string;
  time: string;
  participantIds: string[];
  items: ShootPlanItem[];
  meetingId?: string;
  isArchived?: boolean;
}
