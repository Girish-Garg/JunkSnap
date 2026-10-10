import { useTranslation } from 'react-i18next';
import { AreaProgress } from '../../../domain/AreaProgress';
import type { AreaScoresState } from '../../areas/hooks/useAreaScores';
import { useAreaProgressText } from '../../areas/hooks/useAreaProgressText';

/** The area card's counts and status once its scores row is in (or known absent), else loading or failed. */
export function AreaCardLines({ state }: { readonly state: AreaScoresState }) {
  const { t } = useTranslation();
  const text = useAreaProgressText();
  if (!state.scores && !state.missing) {
    return <p className="area-card__lines">{t(state.failed ? 'areas.loadFailed' : 'areas.loading')}</p>;
  }
  const lines = text.lines(AreaProgress.of(state.scores));
  return (
    <p className="area-card__lines">
      <span>{lines.counts}</span>
      <strong>{lines.status}</strong>
    </p>
  );
}
