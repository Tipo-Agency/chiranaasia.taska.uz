import type { TaskAttachment, TaskComment } from '../types';

/** Стабильное сравнение без JSON.stringify — только то, что нужно для синка модалки задачи */
function shallowCommentsEqual(a: TaskComment[] | undefined, b: TaskComment[] | undefined): boolean {
  const aa = a || [];
  const bb = b || [];
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) {
    const x = aa[i];
    const y = bb[i];
    if (
      x.id !== y.id ||
      x.text !== y.text ||
      x.createdAt !== y.createdAt ||
      x.userId !== y.userId ||
      x.isSystem !== y.isSystem
    ) {
      return false;
    }
  }
  return true;
}

function shallowAttachmentsEqual(a: TaskAttachment[] | undefined, b: TaskAttachment[] | undefined): boolean {
  const aa = a || [];
  const bb = b || [];
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) {
    const x = aa[i];
    const y = bb[i];
    if (
      x.id !== y.id ||
      x.name !== y.name ||
      x.url !== y.url ||
      x.docId !== y.docId ||
      x.uploadedAt !== y.uploadedAt
    ) {
      return false;
    }
  }
  return true;
}

export function shouldSyncEditingTaskFromFresh(fresh: {
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
  status?: string;
  priority?: string;
}, current: {
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
  status?: string;
  priority?: string;
}): boolean {
  return (
    !shallowCommentsEqual(fresh.comments, current.comments) ||
    !shallowAttachmentsEqual(fresh.attachments, current.attachments) ||
    fresh.status !== current.status ||
    fresh.priority !== current.priority
  );
}
