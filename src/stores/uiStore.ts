import { create } from 'zustand';

export interface ConfirmOptions {
  titleKey: string;
  messageKey?: string;
  confirmKey?: string;
  danger?: boolean;
}

export interface Snackbar {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface UiState {
  snackbar: Snackbar | null;
  confirmRequest: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
  showSnackbar: (message: string, action?: { label: string; onAction: () => void }) => void;
  dismissSnackbar: () => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  resolveConfirm: (ok: boolean) => void;
}

let snackbarSeq = 0;
let snackbarTimer: ReturnType<typeof setTimeout> | undefined;

export const useUiStore = create<UiState>()((set, get) => ({
  snackbar: null,
  confirmRequest: null,
  showSnackbar: (message, action) => {
    if (snackbarTimer) clearTimeout(snackbarTimer);
    const snackbar: Snackbar = { id: ++snackbarSeq, message, ...action };
    set({ snackbar });
    snackbarTimer = setTimeout(() => {
      if (get().snackbar?.id === snackbar.id) set({ snackbar: null });
    }, 6000);
  },
  dismissSnackbar: () => {
    if (snackbarTimer) clearTimeout(snackbarTimer);
    set({ snackbar: null });
  },
  confirm: (options) =>
    new Promise<boolean>((resolve) => {
      // Supersede any pending dialog.
      get().confirmRequest?.resolve(false);
      set({ confirmRequest: { ...options, resolve } });
    }),
  resolveConfirm: (ok) => {
    const request = get().confirmRequest;
    if (request) {
      set({ confirmRequest: null });
      request.resolve(ok);
    }
  },
}));
