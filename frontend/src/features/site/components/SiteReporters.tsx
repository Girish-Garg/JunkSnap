import { useTranslation } from 'react-i18next';
import type { SiteProperties } from '../../../domain/Site';
import { useFormatter } from '../../../i18n/useFormatter';
import { SiteEvidenceView } from '../SiteEvidenceView';

/** How many people reported the site, and for dumps and no-bin reports how far the nearest known bin is. */
export function SiteReporters({ site }: { readonly site: SiteProperties }) {
  const { t } = useTranslation();
  const format = useFormatter();
  const lines = SiteEvidenceView.lines(site);
  if (lines.length === 0) return null;
  return (
    <section className="facts">
      <h3 className="facts__title">{t('site.evidence')}</h3>
      {lines.map(({ key, count, min, metres }) => (
        <p key={key}>{t(`site.${key}`, { count, min, distance: metres === undefined ? '' : format.distance(metres) })}</p>
      ))}
    </section>
  );
}
