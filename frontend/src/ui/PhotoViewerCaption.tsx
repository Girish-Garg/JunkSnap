import { useTranslation } from 'react-i18next';
import { useFormatter } from '../i18n/useFormatter';

/** The date the photo was taken, when known, and the privacy note. */
export function PhotoViewerCaption({ takenAt }: { readonly takenAt: string | null }) {
  const { t } = useTranslation();
  const format = useFormatter();
  return (
    <div className="photo-viewer__caption">
      {takenAt && <p>{t('viewer.taken', { date: format.dateTime(takenAt) })}</p>}
      <p>{t('viewer.blurred')}</p>
    </div>
  );
}
