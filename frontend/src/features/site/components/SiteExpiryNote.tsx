import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SiteProperties } from '../../../domain/Site';
import { SiteLifecycle } from '../../../domain/SiteLifecycle';
import '../clearance.css';

interface SiteExpiryNoteProps {
  readonly site: SiteProperties;
}

/** "Expires in N days unless someone confirms it": any report, vote or after-photo resets the 90 days (decision 20261010-1855). */
export function SiteExpiryNote({ site }: SiteExpiryNoteProps) {
  const { t } = useTranslation();
  const [now] = useState(() => Date.now());
  const lifecycle = new SiteLifecycle(site);
  if (lifecycle.isExpired()) return <p className="expiry-note">{t('expiry.expired')}</p>;
  const days = lifecycle.daysLeft(now);
  if (days === null) return null;
  return <p className="expiry-note">{days === 0 ? t('expiry.today') : t('expiry.left', { count: days })}</p>;
}
