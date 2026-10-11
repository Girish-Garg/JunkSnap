import { DESKTOP_QUERY, useMediaQuery } from '../../../ui/useMediaQuery';
import type { MapPageState } from '../hooks/useMapPage';
import { usePickLayer } from '../hooks/usePickLayer';
import { useStatusActions } from '../hooks/useStatusActions';
import { useThinCard } from '../hooks/useThinCard';
import { LegendKeys } from '../LegendKeys';
import { BoundaryLegend } from './BoundaryLegend';
import { DesktopActions } from './DesktopActions';
import { LegendToggle } from './LegendToggle';
import { MapControls } from './MapControls';
import { MapSearchArea } from './MapSearchArea';
import { PickedArea } from './PickedArea';
import { PickedPin } from './PickedPin';
import { SiteBrowserLayer } from './SiteBrowserLayer';
import { ThinMapCard } from './ThinMapCard';

interface MapOverlayProps {
  readonly page: MapPageState;
  // The list shows its own status, and search and locate move a map that isn't there.
  readonly listMode: boolean;
  /** Fetches the map's style again after it failed to load (useBasemapStatus). */
  readonly onRetryMap: () => void;
}

/** Everything floating over the map: search, filters, status, the site list, the pin or area card or stack list, the few-reports card and location. */
export function MapOverlay({ page, listMode, onRetryMap }: MapOverlayProps) {
  const { selection, boundary, areaCard } = page;
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const dismiss = usePickLayer(page);
  const phone = !listMode && !desktop;
  // The card and the toast are decided together, so "no reports here" is said once.
  const thin = useThinCard(page, phone);
  const actions = useStatusActions(page, onRetryMap, phone);
  return (
    <>
      <MapSearchArea page={page} notice={thin.notice} listMode={listMode} desktop={desktop} actions={actions} />
      <PickedPin selection={selection} userLocation={page.location.position} browser={page.browser} dismiss={dismiss} />
      {!listMode && <PickedArea card={areaCard} tints={boundary.tints} dismiss={dismiss} />}
      {phone && (
        <>
          <SiteBrowserLayer page={page} />
          <ThinMapCard page={page} card={thin} />
        </>
      )}
      {!listMode && <LegendToggle><BoundaryLegend keys={LegendKeys.of(boundary.view !== null, boundary.markers)} /></LegendToggle>}
      {!listMode && <MapControls onLocate={page.locateMe} />}
      {desktop && <DesktopActions />}
    </>
  );
}
