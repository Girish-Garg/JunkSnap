import { useTranslation } from 'react-i18next';
import { Button } from '../../../ui/Button';
import { Illustration } from '../../../ui/Illustration';
import { Notice } from '../../../ui/Notice';
import { Skeleton } from '../../../ui/Skeleton';

interface SitePanelPendingProps {
  readonly titleId: string;
  readonly failed: boolean;
  /** The api has no such site any more, so there is nothing to try again. */
  readonly missing?: boolean;
  readonly onRetry?: () => void;
}

export function SitePanelPending({ titleId, failed, missing = false, onRetry }: SitePanelPendingProps) {
  const { t } = useTranslation();
  if (failed) {
    return (
      <div id={titleId} className="pending-failed" tabIndex={-1}>
        <Illustration name={missing ? 'clean' : 'offline'} size={104} />
        <Notice icon="info" text={t(missing ? 'site.missing' : 'site.loadFailed')} tone={missing ? 'info' : 'alert'} />
        {!missing && onRetry && <Button onClick={onRetry}>{t('crash.retry')}</Button>}
      </div>
    );
  }
  return (
    <div className="site-skeleton" role="status">
      <span id={titleId} className="visually-hidden" tabIndex={-1}>
        {t('site.loading')}
      </span>
      <Skeleton width="60%" height="28px" />
      <Skeleton width="40%" height="20px" />
      <Skeleton height="64px" />
      <Skeleton height="120px" />
    </div>
  );
}
