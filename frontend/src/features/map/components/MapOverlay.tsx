import { DESKTOP_QUERY, useMediaQuery } from '../../../ui/useMediaQuery';
import { SitePreviewCard } from '../../site/components/SitePreviewCard';
import type { MapPageState } from '../hooks/useMapPage';
import { BoundaryLegend } from './BoundaryLegend';
import { DesktopActions } from './DesktopActions';
import { FiltersButton } from './FiltersButton';
import { LegendToggle } from './LegendToggle';
import { MapControls } from './MapControls';
import { MapStatus } from './MapStatus';
import { SearchBar } from './SearchBar';

interface MapOverlayProps {
  readonly page: MapPageState;
  // The list shows its own status, and search and locate move a map that isn't there.
  readonly listMode: boolean;
}

/** Everything floating over the map: search, filters, status, preview card and location. */
export function MapOverlay({ page, listMode }: MapOverlayProps) {
  const { selection, filters } = page;
  const desktop = useMediaQuery(DESKTOP_QUERY);
  return (
    <>
      <div className="search-area">
        {!listMode && <SearchBar sites={page.loaded} onPickPlace={selection.showPlace} />}
        <FiltersButton activeCount={filters.filter.activeCount()} onOpen={() => filters.setOpen(true)} />
        {!listMode && <MapStatus notice={page.notice} />}
      </div>
      {selection.preview && (
        <SitePreviewCard site={selection.preview} userLocation={page.location.position} onDetails={selection.openDetails} />
      )}
      {!listMode && page.boundary.kind && (
        <LegendToggle>
          <BoundaryLegend kind={page.boundary.kind} wardCoverage={page.boundary.wardCoverage} />
        </LegendToggle>
      )}
      {!listMode && <MapControls onLocate={page.location.locate} boundary={page.boundary} />}
      {desktop && <DesktopActions />}
    </>
  );
}
