import { useContext, useMemo } from 'react';
import { ToastStackContext } from './ToastStackContext';

/**
 * The toast's CSS order in the stack: a higher number each time `showing` changes to a new toast, so the newest
 * sits lowest, even in a live region that keeps its place in the DOM. 0 while nothing shows or outside a stack.
 */
export function useToastOrder(showing: number | string | null): number {
  const order = useContext(ToastStackContext)?.order;
  return useMemo(() => (showing === null || !order ? 0 : order.next()), [showing, order]);
}
