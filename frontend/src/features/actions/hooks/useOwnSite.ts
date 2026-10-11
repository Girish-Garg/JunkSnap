import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useServices } from '../../../app/useServices';
import type { SessionFacts } from '../../../domain/GateRules';
import type { SiteActionFacts } from '../../../domain/SiteActionGates';
import { SiteListing } from '../../../domain/SiteListing';
import { ACTIVITY_TTL_MS } from '../../../services/ActivityFreshness';
import type { ActivityState } from '../../../services/ActivitySync';
import { useQueue } from '../../snap/hooks/useQueue';
import { CHECK_LIMIT_MS, useLate } from './useLate';

/**
 * Whether this person reported the site: a report in this phone's list merged into it (the sync of GET /me/reports
 * adds the ones sent from another phone or before a reinstall), or a 403 own_site this session. It is still being
 * checked until the stored rows, the saved sign-in and the first sync for this sign-in are read, but never longer
 * than CHECK_LIMIT_MS after the sheet opens or the sign-in changes; then the api's 403 own_site tells.
 */
export function useOwnSite(siteId: string, session: Pick<SessionFacts, 'signedIn' | 'restoring'>): Pick<SiteActionFacts, 'ownSite' | 'checkingOwner'> {
  const { snap, ownSites } = useServices();
  const rows = useQueue();
  const rowsRead = useSyncExternalStore((listener) => snap.queue.subscribe(listener), () => snap.queue.ready());
  const learned = useSyncExternalStore((listener) => ownSites.subscribe(listener), () => ownSites.sites());
  const sync = useMyReportsSync();
  const late = useLate(CHECK_LIMIT_MS, sync.generation);
  const mine = learned.has(siteId) || SiteListing.reportedHere(rows, siteId).length > 0;
  const reading = !rowsRead || session.restoring === true || (session.signedIn && sync.loading);
  return useMemo(() => ({ ownSite: mine, checkingOwner: !mine && reading && !late }), [mine, reading, late]);
}

// Brings this person's reports from the api (ActivitySync), at most once a minute per sign-in from site sheets and
// pin cards: a fresh list needs no new read for that long, and a failed one is not asked again on every pin tap.
function useMyReportsSync(): ActivityState {
  const { snap, errors, cooldowns } = useServices();
  const state = useSyncExternalStore((listener) => snap.activity.subscribe(listener), () => snap.activity.state());
  useEffect(() => {
    const group = `myReports:${state.generation}`;
    if (cooldowns.active().has(group)) return;
    cooldowns.hold(group, ACTIVITY_TTL_MS);
    void snap.activity.revalidate().catch((error: unknown) => void errors.report('activity', error));
  }, [snap.activity, errors, cooldowns, state.generation]);
  return state;
}
