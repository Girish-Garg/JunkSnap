import { useTranslation } from 'react-i18next';
import { PhotoViewer } from '../../../ui/PhotoViewer';
import { usePhotoViewer } from '../../../ui/usePhotoViewer';
import type { PhotoView } from '../SitePresenter';
import { useStripIndex } from '../hooks/useStripIndex';
import { useViewerPhotos } from '../hooks/useViewerPhotos';
import { PhotoStripReport } from './PhotoStripReport';
import { SitePhoto } from './SitePhoto';

interface SitePhotoStripProps {
  readonly photos: readonly PhotoView[];
  /** "Report this photo" on report photos (decision 20261011-0310-hem-photo-flags); absent on a site off the map. */
  readonly onReport?: (photoId: string) => void;
}

/** Every blurred photo of the site in a swipeable strip; tapping one opens the full-screen viewer. No photos, no strip. */
export function SitePhotoStrip({ photos, onReport }: SitePhotoStripProps) {
  const { t } = useTranslation();
  const viewer = usePhotoViewer();
  const strip = useStripIndex(photos.length);
  const { shown, reportAt } = useViewerPhotos(photos, viewer, onReport);
  if (photos.length === 0) return null;
  return (
    <figure className="photo-strip">
      <div className="photo-strip__frame">
        <ul className="photo-strip__list photo-strip__list--swipe" aria-label={t('site.photos')} onScroll={strip.onScroll}>
          {shown.map((photo, index) => (
            <SitePhoto key={photo.url} url={photo.url} alt={photo.alt} warned={photo.warned} onOpen={() => viewer.open(shown, index)} />
          ))}
        </ul>
        {photos.length > 1 && (
          <span className="photo-strip__count" aria-hidden="true">
            {t('viewer.count', { n: strip.index + 1, total: photos.length })}
          </span>
        )}
      </div>
      <figcaption>{t('site.photoNote')}</figcaption>
      {onReport && <PhotoStripReport photos={photos} index={strip.index} onReport={onReport} />}
      <PhotoViewer viewer={viewer} onReport={reportAt} />
    </figure>
  );
}
