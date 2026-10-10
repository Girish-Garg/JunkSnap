import { useTranslation } from 'react-i18next';
import { useFormatter } from '../i18n/useFormatter';
import type { PhotoDate } from './ViewerPhoto';

interface PhotoViewerCaptionProps {
  readonly date: PhotoDate | null;
  /** "Report this photo", for a photo residents may report. */
  readonly onReport?: () => void;
}

/** When the photo was taken or reported, if known, the privacy note, and the way to report the photo. */
export function PhotoViewerCaption({ date, onReport }: PhotoViewerCaptionProps) {
  const { t } = useTranslation();
  const format = useFormatter();
  return (
    <div className="photo-viewer__caption">
      {date && <p>{t(`viewer.${date.kind}`, { date: format.dateTime(date.at) })}</p>}
      <p>{t('viewer.blurred')}</p>
      {onReport && (
        <button type="button" className="photo-viewer__report" onClick={onReport}>
          {t('photoReport.action')}
        </button>
      )}
    </div>
  );
}
