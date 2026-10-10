import { useTranslation } from 'react-i18next';
import { useServices } from '../../../app/useServices';
import type { QueuedScan } from '../../../domain/QueuedScan';
import { useFormatter } from '../../../i18n/useFormatter';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { ScanStatusLine } from '../../snap/components/ScanStatusLine';
import { ActivityDelete } from './ActivityDelete';

/** One recording: its type and place, length, status and how many frame reports it made. */
export function ScanActivityItem({ scan }: { readonly scan: QueuedScan }) {
  const { t } = useTranslation();
  const format = useFormatter();
  const { snap } = useServices();
  const { draft, problem, stage } = scan.data;
  return (
    <li className="report-row">
      <span className="report-thumb report-thumb--missing" aria-hidden="true">
        <Icon name="camera" size={20} />
      </span>
      <div className="report-row__body">
        <p className="report-row__title">
          {t('scan.activityTitle', { seconds: Math.round(draft.duration_ms / 1000) })} · {t(`reportType.${draft.report_type}`)}
        </p>
        <p className="report-row__meta">
          {t(`context.${draft.context}`)} · {format.dateTime(draft.started_at)}
        </p>
        <ScanStatusLine scan={scan} />
        <div className="report-row__actions">
          {(problem !== null || stage === 'failed') && (
            <Button variant="text" onClick={() => void snap.scans.retry((other) => other.id === scan.id)}>
              {t('activity.retry')}
            </Button>
          )}
          <ActivityDelete target={{ scan }} />
        </div>
      </div>
    </li>
  );
}
