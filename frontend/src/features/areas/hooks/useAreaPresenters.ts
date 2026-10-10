import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { AreaScores } from '../../../domain/AreaScores';
import { useFormatter } from '../../../i18n/useFormatter';
import { AreaInsightsPresenter } from '../AreaInsightsPresenter';
import { AreaPresenter, type Translate } from '../AreaPresenter';

export function useAreaPresenters(scores: AreaScores) {
  const { t } = useTranslation();
  const format = useFormatter();
  return useMemo(() => {
    const translate: Translate = (key, params) => t(key, params);
    const area = new AreaPresenter(scores, translate, format);
    return { area, insights: new AreaInsightsPresenter(scores, area, translate, format) };
  }, [scores, t, format]);
}
