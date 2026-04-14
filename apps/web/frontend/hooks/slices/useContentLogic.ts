
import { useState } from 'react';
import { Doc, Folder, Meeting, ContentPost, ShootPlan } from '../../../types';
import { api } from '../../../backend/api';
import { getTodayLocalDate, normalizeDateForInput, normalizeWallClockTimeForApi } from '../../../utils/dateUtils';

function meetingToApiBody(m: Meeting): Record<string, unknown> {
  const dateNorm = normalizeDateForInput(m.date) || (m.date || '').trim();
  const date =
    dateNorm && /^\d{4}-\d{2}-\d{2}$/.test(dateNorm) ? dateNorm : getTodayLocalDate();
  const body: Record<string, unknown> = {
    tableId: m.tableId?.trim() ? m.tableId.trim() : null,
    title: m.title,
    date,
    time: normalizeWallClockTimeForApi(m.time),
    participantIds: m.participantIds ?? [],
    summary: m.summary ?? '',
    type: m.type,
    recurrence: m.recurrence ?? 'none',
    isArchived: m.isArchived ?? false,
  };
  if (m.dealId) body.dealId = m.dealId;
  if (m.clientId) body.clientId = m.clientId;
  if (m.projectId) body.projectId = m.projectId;
  if (m.shootPlanId) body.shootPlanId = m.shootPlanId;
  if (m.participants?.length) body.participants = m.participants;
  return body;
}

/** Слить ответ POST/PATCH встречи с черновиком UI (обязательные поля Meeting). */
function mergeSavedMeeting(draft: Meeting, saved: Meeting): Meeting {
  const date =
    normalizeDateForInput(saved.date) || saved.date || normalizeDateForInput(draft.date) || draft.date;
  const time = normalizeWallClockTimeForApi(saved.time || draft.time);
  return {
    ...draft,
    ...saved,
    id: saved.id || draft.id,
    tableId: (saved.tableId || draft.tableId) as string,
    title: (saved.title ?? draft.title) as string,
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(date)) ? String(date) : getTodayLocalDate(),
    time,
    participantIds: saved.participantIds?.length ? saved.participantIds : draft.participantIds,
    summary: saved.summary ?? draft.summary ?? '',
    type: (saved.type || draft.type) as Meeting['type'],
    recurrence: (saved.recurrence ?? draft.recurrence ?? 'none') as Meeting['recurrence'],
    dealId: saved.dealId ?? draft.dealId,
    clientId: saved.clientId ?? draft.clientId,
    projectId: saved.projectId ?? draft.projectId,
    shootPlanId: saved.shootPlanId ?? draft.shootPlanId,
    isArchived: saved.isArchived ?? draft.isArchived,
    participants: saved.participants ?? draft.participants,
    createdAt: draft.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

export const useContentLogic = (showNotification: (msg: string) => void, activeTableId: string) => {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [contentPosts, setContentPosts] = useState<ContentPost[]>([]);
  const [shootPlans, setShootPlans] = useState<ShootPlan[]>([]);
  
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [targetFolderId, setTargetFolderId] = useState<string | undefined>(undefined);
  const [activeDocId, setActiveDocId] = useState<string>('');
  const [editingDoc, setEditingDoc] = useState<Doc | null>(null);

  // Meetings
  const saveMeeting = (m: Meeting) => {
    const now = new Date().toISOString();
    const existing = meetings.find((meeting) => meeting.id === m.id);
    const prevSnapshot = meetings;
    const optimisticDraft: Meeting = {
      ...m,
      createdAt: m.createdAt || now,
      updatedAt: now,
    };
    const u = existing
      ? meetings.map((meeting) => (meeting.id === m.id ? optimisticDraft : meeting))
      : [...meetings, optimisticDraft];
    setMeetings(u);
    const body = meetingToApiBody(m);
    const req = existing ? api.meetings.patch(m.id, body) : api.meetings.create({ ...body, id: m.id });
    req
      .then((savedRaw) => {
        const saved = savedRaw as Meeting;
        const merged = mergeSavedMeeting(optimisticDraft, saved);
        setMeetings((curr) => {
          const has = curr.some((x) => x.id === merged.id);
          if (has) return curr.map((x) => (x.id === merged.id ? merged : x));
          return [...curr, merged];
        });
        showNotification(existing ? 'Встреча обновлена' : 'Встреча добавлена');
        void api.meetings.getAll().then((raw) => {
          if (Array.isArray(raw)) setMeetings(raw as Meeting[]);
        });
      })
      .catch(() => {
        setMeetings(prevSnapshot);
        showNotification('Ошибка сохранения встречи');
      });
  };
  const deleteMeeting = (id: string) => {
    const prev = meetings;
    const now = new Date().toISOString();
    const u = meetings.map((m) =>
      m.id === id ? { ...m, isArchived: true, updatedAt: now } : { ...m, updatedAt: m.updatedAt || now }
    );
    setMeetings(u);
    api.meetings
      .remove(id)
      .then(() => {
        void api.meetings.getAll().then((raw) => {
          if (Array.isArray(raw)) setMeetings(raw as Meeting[]);
        });
      })
      .catch(() => {
        setMeetings(prev);
        showNotification('Ошибка удаления встречи');
      });
    showNotification('Встреча удалена');
  };
  const updateMeetingSummary = (id: string, summary: string) => {
    const prevSnapshot = meetings;
    const now = new Date().toISOString();
    const u = meetings.map((m) => (m.id === id ? { ...m, summary, updatedAt: now } : m));
    setMeetings(u);
    api.meetings
      .patch(id, { summary })
      .then((savedRaw) => {
        const saved = savedRaw as Meeting;
        const base = prevSnapshot.find((x) => x.id === id);
        if (base) {
          const merged = mergeSavedMeeting({ ...base, summary }, saved);
          setMeetings((curr) => curr.map((x) => (x.id === id ? merged : x)));
        }
        void api.meetings.getAll().then((raw) => {
          if (Array.isArray(raw)) setMeetings(raw as Meeting[]);
        });
      })
      .catch(() => {
        setMeetings(prevSnapshot);
        showNotification('Ошибка сохранения встречи');
      });
  };

  // Content Plan
  const savePost = (p: ContentPost) => {
      const updated = contentPosts.find(x => x.id === p.id) ? contentPosts.map(x => x.id === p.id ? p : x) : [...contentPosts, p];
      setContentPosts(updated);
      api.contentPosts.updateAll(updated).catch(() => showNotification('Ошибка сохранения поста'));
      showNotification('Пост сохранен');
  };
  const deletePost = (id: string) => { 
      const now = new Date().toISOString();
      const u = contentPosts.map(p => 
          p.id === id 
              ? { ...p, isArchived: true, updatedAt: now } 
              : { ...p, updatedAt: p.updatedAt || now }
      ); 
      setContentPosts(u);
      api.contentPosts.updateAll(u).catch(() => showNotification('Ошибка удаления поста'));
      showNotification('Пост удален'); 
  };

  const saveShootPlan = (plan: ShootPlan) => {
    const existing = shootPlans.find((p) => p.id === plan.id);
    const next = existing
      ? shootPlans.map((p) => (p.id === plan.id ? { ...plan } : p))
      : [...shootPlans, { ...plan }];
    setShootPlans(next);
    api.shootPlans
      .updateAll(next)
      .then(() => api.meetings.getAll())
      .then((raw) => {
        setMeetings(raw as Meeting[]);
        showNotification(existing ? 'План съёмки сохранён' : 'План съёмки создан');
      })
      .catch(() => showNotification('Ошибка сохранения плана съёмки'));
  };

  const deleteShootPlan = (id: string) => {
    const next = shootPlans.map((p) =>
      p.id === id ? { ...p, isArchived: true } : p
    );
    setShootPlans(next);
    api.shootPlans
      .updateAll(next)
      .then(() => api.meetings.getAll())
      .then((raw) => {
        setMeetings(raw as Meeting[]);
        showNotification('План съёмки в архиве');
      })
      .catch(() => showNotification('Ошибка архивации плана'));
  };

  // Docs
  const saveDoc = (docData: any, tableId?: string, folderId?: string) => {
      // Для документов не требуется tableId - используем системную таблицу docs или пустую строку
      // tableId используется только для фильтрации при показе, но не обязателен для создания
      const targetTableId = tableId || activeTableId || '';
      // Используем folderId из параметра, если передан, иначе из targetFolderId
      const finalFolderId = folderId !== undefined ? folderId : targetFolderId;
      
      if (!docData || !docData.title || !docData.title.trim()) {
          showNotification('Введите название документа');
          return;
      }
      
      // Если есть id, значит это редактирование
      if (docData.id) {
          const existingDoc = docs.find(d => d.id === docData.id);
          if (existingDoc) {
              const updatedDoc: Doc = {
                  ...existingDoc,
                  title: docData.title.trim(),
                  url: docData.url,
                  tags: docData.tags || [],
                  type: docData.type || existingDoc.type,
                  folderId: finalFolderId
              };
              const updatedDocs = docs.map(d => d.id === docData.id ? updatedDoc : d);
              setDocs(updatedDocs);
              api.docs.updateAll(updatedDocs).catch(() => showNotification('Ошибка сохранения документа'));
              setIsDocModalOpen(false);
              setTargetFolderId(undefined);
              showNotification('Документ обновлен');
              return updatedDoc;
          }
      }
      
      // Создание нового документа
      const newDoc: Doc = { 
          id: `d-${Date.now()}`, 
          tableId: targetTableId, 
          folderId: finalFolderId,
          title: docData.title.trim(), 
          url: docData.url, 
          content: '', 
          tags: docData.tags || [], 
          type: docData.type || 'link'
      };
      const newDocs = [...docs, newDoc];
      setDocs(newDocs);
      api.docs.updateAll(newDocs).catch(() => showNotification('Ошибка сохранения документа')); 
      setIsDocModalOpen(false);
      setTargetFolderId(undefined); // Сброс после создания
      showNotification('Документ добавлен');
      return newDoc;
  };
  const saveDocContent = (id: string, content: string, title: string) => { 
    const now = new Date().toISOString();
    const u = docs.map(d => d.id === id ? { ...d, content, title, updatedAt: now } : d);
    setDocs(u);
    api.docs.updateAll(u).catch(() => showNotification('Ошибка сохранения документа'));
    showNotification('Сохранено'); 
  };
  const deleteDoc = (id: string) => { 
    const now = new Date().toISOString();
    // Мягкое удаление: помечаем документ как архивный
    const u = docs.map(d => {
      if (d.id === id) {
        return { ...d, isArchived: true, updatedAt: now };
      }
      return { ...d, updatedAt: d.updatedAt || now };
    });
    setDocs(u);
    api.docs.updateAll(u).catch(() => showNotification('Ошибка удаления документа'));
    showNotification('Документ удален'); 
  };

  // Folders
  const createFolder = (name: string, tableId?: string, parentFolderId?: string) => {
      // Для папок не требуется tableId - используем системную таблицу docs или пустую строку
      const targetTableId = tableId || activeTableId || '';
      
      if (!name || !name.trim()) {
          showNotification('Введите название папки');
          return;
      }
      const newFolder: Folder = { 
          id: `f-${Date.now()}`, 
          tableId: targetTableId, 
          name: name.trim(),
          parentFolderId: parentFolderId
      };
      const u = [...folders, newFolder];
      setFolders(u);
      api.folders.updateAll(u).catch(() => showNotification('Ошибка создания папки'));
      showNotification('Папка создана');
  };
  const deleteFolder = (id: string) => { 
      const now = new Date().toISOString();
      // Мягкое удаление: помечаем папку как архивную
      const u = folders.map(f => {
        if (f.id === id) {
          return { ...f, isArchived: true, updatedAt: now };
        }
        return { ...f, updatedAt: f.updatedAt || now };
      });
      setFolders(u);
      api.folders.updateAll(u).catch(() => showNotification('Ошибка удаления папки'));
      showNotification('Папка удалена'); 
  };

  const updateFolder = (patch: Folder) => {
      if (!patch.id || !patch.name?.trim()) {
          showNotification('Введите название папки');
          return;
      }
      const u = folders.map(f =>
          f.id === patch.id
              ? { ...f, ...patch, name: patch.name.trim() }
              : f
      );
      setFolders(u);
      api.folders.updateAll(u).catch(() => showNotification('Ошибка сохранения папки'));
      showNotification('Папка обновлена');
  };

  const handleDocClick = (doc: Doc) => {
      if (doc.type === 'link' && doc.url) window.open(doc.url, '_blank');
      else { setActiveDocId(doc.id); return 'doc-editor'; }
      return null;
  };

  return {
    state: { docs, folders, meetings, contentPosts, shootPlans, isDocModalOpen, activeDocId, targetFolderId, editingDoc },
    setters: { setDocs, setFolders, setMeetings, setContentPosts, setShootPlans, setActiveDocId },
    actions: { 
        saveMeeting, deleteMeeting, updateMeetingSummary, savePost, deletePost, saveShootPlan, deleteShootPlan,
        saveDoc, saveDocContent, deleteDoc, createFolder, deleteFolder, updateFolder, handleDocClick,
        openDocModal: (folderId?: string) => { setTargetFolderId(folderId); setEditingDoc(null); setIsDocModalOpen(true); },
        openEditDocModal: (doc: Doc) => { setEditingDoc(doc); setTargetFolderId(doc.folderId); setIsDocModalOpen(true); },
        closeDocModal: () => { setIsDocModalOpen(false); setTargetFolderId(undefined); setEditingDoc(null); }
    }
  };
};
