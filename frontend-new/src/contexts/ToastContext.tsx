// @input: Components calling showToast / dismissToast
// @output: Global toast queue + dismiss controls
// @position: App-level context — unified notification system for DU events

import {
  createContext,
  useCallback,
  useContext,
  useReducer,
  type ReactNode,
} from 'react';

export type ToastTone = 'info' | 'success' | 'warn' | 'error';

export interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  body?: string;
}

interface ToastState {
  toasts: ToastItem[];
}

type ToastAction =
  | { type: 'ADD'; toast: ToastItem }
  | { type: 'DISMISS'; id: string };

function reducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'ADD':
      return { toasts: [...state.toasts, action.toast] };
    case 'DISMISS':
      return { toasts: state.toasts.filter((t) => t.id !== action.id) };
  }
}

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const Ctx = createContext<ToastContextValue>({
  toasts: [],
  showToast: () => {},
  dismissToast: () => {},
});

let toastCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { toasts: [] });

  const showToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `toast-${++toastCounter}`;
    dispatch({ type: 'ADD', toast: { ...toast, id } });
    setTimeout(() => dispatch({ type: 'DISMISS', id }), 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    dispatch({ type: 'DISMISS', id });
  }, []);

  return (
    <Ctx.Provider value={{ toasts: state.toasts, showToast, dismissToast }}>
      {children}
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
