import { DESKTOP_QUERY, useMediaQuery } from '../../../ui/useMediaQuery';
import type { MapPageState } from '../hooks/useMapPage';
import { usePickLayer } from '../hooks/usePickLayer';
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
}

/** Everything floating over the map: search, filters, status, the site list, the pin or area card or stack list, the few-reports card and location. */
export function MapOverlay({ page, listMode }: MapOverlayProps) {
  const { selection, boundary, areaCard } = page;
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const dismiss = usePickLayer(page);
  return (
    <>
      <MapSearchArea page={page} listMode={listMode} desktop={desktop} />
      <PickedPin selection={selection} userLocation={page.location.position} browser={page.browser} dismiss={dismiss} />
      {!listMode && <PickedArea card={areaCard} tints={boundary.tints} dismiss={dismiss} />}
      {!listMode && !desktop && (
        <>
          <SiteBrowserLayer page={page} />
          <ThinMapCard page={page} />
        </>
      )}
      {!listMode && <LegendToggle><BoundaryLegend keys={LegendKeys.of(boundary.view !== null, boundary.markers)} /></LegendToggle>}
      {!listMode && <MapControls onLocate={page.locateMe} />}
      {desktop && <DesktopActions />}
    </>
  );
}
