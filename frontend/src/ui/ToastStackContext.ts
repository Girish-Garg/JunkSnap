import { createContext } from 'react';
import type { ToastOrder } from './ToastOrder';

export interface ToastStackValue {
  /** The column every toast renders into; null until it has mounted. */
  readonly host: HTMLElement | null;
  readonly order: ToastOrder;
}

/** Null outside a ToastStack: a toast then renders in place, as in a test of one screen. */
export const ToastStackContext = createContext<ToastStackValue | null>(null);
