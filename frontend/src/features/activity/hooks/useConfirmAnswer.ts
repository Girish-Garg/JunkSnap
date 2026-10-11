import { useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { ReportStatusView } from '../../../domain/ReportStatus';
import { useActionErrors } from '../../actions/hooks/useActionErrors';
import { useAuthFlow } from '../../auth/hooks/useAuthFlow';

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
  const { snap, errors } = useServices();
  const { requireAuth } = useAuthFlow();
  const handle = useActionErrors('confirm', KNOWN_ERRORS);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // Answered elsewhere or the window passed (409): read the report again, so the question gives way to its status.
  const reread = () => snap.tracker.read(reportId).then((view) => onAnswered?.(view), (error: unknown) => void errors.report('confirm', error));
  const send = async (sure: boolean, reauthed = false) => {
    setBusy(true);
    setProblem(null);
    try {
      const view = await snap.confirmer.answer(reportId, sure);
      onAnswered?.(view);
    } catch (error) {
      const code = handle(error, reauthed ? null : () => void send(sure, true));
      setProblem(code);
      if (code === 'confirmation_closed') void reread();
    } finally {
      setBusy(false);
    }
  };
  return { busy, problem, answer: (sure) => requireAuth(() => void send(sure)) };
}
