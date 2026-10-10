import { useCallback } from 'react';
import { areaPath } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import type { SiteFeature } from '../../../domain/Site';
import type { AreaHit } from '../BoundaryOverlay';

/** A tap on an area opens its page; while a preview card is up, the tap only dismisses the card. */
export function useAreaPick(preview: SiteFeature | null, dismiss: () => void) {
  const sheets = useSheetNavigation();
  return useCallback(
    (area: AreaHit) => {
      if (preview) dismiss();
      else sheets.open(areaPath(area.kind, area.id));
    },
    [preview, dismiss, sheets],
  );
}
