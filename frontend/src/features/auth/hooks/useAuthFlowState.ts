import { useCallback, useMemo, useRef, useState } from 'react';
import type { AuthService } from '../../../services/AuthService';
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
  const go = useCallback((step: AuthStep, email?: string, notice?: string) => {
    setState((previous) => ({ step, email: email ?? previous.email, notice: notice ?? null }));
  }, []);
  const close = useCallback(() => {
    pending.current = null;
    setState(CLOSED);
  }, []);
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
    close();
    action?.();
  }, [close]);
  return useMemo(() => ({ ...state, go, close, requireAuth, finish }), [state, go, close, requireAuth, finish]);
}
