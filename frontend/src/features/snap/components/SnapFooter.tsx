import { useTranslation } from 'react-i18next';
import { useServices } from '../../../app/useServices';
import { Button } from '../../../ui/Button';
import { useAuthFlow } from '../../auth/hooks/useAuthFlow';
import { useAuthUser } from '../../auth/hooks/useAuthUser';
import { useQueue } from '../hooks/useQueue';

/** Under the camera: reports still waiting to send, sample mode, and a sign-in nudge for guests. */
export function SnapFooter() {
  const { t } = useTranslation();
  const { config, snap } = useServices();
  const user = useAuthUser();
  const auth = useAuthFlow();
  const waiting = useQueue().filter((report) => report.isPending()).length;
  return (
    <div className="snap-footer">
      {waiting > 0 && (
        <p className="snap-footer__line" role="status">
          {t('queue.waiting', { count: waiting })}
          <Button variant="text" onClick={() => void snap.queue.retry((report) => report.isPending())}>
            {t('queue.retry')}
          </Button>
        </p>
      )}
      {!user && (
        <p className="snap-footer__line">
          {t('snap.guest')}
          <Button variant="text" onClick={() => auth.go('signIn')}>
            {t('snap.signIn')}
          </Button>
        </p>
      )}
      {config.isSampleData() && <p className="form__note">{t('snap.sample')}</p>}
    </div>
  );
}
