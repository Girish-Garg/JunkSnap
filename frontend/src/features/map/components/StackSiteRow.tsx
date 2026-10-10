import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SiteFeature } from '../../../domain/Site';
import { Icon } from '../../../ui/Icon';
import { TypeIcon } from '../../../ui/TypeIcon';
import { StatusBadge } from '../../site/components/StatusBadge';
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
  const { count, needed } = details.backers;
  const backing =
    details.verification === 'verified' ? t('verification.verified') : t('backers.label', { count: Math.min(count, needed), needed });
  return (
    <li>
      <button type="button" className="site-row stack-row" onClick={() => onOpen(site)}>
        <span className={`type-chip type-chip--${details.report_type}`}>
          <TypeIcon type={details.report_type} size={28} />
        </span>
        <span className="site-row__text">
          <strong>{t(`reportType.${details.report_type}`)}</strong>
          <span className="site-row__meta">
            <StatusBadge status={details.status} />
            <span className={`stack-row__backing stack-row__backing--${details.verification}`}>{backing}</span>
            <span>{t('preview.reports', { count: details.report_count })}</span>
          </span>
        </span>
        <StackThumb url={useSitePresenter(details).thumbnail()} />
      </button>
    </li>
  );
}

// Only the blurred public copy is ever shown; a missing or broken photo shows the photo icon instead.
function StackThumb({ url }: { readonly url: string | null }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="stack-row__thumb" aria-hidden="true">
      {url && !broken ? <img src={url} alt="" loading="lazy" draggable={false} onError={() => setBroken(true)} /> : <Icon name="photo" size={20} />}
    </span>
  );
}
