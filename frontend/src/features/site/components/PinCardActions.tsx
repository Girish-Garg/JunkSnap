import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import { Button } from '../../../ui/Button';
import { Icon, type IconName } from '../../../ui/Icon';
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

/** View site fills the row; Add a photo and Share sit beside it as round 48 px buttons. A blocked tap says why. */
export function PinCardActions({ site, userLocation, onView }: PinCardActionsProps) {
  const { t } = useTranslation();
  const addPhoto = useAddPhoto(site, userLocation);
  const { share, copied } = useShareSite(site);
  const [why, setWhy] = useState<string | null>(null);
  const { availability } = addPhoto;
  const tapAddPhoto = () => (addPhoto.blocked && !availability.enabled ? setWhy(t(availability.reason, availability.params)) : addPhoto.open());
  return (
    <>
      <div className="pin-card__actions">
        <Button onClick={onView}>{t('preview.viewSite')}</Button>
        <RoundButton icon="camera" label={t('addPhoto.action')} onClick={tapAddPhoto} blocked={addPhoto.blocked} />
        <RoundButton icon="share" label={t(copied ? 'actions.copied' : 'actions.share')} onClick={share} />
      </div>
      {why && (
        <p className="pin-card__why" role="status">
          {why}
        </p>
      )}
    </>
  );
}

function RoundButton({ icon, label, onClick, blocked = false }: RoundAction) {
  return (
    <button type="button" className="pin-card__round" aria-label={label} title={label} aria-disabled={blocked || undefined} onClick={onClick}>
      <Icon name={icon} size={22} />
    </button>
  );
}
