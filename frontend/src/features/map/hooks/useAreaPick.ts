import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { areaPath } from '../../../app/paths';
import type { SiteFeature } from '../../../domain/Site';
import type { AreaHit } from '../BoundaryOverlay';

/** A tap on an area opens its page; while a preview card is up, the tap only dismisses the card. */
export function useAreaPick(preview: SiteFeature | null, dismiss: () => void) {
  const navigate = useNavigate();
  return useCallback(
    (area: AreaHit) => {
      if (preview) dismiss();
      else navigate(areaPath(area.kind, area.id));
    },
    [preview, dismiss, navigate],
  );
}
