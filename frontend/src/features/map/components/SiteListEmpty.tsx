import { useTranslation } from 'react-i18next';
import { Button } from '../../../ui/Button';
import { EmptyState } from '../../../ui/EmptyState';
import { Skeleton } from '../../../ui/Skeleton';
import type { PilotLoad } from '../hooks/usePilotSites';

interface SiteListEmptyProps {
  /** The view held no site, so the list shows the pilot city's instead. */
  readonly fallback: boolean;
  /** Not even the pilot city has a site that passes the filters. */
  readonly empty: boolean;
  readonly pilot: PilotLoad;
  readonly onShowCity: () => void;
}

/** What the list says when the view holds no site: Jodhpur's sites instead, a retry if they failed, or nothing at all. */
export function SiteListEmpty({ fallback, empty, pilot, onShowCity }: SiteListEmptyProps) {
  const { t } = useTranslation();
  if (!fallback) return null;
  if (pilot.failed) return <SiteListFailed onRetry={pilot.retry} />;
  if (empty && pilot.sites === null) return <Skeleton height="72px" />;
  const showCity = (
    <Button variant="secondary" onClick={onShowCity}>
      {t('browse.showCity')}
    </Button>
  );
  if (empty) {
    return (
      <div className="site-list-sheet__empty">
        <EmptyState art="clean" title={t('browse.emptyView')} text={t('browse.emptyText')} />
        {showCity}
      </div>
    );
  }
  return (
    <div className="site-list-sheet__note" role="status">
      <p className="site-list-sheet__note-title">{t('browse.emptyView')}</p>
      <p>{t('browse.cityNote')}</p>
      {showCity}
    </div>
  );
}

// The sleepy unplugged cloud: Jodhpur's sites could not load, with one tap to ask again.
function SiteListFailed({ onRetry }: { readonly onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="site-list-sheet__empty" role="status">
      <EmptyState art="offline" title={t('browse.emptyView')} text={t('browse.cityFailed')} />
      <Button variant="secondary" onClick={onRetry}>
        {t('browse.retry')}
      </Button>
    </div>
  );
}
