import type { SiteFeature } from '../../../domain/Site';
import type { AreaHit } from '../BoundaryOverlay';
import { TopLayer } from '../../../ui/TopLayer';
import { DESKTOP_QUERY, useMediaQuery } from '../../../ui/useMediaQuery';

interface TapTargets {
  readonly loaded: readonly SiteFeature[];
  readonly openId: string | null;
  readonly pick: (siteId: string | null) => void;
  readonly openDetails: (site: SiteFeature) => void;
  readonly onPickStack: (siteIds: readonly string[]) => void;
  readonly onPickArea: (area: AreaHit) => void;
}

/**
 * Phones: a tap on the map while a sheet is open closes the topmost sheet (one level, with its animation),
 * like tapping outside any bottom sheet. Desktop keeps the panel open beside the map, so taps pass straight through.
 * A pin picked with a site sheet open (and nothing over it) takes its place, on both: another site's pin opens
 * that site, a stack pin lists its sites (useMapSelection). Over Filters or sign-in the phone's tap closes those.
 */
export function useSheetMapTaps(targets: TapTargets) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const covered = () => !desktop && TopLayer.covering() > 0;
  const overSite = () => targets.openId !== null && TopLayer.covering() === 1;
  const otherSite = (siteId: string | null) =>
    overSite() && siteId !== targets.openId ? targets.loaded.find((item) => item.properties.site_id === siteId) : undefined;
  return {
    onPick: (siteId: string | null) => {
      const site = otherSite(siteId);
      if (site) targets.openDetails(site);
      else if (covered()) TopLayer.dismiss();
      // Desktop: the open site's own pin adds no preview card of the site already in the panel.
      else targets.pick(siteId === targets.openId ? null : siteId);
    },
    onPickStack: (siteIds: readonly string[]) => (covered() && !overSite() ? TopLayer.dismiss() : targets.onPickStack(siteIds)),
    onPickArea: (area: AreaHit) => (covered() ? TopLayer.dismiss() : targets.onPickArea(area)),
  };
}
