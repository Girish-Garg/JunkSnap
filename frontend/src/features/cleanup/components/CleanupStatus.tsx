import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { sitePath } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import type { SiteFeature } from '../../../domain/Site';
import { Button } from '../../../ui/Button';
import { useCleanupResult } from '../hooks/useCleanupResult';

interface CleanupStatusProps {
  readonly site: SiteFeature | null;
  readonly siteId: string;
  /** From the 202: the site's status is read for this photo, not for an earlier person's. */
  readonly cleanupId: string;
  readonly reload: () => void;
}

const POLL_MS = 5_000;

/** Polls the site until this photo has a result (useCleanupResult), then says what it was. */
export function CleanupStatus({ site, siteId, cleanupId, reload }: CleanupStatusProps) {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  const key = useCleanupResult(site, cleanupId);
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
