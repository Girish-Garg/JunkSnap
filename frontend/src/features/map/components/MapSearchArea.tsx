import { LanguageToggle } from '../../../ui/LanguageToggle';
import type { MapPageState } from '../hooks/useMapPage';
import { FiltersButton } from './FiltersButton';
import { GoToMeButton } from './GoToMeButton';
import { MapStatus } from './MapStatus';
import { SearchBar } from './SearchBar';
import { ViewToggle } from './ViewToggle';

interface MapSearchAreaProps {
  readonly page: MapPageState;
  // The list shows its own status, and search and locate move a map that isn't there.
  readonly listMode: boolean;
  /** Desktop lists the sites in view in its side panel, so it has no map or list toggle. */
  readonly desktop: boolean;
}

/** The top of the map: search, Filters with the map or list toggle, the status toast and "Go to my location". */
export function MapSearchArea({ page, listMode, desktop }: MapSearchAreaProps) {
  const { filters, browser } = page;
  const filtersButton = <FiltersButton activeCount={filters.filter.activeCount()} onOpen={() => filters.setOpen(true)} />;
  if (listMode) {
    return (
      <div className="search-area">
        {/* No search field without the map, but the language stays one tap away. */}
        <div className="search-area__row">
          {filtersButton}
          <LanguageToggle />
        </div>
      </div>
    );
  }
  return (
    <div className="search-area">
      <SearchBar sites={page.loaded} onPickPlace={page.selection.showPlace} />
      {desktop ? (
        filtersButton
      ) : (
        <div className="search-area__row">
          {filtersButton}
          <ViewToggle listOpen={browser.open} onList={browser.start} />
        </div>
      )}
      <MapStatus notice={page.notice} onNearest={page.showNearest} />
      {page.away && <GoToMeButton onGo={page.goToMe} />}
    </div>
  );
}
