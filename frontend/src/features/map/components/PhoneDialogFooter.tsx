import { useTranslation } from 'react-i18next';
import { useConfig } from '../../../app/useConfig';
import { Icon } from '../../../ui/Icon';

/** Under the QR code: the Android app's download page when this build links one, and a note on the ways in. */
export function PhoneDialogFooter() {
  const { t } = useTranslation();
  const { androidAppUrl } = useConfig().links;
  return (
    <>
      {androidAppUrl && (
        <a className="button button--secondary dialog__app" href={androidAppUrl} target="_blank" rel="noopener noreferrer">
          <Icon name="phone" size={20} />
          {t('desktop.androidApp')}
        </a>
      )}
      <p className="form__note">{t(androidAppUrl ? 'desktop.stepsApp' : 'desktop.steps')}</p>
    </>
  );
}
