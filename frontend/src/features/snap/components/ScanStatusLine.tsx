import { useTranslation } from 'react-i18next';
import type { QueuedScan } from '../../../domain/QueuedScan';
import { ScanProgress, type ScanOutcome } from '../ScanProgress';

function useOutcomeText(outcome: ScanOutcome | null): string | null {
  const { t } = useTranslation();
  if (outcome === null) return null;
  if (outcome.kind === 'checking') return t('scan.checking', { count: outcome.count });
  if (outcome.kind === 'nothing') return t('scan.nothing');
  const parts = outcome.parts.map((part) => t(`scan.typeCount.${part.type}`, { count: part.count }));
  return t('scan.found', { count: outcome.count, parts: parts.join(', ') });
}

/** The status badge, then what the video found: only frames the models passed count, one per site. */
export function ScanStatusLine({ scan }: { readonly scan: QueuedScan }) {
  const { t } = useTranslation();
  const view = ScanProgress.of(scan);
  const text = useOutcomeText(ScanProgress.outcome(scan));
  return (
    <p className="scan-status" role="status">
      <span className={`badge badge--progress-${view.tone}`}>{t(`scan.progress.${view.key}`)}</span>
      {text && <span>{text}</span>}
    </p>
  );
}
