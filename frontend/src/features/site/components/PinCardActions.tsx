import { useTranslation } from 'react-i18next';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import { Button } from '../../../ui/Button';
import { lookOf } from '../../../domain/ActionAvailability';
import { Icon, type IconName } from '../../../ui/Icon';
import { useSiteGates } from '../../actions/hooks/useSiteGates';
import { useAddPhoto } from '../hooks/useAddPhoto';
import { useShareSite } from '../hooks/useShareSite';

interface PinCardActionsProps {
  readonly site: SiteFeature;
  readonly userLocation: LonLat | null;
  readonly onView: () => void;
}

interface RoundAction {
  readonly icon: IconName;
  readonly label: string;
  readonly onClick: () => void;
  readonly blocked?: boolean;
}

/** View site fills the row; Add a photo and Share sit beside it as round 48 px buttons. A blocked tap says why in a toast. */
export function PinCardActions({ site, userLocation, onView }: PinCardActionsProps) {
  const { t } = useTranslation();
  const gates = useSiteGates(site, userLocation);
  const addPhoto = useAddPhoto(site.properties.site_id, gates.addPhoto);
  const { share, copied } = useShareSite(site);
  return (
    <div className="pin-card__actions">
      <Button onClick={onView}>{t('preview.viewSite')}</Button>
      <RoundButton icon="camera" label={t('addPhoto.action')} onClick={addPhoto.open} blocked={lookOf(addPhoto.action.availability).blocked} />
      <RoundButton icon="share" label={t(copied ? 'actions.copied' : 'actions.share')} onClick={share} />
    </div>
  );
}

function RoundButton({ icon, label, onClick, blocked = false }: RoundAction) {
  return (
    <button type="button" className="pin-card__round" aria-label={label} title={label} aria-disabled={blocked || undefined} onClick={onClick}>
      <Icon name={icon} size={22} />
    </button>
  );
}
