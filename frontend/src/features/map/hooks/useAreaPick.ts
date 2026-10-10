import { useCallback, useState } from 'react';
import type { SiteFeature } from '../../../domain/Site';
import type { AreaHit } from '../BoundaryOverlay';

/**
 * Which area a tap picked, for the outline and the area card. A tap on an area picks it (a second tap on the same
 * area lets go); while a pin's preview card is up, the tap only dismisses that card. A pin's card replaces the area's.
 */
export function useAreaPick(preview: SiteFeature | null, dismiss: () => void) {
  const [picked, setPicked] = useState<AreaHit | null>(null);
  const [seenPreview, setSeenPreview] = useState(preview);
  if (preview !== seenPreview) {
    setSeenPreview(preview);
    if (preview) setPicked(null);
  }
  const onPickArea = useCallback(
    (area: AreaHit) => {
      if (preview) dismiss();
      else setPicked((current) => (current?.id === area.id ? null : area));
    },
    [preview, dismiss],
  );
  const clearArea = useCallback(() => setPicked(null), []);
  return { picked, onPickArea, clearArea };
}
