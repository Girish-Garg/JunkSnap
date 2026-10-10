import { useTranslation } from 'react-i18next';
import { Icon } from '../../../ui/Icon';
import type { GatedAction } from '../../actions/GatedAction';
import { useAddPhoto } from '../hooks/useAddPhoto';
import type { PhotoView } from '../SitePresenter';
import { AddPhotoButton } from './AddPhotoButton';
import { SitePhotoStrip } from './SitePhotoStrip';

interface SitePhotosProps {
  readonly siteId: string;
  readonly photos: readonly PhotoView[];
  /** SITE_GATES.addPhoto for this site (useSiteGates). */
  readonly addPhoto: GatedAction;
}

/** The site's photo carousel, how many photos it has ("3 photos"), and "Add a photo" for one more. */
export function SitePhotos({ siteId, photos, addPhoto: gated }: SitePhotosProps) {
  const { t } = useTranslation();
  const addPhoto = useAddPhoto(siteId, gated);
  const count = photos.length;
  return (
    <div className="site-photos">
      <SitePhotoStrip photos={photos} />
      <div className="site-photos__bar">
        <span className="site-photos__count">
          <Icon name="photo" size={18} />
          {count > 0 ? t('site.photoCount', { count }) : t('site.noPhotos')}
        </span>
        <AddPhotoButton addPhoto={addPhoto} />
      </div>
    </div>
  );
}
