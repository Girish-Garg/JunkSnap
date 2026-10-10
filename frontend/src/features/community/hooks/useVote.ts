import { useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { VoteChoice, VoteResult } from '../../../domain/SiteActions';
import { whileBusy, type GatedAction } from '../../actions/GatedAction';
import { useActionErrors } from '../../actions/hooks/useActionErrors';
import { useAuthFlow } from '../../auth/hooks/useAuthFlow';

// Error codes with their own plain message; anything else says the vote did not go through.
const KNOWN_ERRORS: ReadonlySet<string> = new Set(['own_site', 'too_far', 'rate_limited', 'site_rejected', 'already_cleaned', 'not_found', 'location']);

/**
 * A community vote: sign in first, then send with a fresh GPS fix; onVoted refreshes the site.
 * gated: whether this person can vote here (useSiteGates); `action` adds the wait while a vote is on its way.
 */
export function useVote(siteId: string, onVoted: () => void, gated: GatedAction) {
  const { snap } = useServices();
  const { requireAuth } = useAuthFlow();
  const handle = useActionErrors('vote', KNOWN_ERRORS);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VoteResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const send = async (choice: VoteChoice, reauthed = false) => {
    setBusy(true);
    setProblem(null);
    try {
      setResult(await snap.siteActions.vote(siteId, choice));
      onVoted();
    } catch (error) {
      setProblem(handle(error, reauthed ? null : () => void send(choice, true)));
    } finally {
      setBusy(false);
    }
  };
  const vote = (choice: VoteChoice) => requireAuth(() => void send(choice));
  return { busy, result, problem, vote, action: whileBusy(gated, busy) };
}
