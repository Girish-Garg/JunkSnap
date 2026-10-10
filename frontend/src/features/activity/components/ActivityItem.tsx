import { useTranslation } from 'react-i18next';
import type { QueuedReport } from '../../../domain/QueuedReport';
import { TypeIcon } from '../../../ui/TypeIcon';
import { ProgressBadge } from '../../snap/components/ProgressBadge';
import { ReportThumb } from '../../snap/components/ReportThumb';
import { ActivityActions } from './ActivityActions';
import { ActivityMeta } from './ActivityMeta';
import { ReportNotices } from './ReportNotices';

interface ActivityItemProps {
  readonly report: QueuedReport;
  /** Opens the viewer on this report's blurred copy; only offered once that copy exists. */
  readonly onOpen: () => void;
}

/** One photo report as a card: thumbnail beside type, place and time, and status; actions along the foot. */
export function ActivityItem({ report, onOpen }: ActivityItemProps) {
  const { t } = useTranslation();
  const { draft, status } = report.data;
  const blurred = status?.blurred_url ?? null;
  const thumb = <ReportThumb key={blurred ?? 'none'} url={blurred} />;
  return (
    <li className="activity-card">
      <div className="activity-card__head">
        {blurred ? (
          <button type="button" className="photo-open activity-card__thumb" title={t('viewer.open')} onClick={onOpen}>
            {thumb}
          </button>
        ) : (
          <span className="activity-card__thumb">{thumb}</span>
        )}
        <div className="activity-card__body">
          <p className="activity-card__title">
            <TypeIcon type={draft.report_type} size={20} />
            {t(`reportType.${draft.report_type}`)}
          </p>
          <ActivityMeta place={t(`context.${draft.context}`)} at={draft.captured_at} />
          <ProgressBadge report={report} />
        </div>
      </div>
      <ReportNotices report={report} />
      <ActivityActions report={report} />
    </li>
  );
}
