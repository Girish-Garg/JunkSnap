import { useTranslation } from 'react-i18next';
import type { QueuedScan } from '../../../domain/QueuedScan';
import { ScanProgress } from '../ScanProgress';

/** The status badge, and "N reports made from M frames" once the worker is done. */
export function ScanStatusLine({ scan }: { readonly scan: QueuedScan }) {
  const { t } = useTranslation();
  const view = ScanProgress.of(scan);
  const result = ScanProgress.result(scan);
  return (
    <p className="scan-status" role="status">
      <span className={`badge badge--progress-${view.tone}`}>{t(`scan.progress.${view.key}`)}</span>
      {result && <span>{t('scan.result', { count: result.count, frames: result.frames })}</span>}
    </p>
  );
}
