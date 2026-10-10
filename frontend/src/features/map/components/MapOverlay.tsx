import { LanguageToggle } from '../../../ui/LanguageToggle';
import { DESKTOP_QUERY, useMediaQuery } from '../../../ui/useMediaQuery';
import type { MapPageState } from '../hooks/useMapPage';
import { LegendKeys } from '../LegendKeys';
import { BoundaryLegend } from './BoundaryLegend';
import { DesktopActions } from './DesktopActions';
import { FiltersButton } from './FiltersButton';
import { LegendToggle } from './LegendToggle';
import { MapControls } from './MapControls';
import { MapStatus } from './MapStatus';
import { PickedPin } from './PickedPin';
import { SearchBar } from './SearchBar';

interface MapOverlayProps {
  readonly page: MapPageState;
  // The list shows its own status, and search and locate move a map that isn't there.
  readonly listMode: boolean;
}

/** Everything floating over the map: search, filters, status, preview card or stack list, and location. */
export function MapOverlay({ page, listMode }: MapOverlayProps) {
  const { selection, filters, boundary } = page;
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const filtersButton = <FiltersButton activeCount={filters.filter.activeCount()} onOpen={() => filters.setOpen(true)} />;
  return (
    <>
      <div className="search-area">
        {!listMode && <SearchBar sites={page.loaded} onPickPlace={selection.showPlace} />}
        {listMode ? (
          // No search field without the map, but the language stays one tap away.
          <div className="search-area__row">
            {filtersButton}
            <LanguageToggle />
          </div>
        ) : (
          filtersButton
        )}
        {!listMode && <MapStatus notice={page.notice} onNearest={page.showNearest} />}
      </div>
      <PickedPin selection={selection} userLocation={page.location.position} />
      {!listMode && (
        <LegendToggle>
          <BoundaryLegend keys={LegendKeys.of(boundary.view !== null, boundary.markers)} />
        </LegendToggle>
      )}
      {!listMode && <MapControls onLocate={page.location.locate} />}
      {desktop && <DesktopActions />}
    </>
  );
}
