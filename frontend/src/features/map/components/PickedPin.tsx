import type { LonLat } from '../../../domain/Site';
import { useHistoryLayer } from '../../../ui/useHistoryLayer';
import { SitePreviewCard } from '../../site/components/SitePreviewCard';
import type { MapPageState } from '../hooks/useMapPage';
import { SiteStackSheet } from './SiteStackSheet';

interface PickedPinProps {
  readonly selection: MapPageState['selection'];
  readonly userLocation: LonLat | null;
}

/**
 * What a tapped pin opens: the preview card for one site, or the list for a pin that stands for several.
 * Card and list share one history entry, so back closes whichever is up, and switching between them (a tap
 * on another pin) leaves no stale entry behind.
 */
export function PickedPin({ selection, userLocation }: PickedPinProps) {
  const dismiss = useHistoryLayer('pick', Boolean(selection.stack ?? selection.preview), selection.clearPick);
  if (selection.stack) {
    return <SiteStackSheet sites={selection.stack} onOpen={selection.openDetails} dismiss={dismiss} />;
  }
  if (!selection.preview) return null;
  return (
    <SitePreviewCard site={selection.preview} userLocation={userLocation} onDetails={selection.openDetails} onClose={() => dismiss()} />
  );
}
