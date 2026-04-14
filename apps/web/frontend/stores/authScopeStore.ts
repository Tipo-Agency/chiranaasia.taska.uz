import { create } from 'zustand';

/** Минимальный снимок сессии для компонентов вне useAppLogic (фаза L архитектуры). */
type AuthScopeState = {
  currentUserId: string | null;
  setCurrentUserId: (id: string | null) => void;
};

export const useAuthScopeStore = create<AuthScopeState>((set) => ({
  currentUserId: null,
  setCurrentUserId: (id) => set({ currentUserId: id }),
}));
