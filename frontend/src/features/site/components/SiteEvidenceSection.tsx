import { useTranslation } from 'react-i18next';
import { useFormatter } from '../../../i18n/useFormatter';
import type { EvidenceLine } from '../SiteEvidenceView';

interface SiteEvidenceSectionProps {
  /** i18n key of the heading. */
  readonly title: string;
  readonly lines: readonly EvidenceLine[];
}

/** One heading and its evidence lines; nothing when there are no lines. */
export function SiteEvidenceSection({ title, lines }: SiteEvidenceSectionProps) {
  const { t } = useTranslation();
  const format = useFormatter();
  if (lines.length === 0) return null;
  return (
    <section className="facts">
      <h3 className="facts__title">{t(title)}</h3>
      {lines.map(({ key, count, min, metres }) => (
        <p key={key}>{t(`site.${key}`, { count, min, distance: metres === undefined ? '' : format.distance(metres) })}</p>
      ))}
    </section>
  );
}
