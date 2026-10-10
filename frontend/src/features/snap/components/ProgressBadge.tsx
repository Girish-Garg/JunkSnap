import { useTranslation } from 'react-i18next';
import type { QueuedReport } from '../../../domain/QueuedReport';
import { ReportProgress } from '../ReportProgress';

export function ProgressBadge({ report }: { readonly report: QueuedReport }) {
  const { t } = useTranslation();
  const view = ReportProgress.of(report);
  return <span className={`badge badge--progress-${view.tone}`}>{t(`progress.${view.key}`)}</span>;
}
