import { create } from 'zustand';

type UiToastState = {
  notification: string | null;
  showNotification: (msg: string) => void;
  clearNotification: () => void;
};

let lastToast: { msg: string; at: number } | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useUiToastStore = create<UiToastState>((set) => ({
  notification: null,
  showNotification: (msg: string) => {
    const now = Date.now();
    if (lastToast && lastToast.msg === msg && now - lastToast.at < 2000) {
      return;
    }
    lastToast = { msg, at: now };
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    set({ notification: msg });
    hideTimer = setTimeout(() => {
      set({ notification: null });
      hideTimer = null;
    }, 4000);
  },
  clearNotification: () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    set({ notification: null });
  },
}));
