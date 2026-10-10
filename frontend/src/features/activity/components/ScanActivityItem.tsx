import { useTranslation } from 'react-i18next';
import { useServices } from '../../../app/useServices';
import type { QueuedScan } from '../../../domain/QueuedScan';
import { AUTO } from '../../../domain/ScanUpload';
import { useFormatter } from '../../../i18n/useFormatter';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { ScanFrameStrip } from '../../snap/components/ScanFrameStrip';
import { ScanStatusLine } from '../../snap/components/ScanStatusLine';
import { ScanProgress } from '../../snap/ScanProgress';
import { ActivityDelete } from './ActivityDelete';

function useScanLines(draft: QueuedScan['data']['draft']) {
  const { t } = useTranslation();
  const format = useFormatter();
  const type = draft.report_type === AUTO ? t('scan.scout') : t(`reportType.${draft.report_type}`);
  const place = draft.context === AUTO ? t('scan.placeAuto') : t(`context.${draft.context}`);
  const title = `${t('scan.activityTitle', { seconds: Math.round(draft.duration_ms / 1000) })} · ${type}`;
  return { title, meta: `${place} · ${format.dateTime(draft.started_at)}` };
}

/** One recording: its type and place, length, status, what it found and each frame's result. */
export function ScanActivityItem({ scan }: { readonly scan: QueuedScan }) {
  const { t } = useTranslation();
  const { snap } = useServices();
  const { draft, problem, stage } = scan.data;
  const lines = useScanLines(draft);
  return (
    <li className="report-row">
      <span className="report-thumb report-thumb--missing" aria-hidden="true">
        <Icon name="camera" size={20} />
      </span>
      <div className="report-row__body">
        <p className="report-row__title">{lines.title}</p>
        <p className="report-row__meta">{lines.meta}</p>
        <ScanStatusLine scan={scan} />
        <ScanFrameStrip frames={ScanProgress.frames(scan)} />
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
