import { ThinView } from '../../../domain/ThinView';
import { useHistoryLayer } from '../../../ui/useHistoryLayer';
import type { MapPageState } from '../hooks/useMapPage';
import { useThinActions } from '../hooks/useThinActions';
import { SiteListSheet } from './SiteListSheet';

/**
 * The list view's one history level. It stays open under the preview card while someone steps through the
 * sites on the map, so back from the card returns to the list, and back again to the map.
 */
export function SiteBrowserLayer({ page }: { readonly page: MapPageState }) {
  const { browser, filters } = page;
  const dismiss = useHistoryLayer('list', browser.open, browser.close);
  const actions = useThinActions(page);
  if (!browser.visible) return null;
  const filtersButton = { activeCount: filters.filter.activeCount(), onOpen: () => filters.setOpen(true) };
  const { rows } = browser;
  const thin = ThinView.listShows({ rows: rows.sites.length, fallback: rows.fallback, filtered: filtersButton.activeCount > 0 });
  return <SiteListSheet browser={browser} userLocation={page.location.position} filters={filtersButton} thin={thin ? actions : null} onClose={() => dismiss()} />;
}
