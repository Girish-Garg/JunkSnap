import type { MapPageState } from '../hooks/useMapPage';
import { usePilotSearch } from '../hooks/usePilotSearch';
import type { StatusActions } from '../hooks/useStatusActions';
import type { MapNoticeView } from '../MapNotice';
import { GoToMeButton } from './GoToMeButton';
import { MapPills } from './MapPills';
import { MapStatus } from './MapStatus';
import { SearchBar } from './SearchBar';

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

/** The top of the map: search, the pills (MapPills), the status toast with the way back to the reports, and "Go to my location". */
export function MapSearchArea({ page, notice, listMode, desktop, actions }: MapSearchAreaProps) {
  const local = usePilotSearch(page.offPilot);
  const pills = <MapPills page={page} listMode={listMode} desktop={desktop} />;
  // No search field without the map.
  if (listMode) return <div className="search-area">{pills}</div>;
  return (
    <div className="search-area">
      <SearchBar sites={page.loaded} onPickPlace={page.selection.showPlace} local={local} />
      {pills}
      <MapStatus notice={notice} actions={actions} />
      {!desktop && page.away && <GoToMeButton onGo={page.goToMe} />}
    </div>
  );
}
