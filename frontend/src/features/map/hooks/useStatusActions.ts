import type { MapPageState } from './useMapPage';
import { useThinActions } from './useThinActions';

/** What works while the map is slow to load: the site list, Areas and Report. */
export interface MaplessActions {
  readonly list: () => void;
  readonly areas: () => void;
  readonly report: () => void;
}

export interface StatusActions {
  /** Moves to the nearest sites off screen. */
  readonly nearest?: () => void;
  /** Fetches the map's style again after it failed. */
  readonly retryMap?: () => void;
  /** Phones only: desktop keeps its list, Areas and Report on screen beside the map. */
  readonly mapless?: MaplessActions | null;
  /**
   * Goes to the pilot city's reports: set only while the map is away from the city with no site on it. It shows
   * as a chip beside whatever the toast says, or alone when the toast says nothing.
   */
  readonly pilot?: (() => void) | null;
}

type ActionSources = Pick<MapPageState, 'thin' | 'browser' | 'selection' | 'showNearest' | 'offPilot' | 'stranded' | 'showPilot'>;

/** The map toast's buttons: the nearest report, Retry for the map, what works without the map, and the way back to the reports. */
export function useStatusActions(page: ActionSources, retryMap: () => void, phone: boolean): StatusActions {
  const { report, areas } = useThinActions(page);
  const mapless = phone ? { list: page.browser.start, areas, report } : null;
  return { nearest: page.showNearest, retryMap, mapless, pilot: page.stranded ? page.showPilot : null };
}
