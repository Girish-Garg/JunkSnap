import { useTranslation } from 'react-i18next';
import { Notice } from '../../../ui/Notice';
import { Skeleton } from '../../../ui/Skeleton';

interface SitePanelPendingProps {
  readonly titleId: string;
  readonly failed: boolean;
}

export function SitePanelPending({ titleId, failed }: SitePanelPendingProps) {
  const { t } = useTranslation();
  if (failed) {
    return (
      <div id={titleId}>
        <Notice icon="info" text={t('site.loadFailed')} tone="alert" />
      </div>
    );
  }
  return (
    <div className="site-skeleton" role="status">
      <span id={titleId} className="visually-hidden">
        {t('site.loading')}
      </span>
      <Skeleton width="60%" height="28px" />
      <Skeleton width="45%" height="20px" />
      <Skeleton height="64px" />
      <Skeleton height="120px" />
    </div>
  );
}
