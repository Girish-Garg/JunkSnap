import { useCallback, useState } from 'react';
import type { AreaHit } from '../BoundaryOverlay';

/**
 * Which area a tap picked, for the outline and the area card. A tap on an area picks it (a second tap on the same
 * area lets go); while a pin's preview card or stack list is up, the tap only dismisses that. A pin's card or list
 * replaces the area's, so no hidden area card is left mounted under it.
 */
export function useAreaPick(pinned: boolean, dismiss: () => void) {
  const [picked, setPicked] = useState<AreaHit | null>(null);
  const [seenPinned, setSeenPinned] = useState(pinned);
  if (pinned !== seenPinned) {
    setSeenPinned(pinned);
    if (pinned) setPicked(null);
  }
  const onPickArea = useCallback(
    (area: AreaHit) => {
      if (pinned) dismiss();
      else setPicked((current) => (current?.id === area.id ? null : area));
    },
    [pinned, dismiss],
  );
  const clearArea = useCallback(() => setPicked(null), []);
  return { picked, onPickArea, clearArea };
}
