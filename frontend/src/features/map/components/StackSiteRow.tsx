import { useTranslation } from 'react-i18next';
import type { SiteFeature } from '../../../domain/Site';
import { TypeIcon } from '../../../ui/TypeIcon';
import { SiteThumb } from '../../site/components/SiteThumb';
import { StatusChip } from '../../site/components/StatusChip';
import { useSitePresenter } from '../../site/hooks/useSitePresenter';
import '../../site/site.css';

interface StackSiteRowProps {
  readonly site: SiteFeature;
  readonly onOpen: (site: SiteFeature) => void;
}

/** One site of a stack pin: its type, status, how many people backed it, and its newest blurred photo. */
export function StackSiteRow({ site, onOpen }: StackSiteRowProps) {
  const { t } = useTranslation();
  const details = site.properties;
  return (
    <li>
      <button type="button" className="site-row stack-row" onClick={() => onOpen(site)}>
        <span className={`type-chip type-chip--${details.report_type}`}>
          <TypeIcon type={details.report_type} size={28} />
        </span>
        <span className="site-row__text">
          <strong>{t(`reportType.${details.report_type}`)}</strong>
          <span className="site-row__meta">
            <StatusChip site={details} />
            <span>{t('preview.reports', { count: details.report_count })}</span>
          </span>
        </span>
        <SiteThumb className="stack-row__thumb" url={useSitePresenter(details).thumbnail()} />
      </button>
    </li>
  );
}

