import { useCallback } from 'react';
import { addPhotoPath } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import type { GatedAction } from '../../actions/GatedAction';

export interface AddPhoto {
  /** SITE_GATES.addPhoto from useSiteGates: closed, too far (with a fresh fix), offline, sign-in. */
  readonly action: GatedAction;
  /** The tap: opens Snap preset to this site, or says why not (and takes a fresh fix or opens sign-in first). */
  readonly open: () => void;
}

/** "Add a photo" on a site: the tap runs through the site's gate and opens Snap preset to the site. */
export function useAddPhoto(siteId: string, action: GatedAction): AddPhoto {
  const sheets = useSheetNavigation();
  const show = useCallback(() => sheets.open(addPhotoPath(siteId)), [sheets, siteId]);
  return { action, open: action.tap(show) };
}
