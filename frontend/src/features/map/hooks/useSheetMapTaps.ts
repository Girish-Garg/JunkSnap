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
 * like tapping outside any bottom sheet. A tap on another pin while a site sheet is open opens that site in
 * its place (unless something covers it). Desktop keeps the panel open beside the map, so taps pass straight through.
 */
export function useSheetMapTaps(targets: TapTargets) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const covered = () => !desktop && TopLayer.covering() > 0;
  return {
    onPick: (siteId: string | null) => {
      if (!covered()) return targets.pick(siteId);
      // Only the site sheet alone is swapped; over Filters or sign-in, or on its own pin, the tap closes.
      const swaps = targets.openId !== null && siteId !== targets.openId && TopLayer.covering() === 1;
      const site = swaps ? targets.loaded.find((item) => item.properties.site_id === siteId) : undefined;
      if (site) targets.openDetails(site);
      else TopLayer.dismiss();
    },
    onPickStack: (siteIds: readonly string[]) => (covered() ? TopLayer.dismiss() : targets.onPickStack(siteIds)),
    onPickArea: (area: AreaHit) => (covered() ? TopLayer.dismiss() : targets.onPickArea(area)),
  };
}
