import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { sitePath } from '../../../app/paths';
import type { SiteFeature } from '../../../domain/Site';
import { Button } from '../../../ui/Button';

interface CleanupStatusProps {
  readonly site: SiteFeature | null;
  readonly siteId: string;
  readonly reload: () => void;
}

const POLL_MS = 5_000;

/** Polls cleanup_status; the site read before the claim may hold an old rejection, so only a later read counts. */
export function CleanupStatus({ site, siteId, reload }: CleanupStatusProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [beforeClaim] = useState(site);
  const fresh = site !== null && site !== beforeClaim;
  const status = fresh ? site.properties.cleanup_status : 'checking';
  const checking = status === 'checking' || status === 'none';
  useEffect(() => {
    reload();
  }, [reload]);
  useEffect(() => {
    if (!checking) return undefined;
    const timer = window.setInterval(reload, POLL_MS);
    return () => window.clearInterval(timer);
  }, [checking, reload]);
  const key = checking ? 'checking' : status;
  return (
    <div className="snap-sent">
      <p className="scan-status" role="status">
        <span className={`badge ${key === 'accepted' ? 'badge--progress-good' : ''}`}>{t(`cleanup.status.${key}`)}</span>
      </p>
      <p className="sheet-text">{t(`cleanup.statusText.${key}`)}</p>
      <Button onClick={() => navigate(sitePath(siteId))}>{t('cleanup.backToSite')}</Button>
    </div>
  );
}
