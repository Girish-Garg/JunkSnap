import { useCallback, useMemo, useRef, useState } from 'react';
import type { AuthService } from '../../../services/AuthService';
import { useHistoryLayer } from '../../../ui/useHistoryLayer';
import type { AuthFlow, AuthStep } from '../AuthFlowContext';

interface FlowState {
  readonly step: AuthStep | null;
  readonly email: string;
  readonly notice: string | null;
}

const CLOSED: FlowState = { step: null, email: '', notice: null };

export function useAuthFlowState(auth: AuthService): AuthFlow {
  const [state, setState] = useState<FlowState>(CLOSED);
  const pending = useRef<(() => void) | null>(null);
  // The sheet has its own history entry, so back closes it; the resumed action runs once that entry is gone.
  const dismiss = useHistoryLayer('auth', state.step !== null, () => setState(CLOSED));
  const go = useCallback((step: AuthStep, email?: string, notice?: string) => {
    setState((previous) => ({ step, email: email ?? previous.email, notice: notice ?? null }));
  }, []);
  const close = useCallback(() => {
    pending.current = null;
    dismiss();
  }, [dismiss]);
  const requireAuth = useCallback(
    (action: () => void) => {
      if (auth.currentUser()) return action();
      pending.current = action;
      setState({ ...CLOSED, step: 'signIn' });
    },
    [auth],
  );
  const finish = useCallback(() => {
    const action = pending.current;
    pending.current = null;
    dismiss(action ?? undefined);
  }, [dismiss]);
  return useMemo(() => ({ ...state, go, close, requireAuth, finish }), [state, go, close, requireAuth, finish]);
}
