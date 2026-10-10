import { useTranslation } from 'react-i18next';
import type { AreaProgress } from '../../../domain/AreaProgress';
import { useAreaProgressText } from '../hooks/useAreaProgressText';

interface AreaRowLinesProps {
  readonly progress: AreaProgress;
  /** The list holding this area's row failed: its counts are unknown, never zero. */
  readonly unloaded: boolean;
  /** The row is pilot-city data; the flag shows beside a shown score. */
  readonly pilot: boolean;
}

/** An Areas row's counts (zeros included) and status; "Couldn't load counts" alone when its list failed. */
export function AreaRowLines({ progress, unloaded, pilot }: AreaRowLinesProps) {
  const { t } = useTranslation();
  const text = useAreaProgressText();
  if (unloaded) return <span className="area-row__status">{t('areas.countsFailed')}</span>;
  const lines = text.lines(progress);
  return (
    <>
      <span className="area-row__meta">{lines.counts}</span>
      <span className="area-row__status">
        {lines.status}
        {pilot && progress.stage === 'scored' && <span className="badge area-row__pilot">{t('site.pilot')}</span>}
      </span>
    </>
  );
}
