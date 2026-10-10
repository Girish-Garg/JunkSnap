import { useMemo } from 'react';
import { addPhotoPath } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { AddPhotoGate, type AddPhotoAvailability } from '../../../domain/AddPhotoGate';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import { SiteDistance } from '../../../domain/SiteDistance';
import { SitePhotoPreset } from '../../../domain/SitePhotoPreset';
import { useAuthFlow } from '../../auth/hooks/useAuthFlow';
import { useAuthUser } from '../../auth/hooks/useAuthUser';
import { SiteClosure } from '../SiteClosure';

export interface AddPhoto {
  readonly availability: AddPhotoAvailability;
  /** Muted but tappable: the tap says why instead of opening Snap. Sign-in is not blocking: the tap opens it. */
  readonly blocked: boolean;
  /** Opens Snap preset to this site, after sign-in when needed; does nothing while blocked. */
  readonly open: () => void;
}

/** "Add a photo" on a site: whether it works now (AddPhotoGate) and how it opens Snap preset to the site. */
export function useAddPhoto(site: SiteFeature, userLocation: LonLat | null): AddPhoto {
  const user = useAuthUser();
  const { requireAuth } = useAuthFlow();
  const sheets = useSheetNavigation();
  const preset = useMemo(() => SitePhotoPreset.of(site), [site]);
  const availability = AddPhotoGate.decide({
    signedIn: user !== null,
    closed: SiteClosure.reasonOf(site.properties) !== null,
    distanceM: SiteDistance.metres(site, userLocation),
    limitM: preset.limitM,
  });
  const blocked = !availability.enabled && availability.remedy !== 'signIn';
  const open = () => {
    if (!blocked) requireAuth(() => sheets.open(addPhotoPath(preset.siteId)));
  };
  return { availability, blocked, open };
}
