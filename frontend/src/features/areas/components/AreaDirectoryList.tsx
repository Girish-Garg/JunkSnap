import { useTranslation } from 'react-i18next';
import { AREA_KINDS } from '../../../domain/AreaKey';
import { EmptyState } from '../../../ui/EmptyState';
import { Notice } from '../../../ui/Notice';
import { Skeleton } from '../../../ui/Skeleton';
import type { AreaDirectoryState } from '../hooks/useAreaDirectory';
import { AreaGroup } from './AreaGroup';

interface AreaDirectoryListProps {
  readonly state: AreaDirectoryState;
  readonly query: string;
}

/** The Areas tab's groups by kind, or why there are none: loading, failed, no match, or no reports anywhere yet. */
export function AreaDirectoryList({ state, query }: AreaDirectoryListProps) {
  const { t } = useTranslation();
  if (state.failed) return <Notice icon="info" text={t('areas.listFailed')} tone="alert" />;
  const { entries } = state;
  if (!entries) {
    return (
      <div className="area-skeleton" role="status" aria-label={t('areas.listLoading')}>
        <Skeleton height="56px" />
        <Skeleton height="56px" />
      </div>
    );
  }
  if (entries.length === 0 && query.trim()) return <p className="sheet-text">{t('areas.noMatch')}</p>;
  if (entries.length === 0) return <EmptyState art="clean" title={t('areas.noneTitle')} text={t('areas.none')} />;
  return AREA_KINDS.map((kind) => <AreaGroup key={kind} kind={kind} entries={entries.filter((entry) => entry.area.kind === kind)} />);
}
