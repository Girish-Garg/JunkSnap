import { AREAS_PATH, SNAP_PATH } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { useAuthFlow } from '../../auth/hooks/useAuthFlow';
import type { MapPageState } from './useMapPage';

export interface ThinActions {
  /** Snap, through sign-in when signed out, like the Report button. */
  readonly report: () => void;
  /** The Areas tab, which lists every Jodhpur area even with no reports. */
  readonly areas: () => void;
  /** Widens the map to the nearest sites the app already knows outside the view; null when it knows none. */
  readonly zoomOut: (() => void) | null;
  /** Goes to the pilot city's reports; null while the map is on the city, where Zoom out already leads to them. */
  readonly pilot: (() => void) | null;
}

/** What the few-reports card and the list's note offer. */
export function useThinActions(page: Pick<MapPageState, 'thin' | 'browser' | 'selection' | 'offPilot' | 'showPilot'>): ThinActions {
  const sheets = useSheetNavigation();
  const { requireAuth } = useAuthFlow();
  const { follow } = page.browser;
  const { frame } = page.selection;
  const points = page.thin?.zoomOut ?? [];
  const zoomOut = () => {
    // The list, if it is open, follows the map out.
    follow();
    frame(points);
  };
  return {
    report: () => requireAuth(() => sheets.up(SNAP_PATH)),
    areas: () => sheets.up(AREAS_PATH),
    zoomOut: points.length > 0 ? zoomOut : null,
    pilot: page.offPilot ? page.showPilot : null,
  };
}
