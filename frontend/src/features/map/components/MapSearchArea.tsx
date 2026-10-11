import { LanguageToggle } from '../../../ui/LanguageToggle';
import type { MapPageState } from '../hooks/useMapPage';
import type { StatusActions } from '../hooks/useStatusActions';
import type { MapNoticeView } from '../MapNotice';
import { FiltersButton } from './FiltersButton';
import { GoToMeButton } from './GoToMeButton';
import { MapStatus } from './MapStatus';
import { SearchBar } from './SearchBar';
import { ViewToggle } from './ViewToggle';

interface MapSearchAreaProps {
  readonly page: MapPageState;
  /** The toast: the page's notice, less what the few-reports card already says. */
  readonly notice: MapNoticeView | null;
  // The list shows its own status, and search and locate move a map that isn't there.
  readonly listMode: boolean;
  /** Desktop lists the sites in view in its side panel, so it has no map or list toggle. */
  readonly desktop: boolean;
  /** What the toast's buttons do (useStatusActions). */
  readonly actions: StatusActions;
}

/** The top of the map: search, Filters with the map or list toggle, the status toast and "Go to my location". */
export function MapSearchArea({ page, notice, listMode, desktop, actions }: MapSearchAreaProps) {
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
  const goToMe = page.away ? <GoToMeButton onGo={page.goToMe} /> : null;
  // Desktop has no map or list toggle, and the panel's list starts right under this row, so "Go to my location"
  // sits beside Filters there instead of on a line of its own over the list.
  const beside = desktop ? goToMe : <ViewToggle listOpen={browser.open} onList={browser.start} />;
  return (
    <div className="search-area">
      <SearchBar sites={page.loaded} onPickPlace={page.selection.showPlace} />
      <div className="search-area__row">
        {filtersButton}
        {beside}
      </div>
      <MapStatus notice={notice} actions={actions} />
      {!desktop && goToMe}
    </div>
  );
}
