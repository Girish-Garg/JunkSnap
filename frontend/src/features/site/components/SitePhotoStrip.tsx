import { useTranslation } from 'react-i18next';
import { PhotoViewer } from '../../../ui/PhotoViewer';
import { usePhotoViewer } from '../../../ui/usePhotoViewer';
import type { ViewerPhoto } from '../../../ui/ViewerPhoto';
import type { PhotoView } from '../SitePresenter';
import { useStripIndex } from '../hooks/useStripIndex';
import { SitePhoto } from './SitePhoto';

interface SitePhotoStripProps {
  readonly photos: readonly PhotoView[];
}

/** Every blurred photo of the site in a swipeable strip; tapping one opens the full-screen viewer. No photos, no strip. */
export function SitePhotoStrip({ photos }: SitePhotoStripProps) {
  const { t } = useTranslation();
  const viewer = usePhotoViewer();
  const strip = useStripIndex(photos.length);
  const shown: readonly ViewerPhoto[] = photos.map((photo) => ({
    url: photo.url,
    alt: t(photo.altKey, photo.altParams),
    date: photo.reportedAt ? { kind: 'reported', at: photo.reportedAt } : null,
  }));
  if (photos.length === 0) return null;
  return (
    <figure className="photo-strip">
      <div className="photo-strip__frame">
        <ul className="photo-strip__list photo-strip__list--swipe" aria-label={t('site.photos')} onScroll={strip.onScroll}>
          {shown.map((photo, index) => (
            <SitePhoto key={photo.url} url={photo.url} alt={photo.alt} onOpen={() => viewer.open(shown, index)} />
          ))}
        </ul>
        {photos.length > 1 && (
          <span className="photo-strip__count" aria-hidden="true">
            {t('viewer.count', { n: strip.index + 1, total: photos.length })}
          </span>
        )}
      </div>
      <figcaption>{t('site.photoNote')}</figcaption>
      <PhotoViewer viewer={viewer} />
    </figure>
  );
}
