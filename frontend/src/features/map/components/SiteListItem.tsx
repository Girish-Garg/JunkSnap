import { useTranslation } from 'react-i18next';
import type { SiteFeature } from '../../../domain/Site';
import { Icon } from '../../../ui/Icon';
import { TypeIcon } from '../../../ui/TypeIcon';
import { StatusBadge } from '../../site/components/StatusBadge';
import '../../site/site.css';

interface SiteListItemProps {
  readonly site: SiteFeature;
  readonly onOpen: (site: SiteFeature) => void;
}

export function SiteListItem({ site, onOpen }: SiteListItemProps) {
  const { t } = useTranslation();
  const { report_type: type, status, location, report_count: reports } = site.properties;
  return (
    <li>
      <button type="button" className="site-row" onClick={() => onOpen(site)}>
        <span className={`type-chip type-chip--${type}`}>
          <TypeIcon type={type} size={28} />
        </span>
        <span className="site-row__text">
          <strong>{t(`reportType.${type}`)}</strong>
          <span className="site-row__meta">
            <StatusBadge status={status} />
            <span>{location.town ?? location.state}</span>
            <span>{t('preview.reports', { count: reports })}</span>
          </span>
        </span>
        <Icon name="chevron" size={20} />
      </button>
    </li>
  );
}
