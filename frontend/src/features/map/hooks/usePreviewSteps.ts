import type { SiteFeature } from '../../../domain/Site';
import { SiteSteps } from '../../../domain/SiteSteps';
import { useSwipeStep } from '../../../ui/useSwipeStep';
import type { SiteBrowser } from './useSiteBrowser';

type Browser = Pick<SiteBrowser, 'open' | 'rows' | 'step'>;

const NO_SWIPE = {};

// A list of one has nowhere to step, so its card shows no stepper.
function stepsFor(browser: Browser, preview: SiteFeature | null): SiteSteps | null {
  const steps = browser.open && preview ? SiteSteps.at(browser.rows.sites, preview.properties.site_id) : null;
  return steps && steps.total > 1 ? steps : null;
}

// A step to a site, or null at the end of the list (and for a card the list did not open).
function stepTo(site: SiteFeature | null | undefined, step: (site: SiteFeature) => void): (() => void) | null {
  return site ? () => step(site) : null;
}

/**
 * Where the previewed site sits in the open list, and a sideways swipe on its card to step. Null steps (and no
 * swipe) for a card the list did not open: a pin tapped with the list closed, or a site the list does not hold.
 */
export function usePreviewSteps(browser: Browser, preview: SiteFeature | null) {
  const steps = stepsFor(browser, preview);
  const swipe = useSwipeStep(stepTo(steps?.previous(), browser.step), stepTo(steps?.next(), browser.step));
  return { steps, swipe: steps ? swipe : NO_SWIPE };
}
