import { SitePreviewCard } from '../../site/components/SitePreviewCard';
import type { MapPageState } from '../hooks/useMapPage';
import { FiltersButton } from './FiltersButton';
import { MapControls } from './MapControls';
import { MapStatus } from './MapStatus';
import { SearchBar } from './SearchBar';

interface MapOverlayProps {
  readonly page: MapPageState;
}

/** Everything floating over the map: search, filters, status, preview card and location. */
export function MapOverlay({ page }: MapOverlayProps) {
  const { selection, filters } = page;
  return (
    <>
      <div className="search-area">
        <SearchBar sites={page.loaded} onPickPlace={selection.showPlace} />
        <FiltersButton activeCount={filters.filter.activeCount()} onOpen={() => filters.setOpen(true)} />
        <MapStatus notice={page.notice} />
      </div>
      {selection.preview && (
        <SitePreviewCard site={selection.preview} userLocation={page.location.position} onDetails={selection.openDetails} />
      )}
      <MapControls onLocate={page.location.locate} />
    </>
  );
}
