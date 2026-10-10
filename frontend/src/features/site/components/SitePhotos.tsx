import { useTranslation } from 'react-i18next';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import { Icon } from '../../../ui/Icon';
import { useAddPhoto } from '../hooks/useAddPhoto';
import type { PhotoView } from '../SitePresenter';
import { AddPhotoButton } from './AddPhotoButton';
import { SitePhotoStrip } from './SitePhotoStrip';

interface SitePhotosProps {
  readonly site: SiteFeature;
  readonly photos: readonly PhotoView[];
  readonly userLocation: LonLat | null;
}

/** The site's photo carousel, how many photos it has ("3 photos"), and "Add a photo" for one more. */
export function SitePhotos({ site, photos, userLocation }: SitePhotosProps) {
  const { t } = useTranslation();
  const addPhoto = useAddPhoto(site, userLocation);
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
