import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { BOUNDARY_KINDS, CITIES } from '../../../domain/AreaListing';
import { BottomSheet } from '../../../ui/BottomSheet';
import { Segmented } from '../../../ui/Segmented';
import { AreaBackLink } from '../../areas/components/AreaBackLink';
import { useRanking } from '../hooks/useRanking';
import { useRankingQuery } from '../hooks/useRankingQuery';
import '../../areas/areas.css';
import '../ranking.css';
import { RANKING_TITLE_ID } from './rankingIds';
import { RankingList } from './RankingList';

/** /ranking: a city's areas worst first, from the scores the api shows today. */
export function RankingRoute() {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  const close = useCallback(() => sheets.close('/'), [sheets]);
  const { city, kind, update } = useRankingQuery();
  const ranking = useRanking(kind, city.id);
  const cities = CITIES.map((option) => ({ value: option.id, label: t(`ranking.city.${option.key}`) }));
  const kinds = BOUNDARY_KINDS.map((value) => ({ value, label: t(`boundaries.layer.${value}`) }));
  return (
    <BottomSheet labelledBy={RANKING_TITLE_ID} closeLabel={t('ranking.close')} resizeLabel={t('sheet.resize')} onClose={close} focusKey={ranking.rows}>
      <AreaBackLink />
      <h2 id={RANKING_TITLE_ID} className="sheet-title" tabIndex={-1}>
        {t('ranking.title', { city: t(`ranking.city.${city.key}`) })}
      </h2>
      <p className="sheet-text">{t('ranking.intro')}</p>
      <div className="ranking-filters">
        <Segmented label={t('ranking.cityLabel')} options={cities} value={city.id} onChange={(id) => update({ city: id })} />
        <Segmented label={t('ranking.kindLabel')} options={kinds} value={kind} onChange={(next) => update({ kind: next })} />
      </div>
      <RankingList kind={kind} state={ranking} />
    </BottomSheet>
  );
}
