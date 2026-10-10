import { useState } from 'react';
import { useServices } from '../../../app/useServices';
import { ActionProblem } from '../../site/ActionProblem';
import type { VoteChoice, VoteResult } from '../../../domain/SiteActions';
import { useAuthFlow } from '../../auth/hooks/useAuthFlow';

// Error codes with their own plain message; anything else says the vote did not go through.
const KNOWN_ERRORS: ReadonlySet<string> = new Set(['own_site', 'too_far', 'rate_limited', 'site_rejected', 'already_cleaned', 'not_found']);

const problemOf = (error: unknown) => ActionProblem.of(error, KNOWN_ERRORS);

/** A community vote: sign in first, then send with a fresh GPS fix; onVoted refreshes the site. */
export function useVote(siteId: string, onVoted: () => void) {
  const { snap } = useServices();
  const { requireAuth } = useAuthFlow();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VoteResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const send = async (choice: VoteChoice) => {
    setBusy(true);
    setProblem(null);
    try {
      setResult(await snap.siteActions.vote(siteId, choice));
      onVoted();
    } catch (error) {
      setProblem(problemOf(error));
    } finally {
      setBusy(false);
    }
  };
  return { busy, result, problem, vote: (choice: VoteChoice) => requireAuth(() => void send(choice)) };
}
