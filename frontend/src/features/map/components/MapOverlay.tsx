import { DESKTOP_QUERY, useMediaQuery } from '../../../ui/useMediaQuery';
import type { MapPageState } from '../hooks/useMapPage';
import { LegendKeys } from '../LegendKeys';
import { BoundaryLegend } from './BoundaryLegend';
import { DesktopActions } from './DesktopActions';
import { LegendToggle } from './LegendToggle';
import { MapControls } from './MapControls';
import { MapSearchArea } from './MapSearchArea';
import { PickedArea } from './PickedArea';
import { PickedPin } from './PickedPin';
import { SiteBrowserLayer } from './SiteBrowserLayer';

interface MapOverlayProps {
  readonly page: MapPageState;
  // The list shows its own status, and search and locate move a map that isn't there.
  readonly listMode: boolean;
}

/** Everything floating over the map: search, filters, status, the site list, the pin or area card or stack list, and location. */
export function MapOverlay({ page, listMode }: MapOverlayProps) {
  const { selection, boundary, areaCard } = page;
  const desktop = useMediaQuery(DESKTOP_QUERY);
  return (
    <>
      <MapSearchArea page={page} listMode={listMode} desktop={desktop} />
      <PickedPin selection={selection} userLocation={page.location.position} browser={page.browser} />
      {!listMode && <PickedArea card={areaCard} tints={boundary.tints} />}
      {!listMode && !desktop && <SiteBrowserLayer page={page} />}
      {!listMode && <LegendToggle><BoundaryLegend keys={LegendKeys.of(boundary.view !== null, boundary.markers)} /></LegendToggle>}
      {!listMode && <MapControls onLocate={page.locateMe} />}
      {desktop && <DesktopActions />}
    </>
  );
}
