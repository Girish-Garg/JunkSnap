import type { LonLat } from '../../../domain/Site';
import { SitePreviewCard } from '../../site/components/SitePreviewCard';
import type { MapPageState } from '../hooks/useMapPage';
import { usePreviewSteps } from '../hooks/usePreviewSteps';
import { PreviewStepper } from './PreviewStepper';
import { SiteStackSheet } from './SiteStackSheet';

interface PickedPinProps {
  readonly selection: MapPageState['selection'];
  readonly userLocation: LonLat | null;
  readonly browser: MapPageState['browser'];
  /** Closes the card or list through the history level the map's picks share (usePickLayer), then runs `after`. */
  readonly dismiss: (after?: () => void) => void;
}

/**
 * What a tapped pin opens: the preview card for one site, or the list for a pin that stands for several.
 * Card, list and the area card share one history entry, so back closes whichever is up, and switching between
 * them (a tap on another pin) leaves no stale entry behind. Opened from the site list, the card steps through it.
 */
export function PickedPin({ selection, userLocation, browser, dismiss }: PickedPinProps) {
  const { preview, stack } = selection;
  const { steps, swipe } = usePreviewSteps(browser, preview);
  if (stack) return <SiteStackSheet sites={stack} onOpen={selection.openDetails} dismiss={dismiss} />;
  if (!preview) return null;
  return (
    <div className="preview-swipe" {...swipe}>
      <SitePreviewCard site={preview} userLocation={userLocation} onDetails={selection.openDetails} onClose={() => dismiss()}>
        {steps && <PreviewStepper steps={steps} onStep={browser.step} />}
      </SitePreviewCard>
    </div>
  );
}
