import { useTranslation } from 'react-i18next';
import type { PhotoViewerControl } from '../../../ui/usePhotoViewer';
import type { ViewerPhoto } from '../../../ui/ViewerPhoto';
import type { PhotoView } from '../SitePresenter';

export interface ViewerPhotos {
  readonly shown: readonly ViewerPhoto[];
  /** Reports the photo at this index from the viewer; undefined where photos cannot be reported. */
  readonly reportAt?: (index: number) => void;
}

/** The strip's photos as the viewer shows them, and "Report this photo" from inside the viewer. */
export function useViewerPhotos(photos: readonly PhotoView[], viewer: PhotoViewerControl, onReport?: (photoId: string) => void): ViewerPhotos {
  const { t } = useTranslation();
  const shown: readonly ViewerPhoto[] = photos.map((photo) => ({
    url: photo.url,
    alt: t(photo.altKey, photo.altParams),
    date: photo.reportedAt ? { kind: 'reported', at: photo.reportedAt } : null,
    warned: photo.warned,
    reportable: onReport !== undefined && photo.photoId !== null,
  }));
  if (!onReport) return { shown };
  // The report sheet opens once the viewer's history entry is gone, so it gets its own.
  const reportAt = (index: number) => {
    const photoId = photos[index]?.photoId;
    if (photoId) viewer.closeThen(() => onReport(photoId));
  };
  return { shown, reportAt };
}
