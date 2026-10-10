import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from './IconButton';
import { PhotoViewerCaption } from './PhotoViewerCaption';
import { PhotoViewerPager } from './PhotoViewerPager';
import { PhotoViewerStage } from './PhotoViewerStage';
import { ESCAPE_LAYER, useEscapeKey } from './useEscapeKey';
import { useFocusTrap } from './useFocusTrap';
import { usePhotoPaging } from './usePhotoPaging';
import type { PhotoViewerControl, PhotoViewerState } from './usePhotoViewer';
import { usePrefetch } from './usePrefetch';

interface PhotoViewerDialogProps {
  readonly state: PhotoViewerState;
  readonly viewer: PhotoViewerControl;
}

/** The open viewer: counter, close, the photo, paging buttons and the caption. */
export function PhotoViewerDialog({ state, viewer }: PhotoViewerDialogProps) {
  const { t } = useTranslation();
  const layer = useRef<HTMLDivElement>(null);
  const { photos, index } = state;
  const paging = usePhotoPaging(index, viewer);
  useEscapeKey(viewer.close, layer);
  useFocusTrap(layer);
  usePrefetch([photos[index - 1]?.url, photos[index + 1]?.url]);
  const photo = photos[index];
  if (!photo) return null;
  const position = { n: index + 1, total: photos.length };
  const escapeLayer = { [ESCAPE_LAYER]: '' };
  return (
    <div ref={layer} className="photo-viewer" role="dialog" aria-modal="true" aria-label={t('viewer.label', position)} {...escapeLayer}>
      <div className="photo-viewer__bar">
        <span className="photo-viewer__count" aria-hidden="true">{t('viewer.count', position)}</span>
        <IconButton icon="close" label={t('viewer.close')} onClick={viewer.close} />
      </div>
      <PhotoViewerStage key={photo.url} photo={photo} onOutcome={paging.onOutcome} />
      <PhotoViewerPager index={index} total={photos.length} onPrevious={paging.previous} onNext={paging.next} />
      <PhotoViewerCaption date={photo.date} />
    </div>
  );
}
