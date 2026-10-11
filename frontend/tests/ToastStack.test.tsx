import { act, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ConfirmationAskView } from '../src/domain/ReportConfirmation';
import type { RejectionReason } from '../src/domain/ReportRejection';
import { ToastHost } from '../src/features/actions/components/ToastHost';
import { ConfirmToast } from '../src/features/snap/components/ConfirmToast';
import { RejectionToast } from '../src/features/snap/components/RejectionToast';
import { ToastStack } from '../src/ui/ToastStack';
import { renderApp, testServices } from './helpers';

// The rejection and confirm toasts, raised by hand here instead of by a report's status.
const raised = vi.hoisted(() => {
  type Shown = { readonly reason: RejectionReason | null; readonly ask: ConfirmationAskView | null };
  let shown: Shown = { reason: null, ask: null };
  const listeners = new Set<() => void>();
  return {
    get: () => shown,
    set(next: Partial<Shown>) {
      shown = { ...shown, ...next };
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
});

vi.mock('../src/features/snap/hooks/useRejectionToast', async () => {
  const { useSyncExternalStore } = await import('react');
  const useReason = () => useSyncExternalStore(raised.subscribe, () => raised.get().reason);
  return { useRejectionToast: () => ({ reason: useReason(), dismiss: () => raised.set({ reason: null }) }) };
});

vi.mock('../src/features/snap/hooks/useConfirmToast', async () => {
  const { useSyncExternalStore } = await import('react');
  const useAsk = () => useSyncExternalStore(raised.subscribe, () => raised.get().ask);
  return { useConfirmToast: () => ({ ask: useAsk(), dismiss: () => raised.set({ ask: null }) }) };
});

const ASK: ConfirmationAskView = { reportId: 'rpt_mine', reportType: 'waste_dump', reasoning: null };

async function renderStack() {
  raised.set({ reason: null, ask: null });
  const services = testServices();
  await renderApp(
    <ToastStack>
      <RejectionToast />
      <ConfirmToast />
      <ToastHost />
    </ToastStack>,
    { services },
  );
  const stack = document.querySelector<HTMLElement>('.toast-stack');
  if (!stack) throw new Error('No toast stack');
  return { services, stack };
}

const order = (element: HTMLElement) => Number(element.style.order);
const follows = (first: Node, second: Node) => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('the toast stack', () => {
  it('shows two toasts at once in one column, the newer one after and below the older', async () => {
    const { stack } = await renderStack();
    act(() => raised.set({ reason: 'not_waste' }));
    act(() => raised.set({ ask: ASK }));
    const [rejection, confirm] = screen.getAllByRole('alert');
    expect(rejection).toHaveTextContent("This doesn't look like a waste site.");
    expect(confirm).toHaveTextContent('Answer');
    for (const toast of [rejection!, confirm!]) {
      expect(toast).toBeVisible();
      // A direct child of the one column, which spaces them: neither positions itself over the other.
      expect(toast.parentElement).toBe(stack);
    }
    expect(follows(rejection!, confirm!)).toBe(true);
    expect(order(confirm!)).toBeGreaterThan(order(rejection!));
  });
});

describe('the app toast in the stack', () => {
  it('keeps the app toast live region mounted and puts a new line below an older toast', async () => {
    const { services, stack } = await renderStack();
    const region = screen.getByRole('status');
    expect(region.parentElement).toBe(stack);
    act(() => raised.set({ reason: 'unconfirmed' }));
    act(() => services.notifier.push({ key: 'connection.back' }));
    expect(screen.getByRole('status')).toBe(region);
    expect(region).toHaveTextContent('Back online.');
    const rejection = screen.getByRole('alert');
    expect(rejection.parentElement).toBe(stack);
    expect(order(region)).toBeGreaterThan(order(rejection));
  });
});
