import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AREAS_PATH } from '../../../app/paths';
import { Notice } from '../../../ui/Notice';
import { Skeleton } from '../../../ui/Skeleton';
import type { AreaScoresState } from '../hooks/useAreaScores';
import { AREA_TITLE_ID } from './areaIds';

interface AreaPendingProps {
  readonly state: AreaScoresState;
}

const TITLE_ID = AREA_TITLE_ID;

export function AreaPending({ state }: AreaPendingProps) {
  const { t } = useTranslation();
  if (state.missing || state.failed) {
    return (
      <div id={TITLE_ID} tabIndex={-1}>
        <Notice icon="info" text={t(state.missing ? 'areas.missing' : 'areas.loadFailed')} tone={state.missing ? 'info' : 'alert'} />
        <Link className="area-back" to={AREAS_PATH}>
          {t('areas.all')}
        </Link>
      </div>
    );
  }
  return (
    <div className="area-skeleton" role="status">
      <span id={TITLE_ID} className="visually-hidden" tabIndex={-1}>
        {t('areas.loading')}
      </span>
      <Skeleton width="60%" height="28px" />
      <Skeleton height="72px" />
      <Skeleton height="72px" />
      <Skeleton height="72px" />
    </div>
  );
}
