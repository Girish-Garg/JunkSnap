import { useTranslation } from 'react-i18next';
import { Icon } from '../../../ui/Icon';
import { IconButton } from '../../../ui/IconButton';
import { useRejectionToast } from '../hooks/useRejectionToast';
import '../rejection.css';

/** App-wide: tells the reporter, once, that a photo just came back as not a waste site. */
export function RejectionToast() {
  const { t } = useTranslation();
  const { shown, dismiss } = useRejectionToast();
  if (!shown) return null;
  return (
    <div className="rejection-toast" role="alert">
      <span className="rejection-toast__icon">
        <Icon name="info" size={20} />
      </span>
      <p className="rejection-toast__text">{t('rejection.not_waste')}</p>
      <IconButton icon="close" label={t('rejection.dismiss')} onClick={dismiss} />
    </div>
  );
}
