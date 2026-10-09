import { useTranslation } from 'react-i18next';
import { useFormatter } from '../../../i18n/useFormatter';

interface SiteCountsProps {
  readonly reports: number;
  readonly verified: number;
}

export function SiteCounts({ reports, verified }: SiteCountsProps) {
  const { t } = useTranslation();
  const format = useFormatter();
  return (
    <dl className="counts">
      <div className="counts__item">
        <dt>{t('site.reports')}</dt>
        <dd>{format.number(reports)}</dd>
      </div>
      <div className="counts__item">
        <dt>{t('site.verifiedReports')}</dt>
        <dd>{format.number(verified)}</dd>
      </div>
    </dl>
  );
}
