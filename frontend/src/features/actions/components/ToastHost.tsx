import { useTranslation } from 'react-i18next';
import { Icon } from '../../../ui/Icon';
import { IconButton } from '../../../ui/IconButton';
import { useToast } from '../hooks/useToast';
import '../actions.css';

/**
 * App-wide, at the top of the screen (the rejection and confirm toasts keep the bottom, so they never stack): one
 * short line at a time, e.g. why a tapped action is off or that the connection is back. The live
 * region stays mounted so screen readers announce each new line.
 */
export function ToastHost() {
  const { t } = useTranslation();
  const { current, dismiss } = useToast();
  return (
    <div className="app-toast-region" role="status" aria-live="polite">
      {current && (
        <div key={current.id} className={`app-toast app-toast--${current.tone}`}>
          <span className="app-toast__icon">
            <Icon name="info" size={20} />
          </span>
          <p className="app-toast__text">{t(current.key, current.params)}</p>
          <IconButton icon="close" label={t('toast.dismiss')} onClick={dismiss} />
        </div>
      )}
    </div>
  );
}
