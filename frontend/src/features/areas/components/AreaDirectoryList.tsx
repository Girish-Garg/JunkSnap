import { useTranslation } from 'react-i18next';
import { AREA_KINDS } from '../../../domain/AreaKey';
import { Button } from '../../../ui/Button';
import { EmptyState } from '../../../ui/EmptyState';
import { Notice } from '../../../ui/Notice';
import { Skeleton } from '../../../ui/Skeleton';
import type { AreaDirectoryState } from '../hooks/useAreaDirectory';
import { AreaGroup } from './AreaGroup';
import { LocalBodyGroup } from './LocalBodyGroup';

interface AreaDirectoryListProps {
  readonly state: AreaDirectoryState;
  readonly query: string;
}

/**
 * The Areas tab's groups by kind and the local body, or why there are none: loading or no match. When a list
 * fails, its areas still show by name with "Couldn't load counts", under one notice with Try again.
 */
export function AreaDirectoryList({ state, query }: AreaDirectoryListProps) {
  const { t } = useTranslation();
  const { entries } = state;
  if (!entries) {
    return (
      <div className="area-skeleton" role="status" aria-label={t('areas.listLoading')}>
        <Skeleton height="56px" />
        <Skeleton height="56px" />
      </div>
    );
  }
  const failed = state.partial && (
    <div className="area-partial">
      <Notice icon="info" text={t('areas.listPartial')} tone="alert" />
      <Button variant="secondary" onClick={state.retry}>{t('areas.retry')}</Button>
    </div>
  );
  if (entries.length === 0 && query.trim()) return <>{failed}<p className="sheet-text">{t('areas.noMatch')}</p></>;
  if (entries.length === 0) return <>{failed}<EmptyState art="clean" title={t('areas.noneTitle')} text={t('areas.none')} /></>;
  return (
    <>
      {failed}
      {AREA_KINDS.map((kind) => (
        <AreaGroup key={kind} kind={kind} entries={entries.filter((entry) => entry.area.kind === kind)} />
      ))}
      <LocalBodyGroup query={query} />
    </>
  );
}
