import { useCallback, useMemo, useState } from 'react';
import { PilotCity } from '../../../domain/PilotCity';
import { SiteBrowse, type BrowseSource } from '../../../domain/SiteBrowse';
import type { SiteFilter } from '../../../domain/SiteFilter';
import { SiteOrder, type SiteSort } from '../../../domain/SiteOrder';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import type { MapView } from '../SiteMap';
import type { useMapSelection } from './useMapSelection';
import { usePilotSites } from './usePilotSites';

export interface BrowserInput {
  readonly loaded: readonly SiteFeature[];
  readonly view: MapView | null;
  readonly filter: SiteFilter;
  readonly position: LonLat | null;
  /** The view finished loading with no site in it (the opening fit wants the pilot city's sites then too). */
  readonly empty: boolean;
  readonly selection: ReturnType<typeof useMapSelection>;
}

export type SiteBrowser = ReturnType<typeof useSiteBrowser>;

// Points that frame the whole pilot city.
const CITY_FRAME: readonly LonLat[] = [
  [PilotCity.bounds.minLon, PilotCity.bounds.minLat],
  [PilotCity.bounds.maxLon, PilotCity.bounds.maxLat],
];

/**
 * The list view: whether it is open, its rows (filtered and sorted), and stepping through them on the map.
 * The rows follow the view until a row is picked; then they stay put, so flying in to a site keeps the list.
 */
export function useSiteBrowser(input: BrowserInput) {
  const { selection, position } = input;
  const [open, setOpen] = useState(false);
  const [frozen, setFrozen] = useState<BrowseSource | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [picked, setSort] = useState<SiteSort | null>(null);
  const pilot = usePilotSites(open || input.empty);
  const sort = picked ?? SiteOrder.defaultFor(position !== null);
  const { source, rows } = useBrowseRows(input, frozen, sort, pilot);
  const { showPlace, openDetails, frame } = selection;
  const show = useCallback((site: SiteFeature) => {
    setChosen(site.properties.site_id);
    showPlace({ sites: [site], point: null });
  }, [showPlace]);
  // A second tap on the row last opened opens its details.
  const choose = (site: SiteFeature) => {
    if (chosen === site.properties.site_id) return openDetails(site);
    setFrozen(source);
    show(site);
  };
  const toggles = useBrowserToggles(setOpen, setFrozen, setChosen);
  const { follow } = toggles;
  // Fits the city's sites (the whole city while they load, or when it has none); the list follows the map there.
  const showCity = useCallback(() => {
    follow();
    frame(pilot && pilot.length > 0 ? pilot.map((site) => site.geometry.coordinates) : CITY_FRAME);
  }, [follow, frame, pilot]);
  const visible = open && !selection.preview && !selection.stack;
  return { open, visible, rows, sort, setSort, chosen, pilot, choose, step: show, showCity, ...toggles };
}

// The source follows the loaded view until frozen; the rows apply the filters and the order to it.
function useBrowseRows(input: BrowserInput, frozen: BrowseSource | null, sort: SiteSort, pilot: readonly SiteFeature[] | null) {
  const { loaded, view, filter, position } = input;
  const live = useMemo(() => SiteBrowse.source(loaded, view?.bbox ?? null), [loaded, view]);
  const source = frozen ?? live;
  const rows = useMemo(
    () => SiteBrowse.rows({ source, loaded, pilot, filter }, sort, position),
    [source, loaded, pilot, filter, sort, position],
  );
  return { source, rows };
}

// Opening starts a fresh list on the view; a move the person makes while the list is up refreshes it.
function useBrowserToggles(
  setOpen: (open: boolean) => void,
  setFrozen: (source: BrowseSource | null) => void,
  setChosen: (id: string | null) => void,
) {
  const start = useCallback(() => {
    setFrozen(null);
    setChosen(null);
    setOpen(true);
  }, [setOpen, setFrozen, setChosen]);
  const close = useCallback(() => setOpen(false), [setOpen]);
  const follow = useCallback(() => setFrozen(null), [setFrozen]);
  return { start, close, follow };
}
