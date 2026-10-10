import { useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { RemovalKind } from '../../../domain/ActivityRemoval';
import type { QueuedReport } from '../../../domain/QueuedReport';
import type { QueuedScan } from '../../../domain/QueuedScan';
import { ACTIVITY_DELETE_GATE } from '../../../domain/SiteActionGates';
import { useActionErrors } from '../../actions/hooks/useActionErrors';
import { useSessionGate } from '../../actions/hooks/useSessionGate';
import { useAuthFlow } from '../../auth/hooks/useAuthFlow';
import { useActivityDeleteFollowup } from './useActivityDeleteFollowup';

export type ActivityTarget = { readonly report: QueuedReport } | { readonly scan: QueuedScan };

const KNOWN_ERRORS: ReadonlySet<string> = new Set(['rate_limited']);

/** Delete an Activity row: first say what it will do (withdraw, verified stays, or just this phone), then do it. */
export function useActivityDelete(target: ActivityTarget) {
  const { snap } = useServices();
  const { requireAuth } = useAuthFlow();
  const followup = useActivityDeleteFollowup();
  const handle = useActionErrors('withdraw', KNOWN_ERRORS);
  const [plan, setPlan] = useState<RemovalKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const run = async (step: () => Promise<void>, reauthed = false): Promise<void> => {
    setBusy(true);
    setProblem(null);
    try {
      await step();
    } catch (error) {
      setProblem(handle(error, reauthed ? null : () => void run(step, true)));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => followup('report' in target ? await snap.remover.removeReport(target.report) : await snap.remover.removeScan(target.scan));
  // A scan's frames live on the server, so reading them needs sign-in; a photo row knows its status already.
  const ask = 'report' in target
    ? () => setPlan(snap.remover.planReport(target.report))
    : () => requireAuth(() => void run(async () => setPlan(await snap.remover.planScan(target.scan))));
  const confirm = () => (plan === 'withdraw' ? requireAuth(() => void run(remove)) : void run(remove));
  const confirmable = useSessionGate(ACTIVITY_DELETE_GATE, { busy, withdraws: plan === 'withdraw' });
  return { plan, busy, problem, ask, confirmable, cancel: () => setPlan(null), confirm };
}
