import { useTranslation } from 'react-i18next';
import { Button } from '../../../ui/Button';
import { EmptyState } from '../../../ui/EmptyState';
import { Skeleton } from '../../../ui/Skeleton';

interface SiteListEmptyProps {
  /** The view held no site, so the list shows the pilot city's instead. */
  readonly fallback: boolean;
  /** Not even the pilot city has a site that passes the filters. */
  readonly empty: boolean;
  /** The pilot city's sites are still on their way. */
  readonly loading: boolean;
  readonly onShowCity: () => void;
}

/** What the list says when the view holds no site: Jodhpur's sites instead, or nothing to list at all. */
export function SiteListEmpty({ fallback, empty, loading, onShowCity }: SiteListEmptyProps) {
  const { t } = useTranslation();
  if (!fallback) return null;
  if (empty && loading) return <Skeleton height="72px" />;
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
