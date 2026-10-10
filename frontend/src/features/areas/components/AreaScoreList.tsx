import { useTranslation } from 'react-i18next';
import type { ScoreView } from '../AreaPresenter';

interface AreaScoreListProps {
  readonly scores: readonly ScoreView[];
}

export function AreaScoreList({ scores }: AreaScoreListProps) {
  const { t } = useTranslation();
  return (
    <section className="area-scores" aria-label={t('areas.scores')}>
      <h3 className="facts__title">{t('areas.scores')}</h3>
      <ul className="area-scores__list">
        {scores.map((score) => (
          <li key={score.name} className="area-score">
            <div className="area-score__text">
              <span className="area-score__label">{score.label}</span>
              <span className="area-score__hint">{score.hint}</span>
            </div>
            <div className="area-score__value">
              {score.value === null ? (
                <span className="area-score__withheld">{t('areas.withheld')}</span>
              ) : (
                <span>
                  <strong>{score.value}</strong>
                  <span className="area-score__of">/100</span>
                </span>
              )}
              <span className="area-score__note">{score.note}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
