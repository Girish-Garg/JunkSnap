import { useMemo, useState, type ReactNode } from 'react';
import { ToastOrder } from './ToastOrder';
import { ToastStackContext } from './ToastStackContext';
import './toast-stack.css';

/**
 * One column for every app-wide toast, at the top of the screen under the search field. Toasts render into it
 * through ToastSlot and take their place with useToastOrder: a new one below those already up, a card gap apart,
 * never one over another.
 */
export function ToastStack({ children }: { readonly children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [order] = useState(() => new ToastOrder());
  const value = useMemo(() => ({ host, order }), [host, order]);
  return (
    <ToastStackContext.Provider value={value}>
      {children}
      <div ref={setHost} className="toast-stack" />
    </ToastStackContext.Provider>
  );
}
