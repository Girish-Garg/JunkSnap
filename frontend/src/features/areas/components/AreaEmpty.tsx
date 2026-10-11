import { useTranslation } from 'react-i18next';
import { useConfig } from '../../../app/useConfig';
import { AreaProgress } from '../../../domain/AreaProgress';
import type { AreaKind } from '../../../domain/AreaScores';
import { useFormatter } from '../../../i18n/useFormatter';
import { FactList } from '../../../ui/FactList';
import { Illustration } from '../../../ui/Illustration';
import { useAreaProgressText } from '../hooks/useAreaProgressText';
import { AreaBackLink } from './AreaBackLink';
import { AREA_TITLE_ID } from './areaIds';

interface AreaEmptyProps {
  readonly kind: AreaKind;
  readonly name: string;
  readonly pilot: boolean;
}

/**
 * A known area nobody has reported in yet (404 area_not_found): its name and kind, the pilot flag, "No reports
 * yet", why no score shows, and every count at 0. Nothing here is estimated.
 */
export function AreaEmpty({ kind, name, pilot }: AreaEmptyProps) {
  const { t } = useTranslation();
  const format = useFormatter();
  const text = useAreaProgressText();
  const { min } = AreaProgress.of(null, useConfig().site.minVerifiedReports);
  return (
    <article className="area-page area-empty">
      <AreaBackLink />
      <h2 id={AREA_TITLE_ID} className="sheet-title" tabIndex={-1}>
        {name}
      </h2>
      <p className="area-page__meta">
        <span>{t(`areas.kind.${kind}`)}</span>
        {pilot && <span className="badge">{t('site.pilot')}</span>}
      </p>
      <div className="area-empty__state">
        <Illustration name="clean" size={88} />
        <p className="area-empty__title">{t('areas.noReports')}</p>
        <p className="area-empty__text">{t('areas.notEnough', { n: format.number(0), min: format.number(min) })}</p>
      </div>
      <FactList title={t('areas.counts')} facts={text.zeroCounts()} />
    </article>
  );
}
