import { useTranslation } from 'react-i18next';
import '../photo-report.css';
import type { PhotoView } from '../SitePresenter';

interface PhotoStripReportProps {
  readonly photos: readonly PhotoView[];
  /** The photo the strip shows now. */
  readonly index: number;
  readonly onReport: (photoId: string) => void;
}

/** "Report this photo" under the strip, for the photo in view; the after-photo has none. */
export function PhotoStripReport({ photos, index, onReport }: PhotoStripReportProps) {
  const { t } = useTranslation();
  const photoId = photos[index]?.photoId ?? null;
  if (photoId === null) return null;
  const label = photos.length > 1 ? t('photoReport.actionNumbered', { n: index + 1 }) : t('photoReport.action');
  return (
    <button type="button" className="photo-strip__report" onClick={() => onReport(photoId)}>
      {label}
    </button>
  );
}
