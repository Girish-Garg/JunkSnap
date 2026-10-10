import { useCallback, useEffect, useState } from 'react';
import { useServices } from '../../../app/useServices';
import { PilotCity } from '../../../domain/PilotCity';
import type { SiteFeature } from '../../../domain/Site';
import type { AroundSites } from './useNearbySites';

interface Loaded {
  readonly sites: readonly SiteFeature[] | null;
  readonly failed: boolean;
}

export interface PilotLoad {
  /** Every site of the pilot city on the active map, or null while loading, not yet wanted, or failed. */
  readonly sites: readonly SiteFeature[] | null;
  readonly failed: boolean;
  /** Asks again after a failed load. */
  readonly retry: () => void;
}

// The search around the view, when it took in the whole city and did not fail.
function sharedFrom(around: AroundSites | null): AroundSites | null {
  return around && !around.failed && PilotCity.within(around.box) ? around : null;
}

// The shared answer to keep: the city's part of it, once it is in and nothing better is kept.
function adopt(wanted: boolean, loaded: Loaded | null, shared: AroundSites | null): Loaded | null {
  if (!wanted || loaded?.sites || !shared?.sites) return null;
  return { sites: PilotCity.sitesOf(shared.sites), failed: false };
}

/**
 * The pilot city's sites, only while `wanted` (an unsettled empty opening view, or the list with no rows of its own),
 * then kept. When the search around an empty view already takes in the whole city, its answer is used and no second
 * request goes out; otherwise one GET /sites over the city's bounds.
 */
export function usePilotSites(wanted: boolean, around: AroundSites | null): PilotLoad {
  const { api } = useServices();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);
  const shared = sharedFrom(around);
  const adopted = adopt(wanted, loaded, shared);
  if (adopted) setLoaded(adopted);
  const need = wanted && loaded === null && shared === null;
  useEffect(() => {
    if (!need) return undefined;
    let current = true;
    api.listSites(PilotCity.bounds).then(
      (found) => current && setLoaded({ sites: PilotCity.sitesOf(found), failed: false }),
      (error: unknown) => {
        console.error('Could not load the pilot city sites', error);
        if (current) setLoaded({ sites: null, failed: true });
      },
    );
    return () => {
      current = false;
    };
  }, [api, need, attempt]);
  const retry = useCallback(() => {
    setLoaded(null);
    setAttempt((count) => count + 1);
  }, []);
  return { sites: loaded?.sites ?? null, failed: Boolean(loaded?.failed), retry };
}
