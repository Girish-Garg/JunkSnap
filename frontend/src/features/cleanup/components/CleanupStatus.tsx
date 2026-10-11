import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sitePath } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { CleanupOutcome } from '../../../domain/CleanupOutcome';
import type { SiteFeature } from '../../../domain/Site';
import { Button } from '../../../ui/Button';

interface CleanupStatusProps {
  readonly site: SiteFeature | null;
  readonly siteId: string;
  /** From the 202: the site's status is read for this photo, not for an earlier person's. */
  readonly cleanupId: string;
  readonly reload: () => void;
}

const POLL_MS = 5_000;

/** Polls the site for this photo's result; the site read before the claim may hold an old result, so only a later read counts. */
export function CleanupStatus({ site, siteId, cleanupId, reload }: CleanupStatusProps) {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  const [beforeClaim] = useState(site);
  const fresh = site !== null && site !== beforeClaim;
  const key = fresh ? CleanupOutcome.of(site.properties, cleanupId) : 'checking';
  const checking = key === 'checking';
  useEffect(() => {
    reload();
  }, [reload]);
  useEffect(() => {
    if (!checking) return undefined;
    const timer = window.setInterval(reload, POLL_MS);
    return () => window.clearInterval(timer);
  }, [checking, reload]);
  return (
    <div className="snap-sent">
      <p className="scan-status" role="status">
        <span className={`badge ${key === 'accepted' ? 'badge--progress-good' : ''}`}>{t(`cleanup.status.${key}`)}</span>
      </p>
      <p className="sheet-text">{t(`cleanup.statusText.${key}`)}</p>
      <Button onClick={() => sheets.close(sitePath(siteId))}>{t('cleanup.backToSite')}</Button>
    </div>
  );
}
