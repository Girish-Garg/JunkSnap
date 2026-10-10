import { useTranslation } from 'react-i18next';
import { Illustration } from '../../../ui/Illustration';
import { Notice } from '../../../ui/Notice';
import { Skeleton } from '../../../ui/Skeleton';
import type { AreaScoresState } from '../hooks/useAreaScores';
import { AreaBackLink } from './AreaBackLink';
import { AREA_TITLE_ID } from './areaIds';

interface AreaPendingProps {
  readonly state: AreaScoresState;
}

const TITLE_ID = AREA_TITLE_ID;

export function AreaPending({ state }: AreaPendingProps) {
  const { t } = useTranslation();
  if (state.missing || state.failed) {
    return (
      <div id={TITLE_ID} className="pending-failed" tabIndex={-1}>
        <Illustration name={state.missing ? 'clean' : 'offline'} size={104} />
        <Notice icon="info" text={t(state.missing ? 'areas.missing' : 'areas.loadFailed')} tone={state.missing ? 'info' : 'alert'} />
        <AreaBackLink />
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
