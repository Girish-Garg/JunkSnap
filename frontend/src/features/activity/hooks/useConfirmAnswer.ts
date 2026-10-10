import { useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { ReportStatusView } from '../../../domain/ReportStatus';
import { useAuthFlow } from '../../auth/hooks/useAuthFlow';
import { ActionProblem } from '../../site/ActionProblem';

// Error codes with their own plain message; anything else says the answer did not go through.
const KNOWN_ERRORS: ReadonlySet<string> = new Set(['confirmation_closed', 'rate_limited', 'not_found']);

export interface ConfirmAnswer {
  /** A request is in flight, so both buttons wait. */
  readonly busy: boolean;
  /** Key under confirm.errors.* of the last failure, or null. */
  readonly problem: string | null;
  answer(sure: boolean): void;
}

/** "Yes, I'm sure" or "Withdraw" for a report the check was unsure about (contracts v1.16). */
export function useConfirmAnswer(reportId: string, onAnswered?: (view: ReportStatusView) => void): ConfirmAnswer {
  const { snap } = useServices();
  const { requireAuth } = useAuthFlow();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const send = async (sure: boolean) => {
    setBusy(true);
    setProblem(null);
    try {
      const view = await snap.confirmer.answer(reportId, sure);
      onAnswered?.(view);
    } catch (error) {
      setProblem(ActionProblem.of(error, KNOWN_ERRORS));
    } finally {
      setBusy(false);
    }
  };
  return { busy, problem, answer: (sure) => requireAuth(() => void send(sure)) };
}
