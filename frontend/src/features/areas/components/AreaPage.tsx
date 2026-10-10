import { useTranslation } from 'react-i18next';
import type { AreaScores } from '../../../domain/AreaScores';
import { FactList } from '../../../ui/FactList';
import { useAreaDistrict } from '../hooks/useAreaDistrict';
import { useAreaPresenters } from '../hooks/useAreaPresenters';
import { AreaBackLink } from './AreaBackLink';
import { AREA_TITLE_ID } from './areaIds';
import { AreaDiagnosis } from './AreaDiagnosis';
import { AreaInsights } from './AreaInsights';
import { AreaLetterButton } from './AreaLetterButton';
import { AreaScoreList } from './AreaScoreList';
import { AreaSites } from './AreaSites';
import { DistrictCrawl } from './DistrictCrawl';

interface AreaPageProps {
  readonly scores: AreaScores;
}

// Area level only: counts beside every score, the pilot flag, and nothing the api did not measure.
export function AreaPage({ scores }: AreaPageProps) {
  const { t } = useTranslation();
  const { area, insights } = useAreaPresenters(scores);
  const districtId = useAreaDistrict(scores.area);
  return (
    <article className="area-page">
      <AreaBackLink />
      <h2 id={AREA_TITLE_ID} className="sheet-title" tabIndex={-1}>
        {scores.area.name}
      </h2>
      <p className="area-page__meta">
        <span>{area.kind()}</span>
        {scores.pilot && <span className="badge">{t('site.pilot')}</span>}
      </p>
      <DistrictCrawl districtId={districtId} />
      <AreaLetterButton kind={scores.area.kind} areaId={scores.area.id} />
      <AreaScoreList scores={area.scores()} />
      <AreaDiagnosis items={area.diagnosis()} />
      <FactList title={t('areas.counts')} facts={area.counts()} />
      <AreaInsights insights={insights} />
      <AreaSites area={scores.area} />
      <p className="area-page__footnote">{area.footnote()}</p>
    </article>
  );
}
