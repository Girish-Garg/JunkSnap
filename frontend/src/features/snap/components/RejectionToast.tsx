import { useTranslation } from 'react-i18next';
import { Icon } from '../../../ui/Icon';
import { IconButton } from '../../../ui/IconButton';
import { ToastSlot } from '../../../ui/ToastSlot';
import { useToastOrder } from '../../../ui/useToastOrder';
import { useRejectionToast } from '../hooks/useRejectionToast';
import '../rejection.css';

/** App-wide: tells the reporter, once, that the models just turned a photo down. */
export function RejectionToast() {
  const { t } = useTranslation();
  const { reason, dismiss } = useRejectionToast();
  const order = useToastOrder(reason);
  if (reason === null) return null;
  return (
    <ToastSlot>
      <div className="rejection-toast" role="alert" style={{ order }}>
        <span className="rejection-toast__icon">
          <Icon name="info" size={20} />
        </span>
        <p className="rejection-toast__text">{t(`rejection.${reason}`)}</p>
        <IconButton icon="close" label={t('rejection.dismiss')} onClick={dismiss} />
      </div>
    </ToastSlot>
  );
}
