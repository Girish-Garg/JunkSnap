import { useTranslation } from 'react-i18next';
import { useFormatter } from '../i18n/useFormatter';
import type { PhotoDate } from './ViewerPhoto';

/** When the photo was taken or reported, if known, and the privacy note. */
export function PhotoViewerCaption({ date }: { readonly date: PhotoDate | null }) {
  const { t } = useTranslation();
  const format = useFormatter();
  return (
    <div className="photo-viewer__caption">
      {date && <p>{t(`viewer.${date.kind}`, { date: format.dateTime(date.at) })}</p>}
      <p>{t('viewer.blurred')}</p>
    </div>
  );
}
