import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { AreaScores } from '../../../domain/AreaScores';
import { useFormatter } from '../../../i18n/useFormatter';
import { AreaMarkers, type AreaMarker } from '../AreaMarkers';

/** Each area's marker: a number for the badge and the words for its tooltip, in the UI language. */
export function useAreaMarkers(rows: readonly AreaScores[]): ReadonlyMap<string, AreaMarker> {
  const { t } = useTranslation();
  const format = useFormatter();
  return useMemo(
    () =>
      AreaMarkers.of(rows, {
        number: (value) => format.number(value),
        score: (name, n, reports, pilot) => t(pilot ? 'boundaries.tooltipScorePilot' : 'boundaries.tooltipScore', { name, n, reports }),
        reports: (name, count, n) => t('boundaries.tooltipReports', { name, count, n }),
        noReports: (name) => t('boundaries.tooltipNone', { name }),
      }),
    [rows, t, format],
  );
}
