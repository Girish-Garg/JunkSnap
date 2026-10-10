import { blocked, type Availability, type Blocked } from '../../../domain/ActionAvailability';
import { AreaStanding } from '../../../domain/AreaStanding';
import type { AreaKind } from '../../../domain/AreaScores';
import type { SiteFeature } from '../../../domain/Site';
import { decideAreaLetterRoute, decideSiteRoute, SITE_GATES } from '../../../domain/SiteActionGates';
import { useAreaScores } from '../../areas/hooks/useAreaScores';
import { useSite } from '../../site/hooks/useSite';

/**
 * locked: why the sheet cannot be used; null while the site or area loads, when it is usable, or when it could not
 * load (then the sheet's own button and the api decide).
 */
export interface RouteGate {
  readonly locked: Blocked | null;
}

const lockedBy = (availability: Availability | null): Blocked | null => (availability && !availability.enabled ? availability : null);

export interface SiteRouteGate extends RouteGate {
  readonly site: SiteFeature | null;
  readonly reload: () => void;
}

/** A letter or cleanup sheet opened by link: loads the site and checks SITE_GATES.letter or .cleanup for it. */
export function useSiteRouteGate(siteId: string, action: 'letter' | 'cleanup'): SiteRouteGate {
  const { site, missing, reload } = useSite(siteId);
  if (missing) return { locked: blocked('site.missing'), site, reload };
  return { locked: lockedBy(site ? decideSiteRoute(SITE_GATES[action], site.properties) : null), site, reload };
}

/** An area letter sheet opened by link: loads the area's scores and checks AREA_LETTER_GATE for them. */
export function useAreaLetterRouteGate(kind: AreaKind, areaId: string): RouteGate {
  const { scores, missing } = useAreaScores(kind, areaId);
  if (missing) return { locked: blocked('letter.errors.area_not_found') };
  return { locked: lockedBy(scores ? decideAreaLetterRoute(new AreaStanding(scores).letterReady) : null) };
}
