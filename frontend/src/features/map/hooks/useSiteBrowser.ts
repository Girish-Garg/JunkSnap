import { useCallback, useMemo, useState } from 'react';
import { useConfig } from '../../../app/useConfig';
import { SiteBrowse, type BrowseRows, type BrowseSource } from '../../../domain/SiteBrowse';
import type { SiteFilter } from '../../../domain/SiteFilter';
import { SiteOrder, type SiteSort } from '../../../domain/SiteOrder';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import type { MapView } from '../SiteMap';
import type { useMapSelection } from './useMapSelection';
import type { AroundSites } from './useNearbySites';
import { usePilotSites } from './usePilotSites';

export interface BrowserInput {
  readonly loaded: readonly SiteFeature[];
  readonly view: MapView | null;
  readonly filter: SiteFilter;
  readonly position: LonLat | null;
  /** The opening view is still unsettled and loaded empty, so the opening fit wants the pilot city's sites. */
  readonly openingWants: boolean;
  /** The search around an empty view, which also answers for the city when it takes it all in. */
  readonly around: AroundSites | null;
  readonly selection: ReturnType<typeof useMapSelection>;
}

export type SiteBrowser = ReturnType<typeof useSiteBrowser>;

/**
 * The list view: whether it is open, its rows (filtered and sorted), and stepping through them on the map.
 * The rows follow the view until a row is picked; then they stay put, so flying in to a site keeps the list.
 */
export function useSiteBrowser(input: BrowserInput) {
  const { selection } = input;
  const [open, setOpen] = useState(false);
  const [frozen, setFrozen] = useState<BrowseSource | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [picked, setSort] = useState<SiteSort | null>(null);
  const sort = picked ?? SiteOrder.defaultFor(input.position !== null);
  const { source, rows, pilot } = useBrowseRows(input, frozen, sort, open);
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
  const showCity = useShowCity(toggles.follow, frame, pilot.sites);
  const visible = open && !selection.preview && !selection.stack;
  return { open, visible, rows, sort, setSort, chosen, pilot, choose, step: show, showCity, ...toggles };
}

// The source follows the loaded view until frozen. Only a list with no rows of its own asks for the pilot city.
function useBrowseRows(input: BrowserInput, frozen: BrowseSource | null, sort: SiteSort, open: boolean) {
  const { loaded, view, filter, position } = input;
  const { pilot: city } = useConfig();
  const live = useMemo(() => SiteBrowse.source(loaded, view?.bbox ?? null, city), [loaded, view, city]);
  const source = frozen ?? live;
  const own = useMemo(() => SiteBrowse.own({ source, loaded, filter }, sort, position), [source, loaded, filter, sort, position]);
  const pilot = usePilotSites(input.openingWants || (open && own.length === 0), input.around);
  const rows = useMemo(
    (): BrowseRows => (own.length > 0 ? { sites: own, fallback: false } : { sites: SiteBrowse.city({ pilot: pilot.sites, city, loaded, filter }, sort, position), fallback: true }),
    [own, pilot.sites, city, loaded, filter, sort, position],
  );
  return { source, rows, pilot };
}

// Fits the city's sites (the whole city while they load, or when it has none); the list follows the map there.
function useShowCity(follow: () => void, frame: (points: readonly LonLat[]) => void, pilot: readonly SiteFeature[] | null) {
  const { pilot: city } = useConfig();
  return useCallback(() => {
    follow();
    frame(pilot && pilot.length > 0 ? pilot.map((site) => site.geometry.coordinates) : city.frame());
  }, [follow, frame, pilot, city]);
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
