import { useTranslation } from 'react-i18next';
import { feedbackPath } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { useServices } from '../../../app/useServices';
import type { QueuedScan } from '../../../domain/QueuedScan';
import { AUTO } from '../../../domain/ScanUpload';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { ScanFrameStrip } from '../../snap/components/ScanFrameStrip';
import { ScanStatusLine } from '../../snap/components/ScanStatusLine';
import { ScanProgress } from '../../snap/ScanProgress';
import { ActivityDelete } from './ActivityDelete';
import { ActivityMeta } from './ActivityMeta';

function useScanLines(draft: QueuedScan['data']['draft']) {
  const { t } = useTranslation();
  const type = draft.report_type === AUTO ? t('scan.scout') : t(`reportType.${draft.report_type}`);
  const place = draft.context === AUTO ? t('scan.placeAuto') : t(`context.${draft.context}`);
  const title = `${t('scan.activityTitle', { seconds: Math.round(draft.duration_ms / 1000) })} · ${type}`;
  return { title, place };
}

/** One recording as a card: length and type, place and time, status, then each frame's result and the actions. */
export function ScanActivityItem({ scan }: { readonly scan: QueuedScan }) {
  const { t } = useTranslation();
  const { snap } = useServices();
  const sheets = useSheetNavigation();
  const { draft, problem, stage } = scan.data;
  const lines = useScanLines(draft);
  return (
    <li className="activity-card">
      <div className="activity-card__head">
        <span className="activity-card__thumb" aria-hidden="true">
          <span className="report-thumb report-thumb--missing"><Icon name="video" size={24} /></span>
        </span>
        <div className="activity-card__body">
          <p className="activity-card__title">{lines.title}</p>
          <ActivityMeta place={lines.place} at={draft.started_at} />
          <ScanStatusLine scan={scan} />
        </div>
      </div>
      <ScanFrameStrip frames={ScanProgress.frames(scan)} onOpen={(reportId) => sheets.open(feedbackPath(reportId))} />
      <div className="activity-card__actions">
        {(problem !== null || stage === 'failed') && (
          <Button variant="text" size="small" onClick={() => void snap.scans.retry((other) => other.id === scan.id)}>
            {t('activity.retry')}
          </Button>
        )}
        <ActivityDelete target={{ scan }} />
      </div>
    </li>
  );
}
