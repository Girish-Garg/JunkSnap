import { useTranslation } from 'react-i18next';
import { FactList } from '../../../ui/FactList';
import type { AreaInsightsPresenter } from '../AreaInsightsPresenter';

interface AreaInsightsProps {
  readonly insights: AreaInsightsPresenter;
}

export function AreaInsights({ insights }: AreaInsightsProps) {
  const { t } = useTranslation();
  if (!insights.ready()) return null;
  const composition = insights.composition();
  return (
    <>
      <section className="area-composition">
        <h3 className="facts__title">{t('areas.composition')}</h3>
        <ul className="area-composition__list">
          {composition.shares.map((share) => (
            <li key={share.label} className="area-share">
              <span className="area-share__label">{share.label}</span>
              <span className="area-share__bar" aria-hidden="true">
                <span style={{ width: `${share.pct}%` }} />
              </span>
              <span className="area-share__value">{share.text}</span>
            </li>
          ))}
        </ul>
        <p className="area-composition__note">{composition.note}</p>
      </section>
      <FactList title={t('areas.insights')} facts={insights.facts()} />
    </>
  );
}
