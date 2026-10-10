import { useTranslation } from 'react-i18next';
import { PHOTO_FLAG_REASONS, PHOTO_FLAG_TEXT_MAX, type PhotoFlagReason } from '../../../domain/PhotoFlag';
import { Button } from '../../../ui/Button';
import { ChoiceChips } from '../../../ui/ChoiceChips';
import { TextArea } from '../../../ui/TextArea';
import { usePhotoReportForm, type PhotoReportPlace } from '../hooks/usePhotoReportForm';

interface PhotoReportFormProps {
  readonly place: PhotoReportPlace;
  readonly onSent: () => void;
  readonly onCancel: () => void;
}

/** A reason, an optional description that is checked and never shown, then send. */
export function PhotoReportForm({ place, onSent, onCancel }: PhotoReportFormProps) {
  const { t } = useTranslation();
  const form = usePhotoReportForm(place, onSent);
  const reasons = PHOTO_FLAG_REASONS.map((value) => ({ value, label: t(`photoReport.reasons.${value}`) }));
  return (
    <form className="photo-report" onSubmit={(event) => { event.preventDefault(); form.submit(); }}>
      <p className="facts__title">{t('photoReport.reasonLabel')}</p>
      <ChoiceChips<PhotoFlagReason> label={t('photoReport.reasonLabel')} options={reasons} value={form.reason} onChange={form.setReason} />
      <TextArea id="photo-report-text" label={t('photoReport.textLabel')} value={form.text} onChange={form.setText} maxLength={PHOTO_FLAG_TEXT_MAX} hint={t('photoReport.left', { left: form.left })} />
      <p className="form__note">{t('photoReport.privacy')}</p>
      <div className="photo-report__buttons">
        <Button type="submit" disabled={!form.ready}>{t(form.busy ? 'photoReport.sending' : 'photoReport.send')}</Button>
        <Button variant="text" onClick={onCancel}>{t('photoReport.cancel')}</Button>
      </div>
      {form.problem && (
        <p className="form__error" role="alert">
          {t(`photoReport.errors.${form.problem}`)}
        </p>
      )}
    </form>
  );
}
