import { useTranslation } from 'react-i18next';
import type { QueuedReport } from '../../../domain/QueuedReport';
import { useFormatter } from '../../../i18n/useFormatter';
import { TypeIcon } from '../../../ui/TypeIcon';
import { NotWasteNotice } from '../../snap/components/NotWasteNotice';
import { ProgressBadge } from '../../snap/components/ProgressBadge';
import { ReportThumb } from '../../snap/components/ReportThumb';
import { ActivityActions } from './ActivityActions';

interface ActivityItemProps {
  readonly report: QueuedReport;
  /** Opens the viewer on this report's blurred copy; only offered once that copy exists. */
  readonly onOpen: () => void;
}

export function ActivityItem({ report, onOpen }: ActivityItemProps) {
  const { t } = useTranslation();
  const format = useFormatter();
  const { draft, status } = report.data;
  const blurred = status?.blurred_url ?? null;
  const thumb = <ReportThumb key={blurred ?? 'none'} url={blurred} />;
  return (
    <li className="report-row">
      {blurred ? (
        <button type="button" className="photo-open photo-open--thumb" title={t('viewer.open')} onClick={onOpen}>
          {thumb}
        </button>
      ) : (
        thumb
      )}
      <div className="report-row__body">
        <p className="report-row__title">
          <TypeIcon type={draft.report_type} size={16} />
          {t(`reportType.${draft.report_type}`)}
        </p>
        <p className="report-row__meta">
          {t(`context.${draft.context}`)} · {format.dateTime(draft.captured_at)}
        </p>
        <ProgressBadge report={report} />
        <NotWasteNotice report={report} />
        <ActivityActions report={report} />
      </div>
    </li>
  );
}
