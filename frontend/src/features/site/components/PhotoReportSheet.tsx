import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../../../ui/BottomSheet';
import { useHistoryLayer } from '../../../ui/useHistoryLayer';
import type { PhotoReportPlace } from '../hooks/usePhotoReportForm';
import '../photo-report.css';
import { PhotoReportForm } from './PhotoReportForm';

const TITLE_ID = 'photo-report-title';

interface PhotoReportSheetProps {
  readonly place: PhotoReportPlace;
  readonly onClose: () => void;
  /** After a report went through: reads the site again. */
  readonly onSent: () => void;
}

/** "Report this photo" (decision 20261011-0310-hem-photo-flags), and why one report changes nothing alone. */
export function PhotoReportSheet({ place, onClose, onSent }: PhotoReportSheetProps) {
  const { t } = useTranslation();
  // Its own history entry: back closes this sheet, not the site under it.
  const dismiss = useHistoryLayer('photo-report', true, onClose);
  const sheet = (
    <BottomSheet labelledBy={TITLE_ID} closeLabel={t('photoReport.close')} resizeLabel={t('sheet.resize')} onClose={() => dismiss()} initial="full">
      <h2 id={TITLE_ID} className="sheet-title" tabIndex={-1}>
        {t('photoReport.title')}
      </h2>
      <p className="form__note">{t('photoReport.intro')}</p>
      <PhotoReportForm place={place} onSent={() => dismiss(onSent)} onCancel={() => dismiss()} />
    </BottomSheet>
  );
  // On top of the site sheet it was opened from.
  return createPortal(sheet, document.body);
}
