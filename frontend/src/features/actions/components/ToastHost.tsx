import { useTranslation } from 'react-i18next';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { IconButton } from '../../../ui/IconButton';
import { ToastSlot } from '../../../ui/ToastSlot';
import { useToastOrder } from '../../../ui/useToastOrder';
import { useToast } from '../hooks/useToast';
import '../actions.css';

/**
 * App-wide, in the ToastStack with the rejection and confirm toasts: one short line at a time, e.g. why a tapped
 * action is off or that the connection is back. The live region stays mounted so screen readers announce each new
 * line; its CSS order moves it below the toasts already up whenever a new line shows.
 */
export function ToastHost() {
  const { t } = useTranslation();
  const { current, dismiss, act } = useToast();
  const order = useToastOrder(current?.id ?? null);
  return (
    <ToastSlot>
      <div className="app-toast-region" role="status" aria-live="polite" style={{ order }}>
        {current && (
          <div key={current.id} className={`app-toast app-toast--${current.tone}`}>
            <span className="app-toast__icon">
              <Icon name="info" size={20} />
            </span>
            <div className="app-toast__body">
              <p className="app-toast__text">
                {t(current.key, current.params)}
                {current.detail && ` ${t(current.detail)}`}
              </p>
              {current.action && (
                <Button variant="text" size="small" onClick={act}>
                  {t(current.action.key)}
                </Button>
              )}
            </div>
            <IconButton icon="close" label={t('toast.dismiss')} onClick={dismiss} />
          </div>
        )}
      </div>
    </ToastSlot>
  );
}
