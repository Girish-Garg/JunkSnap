import { useTranslation } from 'react-i18next';
import type { QueuedReport } from '../../../domain/QueuedReport';
import { ReportRejection } from '../../../domain/ReportRejection';
import { Notice } from '../../../ui/Notice';
import '../rejection.css';

/** Under a report the models turned down: why, and a firm ask (issue 103). */
export function RejectionNotice({ report }: { readonly report: QueuedReport }) {
  const { t } = useTranslation();
  const reason = ReportRejection.reasonOf(report.data.status);
  if (reason === null) return null;
  return (
    <div className="report-rejection">
      <Notice icon="info" text={t(`rejection.${reason}`)} tone="alert" />
    </div>
  );
}
