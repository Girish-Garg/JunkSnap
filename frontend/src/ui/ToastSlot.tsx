import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ToastStackContext } from './ToastStackContext';

/** Puts a toast in the app's ToastStack (a toast shown later lands later in it); outside a stack, in place. */
export function ToastSlot({ children }: { readonly children: ReactNode }) {
  const stack = useContext(ToastStackContext);
  if (!stack) return children;
  return stack.host ? createPortal(children, stack.host) : null;
}
