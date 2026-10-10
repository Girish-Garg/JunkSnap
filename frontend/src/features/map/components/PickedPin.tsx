import type { LonLat } from '../../../domain/Site';
import { SitePreviewCard } from '../../site/components/SitePreviewCard';
import type { MapPageState } from '../hooks/useMapPage';
import { SiteStackSheet } from './SiteStackSheet';

interface PickedPinProps {
  readonly selection: MapPageState['selection'];
  readonly userLocation: LonLat | null;
}

/** What a tapped pin opens: the preview card for one site, or the list for a pin that stands for several. */
export function PickedPin({ selection, userLocation }: PickedPinProps) {
  if (selection.stack) {
    return <SiteStackSheet sites={selection.stack} onOpen={selection.openDetails} onClose={selection.closeStack} />;
  }
  if (!selection.preview) return null;
  return <SitePreviewCard site={selection.preview} userLocation={userLocation} onDetails={selection.openDetails} />;
}
