import { useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { SiteProperties } from '../../../domain/Site';
import { SITE_GATES, type SiteActionFacts } from '../../../domain/SiteActionGates';
import { SiteListing } from '../../../domain/SiteListing';
import { useActionErrors } from '../../actions/hooks/useActionErrors';
import { useQueue } from '../../snap/hooks/useQueue';
import { useWithdrawFollowup } from './useWithdrawFollowup';

// Error codes with their own plain message; anything else says the withdrawal did not go through.
const KNOWN_ERRORS: ReadonlySet<string> = new Set(['site_verified', 'not_found', 'rate_limited']);

export type WithdrawStage = 'idle' | 'confirm' | 'busy';

/**
 * "Withdraw my report" for this phone's reports on a site nobody has verified yet (decision 20261010-1700).
 * shown: this phone reported the site, so the action makes sense; once ten people verify it, it stays and says why.
 */
export function useWithdraw(site: SiteProperties, facts: SiteActionFacts, onChanged: () => void) {
  const { snap } = useServices();
  const handle = useActionErrors('withdraw', KNOWN_ERRORS);
  const queue = useQueue();
  const mine = SiteListing.mine(queue, site.site_id);
  const followup = useWithdrawFollowup(onChanged);
  const [stage, setStage] = useState<WithdrawStage>('idle');
  const [problem, setProblem] = useState<string | null>(null);
  const send = async () => {
    setStage('busy');
    setProblem(null);
    try {
      await followup(await snap.siteActions.withdraw(site.site_id), mine);
      setStage('idle');
    } catch (error) {
      setProblem(handle(error, () => void send()));
      setStage('confirm');
    }
  };
  const shown = SiteListing.reportedHere(queue, site.site_id).length > 0 && site.status !== 'removed';
  const availability = SITE_GATES.withdraw.decide({ ...facts, site, busy: stage === 'busy' });
  return { shown, availability, stage, problem, ask: () => setStage('confirm'), cancel: () => setStage('idle'), confirm: () => void send() };
}
