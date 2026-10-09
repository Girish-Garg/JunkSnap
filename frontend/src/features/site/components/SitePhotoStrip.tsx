import { useTranslation } from 'react-i18next';
import type { PhotoView } from '../SitePresenter';
import { SitePhoto } from './SitePhoto';

interface SitePhotoStripProps {
  readonly photos: readonly PhotoView[];
}

export function SitePhotoStrip({ photos }: SitePhotoStripProps) {
  const { t } = useTranslation();
  return (
    <figure className="photo-strip">
      <ul className="photo-strip__list" aria-label={t('site.photos')}>
        {photos.length === 0 && <SitePhoto url={null} alt="" />}
        {photos.map((photo) => (
          <SitePhoto key={photo.url} url={photo.url} alt={t(photo.altKey, photo.altParams)} />
        ))}
      </ul>
      <figcaption>{t('site.photoNote')}</figcaption>
    </figure>
  );
}
