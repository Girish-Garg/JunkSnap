import { useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { SiteProperties } from '../../../domain/Site';
import { SiteListing } from '../../../domain/SiteListing';
import { useAuthFlow } from '../../auth/hooks/useAuthFlow';
import { useQueue } from '../../snap/hooks/useQueue';
import { ActionProblem } from '../ActionProblem';
import { useWithdrawFollowup } from './useWithdrawFollowup';

// Error codes with their own plain message; anything else says the withdrawal did not go through.
const KNOWN_ERRORS: ReadonlySet<string> = new Set(['site_verified', 'not_found', 'rate_limited']);

export type WithdrawStage = 'idle' | 'confirm' | 'busy';

/** "Withdraw my report" for this phone's reports on a site nobody has verified yet (decision 20261010-1700). */
export function useWithdraw(site: SiteProperties, onChanged: () => void) {
  const { snap } = useServices();
  const { requireAuth } = useAuthFlow();
  const mine = SiteListing.mine(useQueue(), site.site_id);
  const followup = useWithdrawFollowup(onChanged);
  const [stage, setStage] = useState<WithdrawStage>('idle');
  const [problem, setProblem] = useState<string | null>(null);
  const send = async () => {
    setStage('busy');
    setProblem(null);
    try {
      const result = await snap.siteActions.withdraw(site.site_id);
      await followup(result, mine);
      setStage('idle');
    } catch (error) {
      setProblem(ActionProblem.of(error, KNOWN_ERRORS));
      setStage('confirm');
    }
  };
  const available = SiteListing.canWithdraw(site, mine);
  return { available, stage, problem, ask: () => setStage('confirm'), cancel: () => setStage('idle'), confirm: () => requireAuth(() => void send()) };
}
