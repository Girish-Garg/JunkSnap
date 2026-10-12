import { LanguageToggle } from '../../../ui/LanguageToggle';
import type { MapPageState } from '../hooks/useMapPage';
import { FiltersButton } from './FiltersButton';
import { GoToMeButton } from './GoToMeButton';
import { PlacesButton } from './PlacesButton';
import { ViewToggle } from './ViewToggle';

interface MapPillsProps {
  readonly page: MapPageState;
  // The list fallback has no map to move, so no places and no toggle; the language stays one tap away there.
  readonly listMode: boolean;
  /** Desktop lists the sites in view in its side panel, so it has no map or list toggle. */
  readonly desktop: boolean;
}

/**
 * The row under the search field: Filters, "Places with reports", then the map or list toggle on phones. Desktop
 * has no toggle, and the panel's list starts right under this row, so "Go to my location" sits here instead of on
 * a line of its own over the list.
 */
export function MapPills({ page, listMode, desktop }: MapPillsProps) {
  const { filters, browser } = page;
  const filtersButton = <FiltersButton activeCount={filters.filter.activeCount()} onOpen={() => filters.setOpen(true)} />;
  if (listMode) {
    return (
      <div className="search-area__row">
        {filtersButton}
        <LanguageToggle />
      </div>
    );
  }
  return (
    <div className="search-area__row">
      {filtersButton}
      <PlacesButton />
      {desktop ? page.away && <GoToMeButton onGo={page.goToMe} /> : <ViewToggle listOpen={browser.open} onList={browser.start} />}
    </div>
  );
}
