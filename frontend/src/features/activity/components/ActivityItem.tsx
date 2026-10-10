import { useTranslation } from 'react-i18next';
import type { QueuedReport } from '../../../domain/QueuedReport';
import { useFormatter } from '../../../i18n/useFormatter';
import { MarkerGlyph } from '../../../ui/MarkerGlyph';
import { ProgressBadge } from '../../snap/components/ProgressBadge';
import { ReportThumb } from '../../snap/components/ReportThumb';
import { ActivityActions } from './ActivityActions';

export function ActivityItem({ report }: { readonly report: QueuedReport }) {
  const { t } = useTranslation();
  const format = useFormatter();
  const { draft, status } = report.data;
  const blurred = status?.blurred_url ?? null;
  return (
    <li className="report-row">
      <ReportThumb key={blurred ?? 'none'} url={blurred} />
      <div className="report-row__body">
        <p className="report-row__title">
          <MarkerGlyph type={draft.report_type} size={16} />
          {t(`reportType.${draft.report_type}`)}
        </p>
        <p className="report-row__meta">
          {t(`context.${draft.context}`)} · {format.dateTime(draft.captured_at)}
        </p>
        <ProgressBadge report={report} />
        <ActivityActions report={report} />
      </div>
    </li>
  );
}
