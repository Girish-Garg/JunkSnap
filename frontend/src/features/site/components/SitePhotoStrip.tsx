import { useTranslation } from 'react-i18next';
import type { SiteProperties } from '../../../domain/Site';
import { SitePhoto } from './SitePhoto';

interface SitePhotoStripProps {
  readonly site: SiteProperties;
}

export function SitePhotoStrip({ site }: SitePhotoStripProps) {
  const { t } = useTranslation();
  const total = site.photo_urls.length;
  const photos = site.photo_urls.map((url, index) => ({ url, alt: t('site.photoAlt', { n: index + 1, total }) }));
  const cleanup = site.cleanup_photo_url ? [{ url: site.cleanup_photo_url, alt: t('site.afterCleanup') }] : [];
  const all = [...photos, ...cleanup];
  return (
    <figure className="photo-strip">
      <ul className="photo-strip__list" aria-label={t('site.photos')}>
        {all.length === 0 && <SitePhoto url={null} alt="" />}
        {all.map((photo) => (
          <SitePhoto key={photo.url} url={photo.url} alt={photo.alt} />
        ))}
      </ul>
      <figcaption>{t('site.photoNote')}</figcaption>
    </figure>
  );
}
