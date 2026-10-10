import { useTranslation } from 'react-i18next';
import type { QueuedReport } from '../../../domain/QueuedReport';
import { ReportRejection } from '../../../domain/ReportRejection';
import { Notice } from '../../../ui/Notice';
import '../rejection.css';

/** Under a report the models turned down as not waste: why, and a firm ask (issue 103). */
export function NotWasteNotice({ report }: { readonly report: QueuedReport }) {
  const { t } = useTranslation();
  if (ReportRejection.reasonOf(report.data.status) === null) return null;
  return (
    <div className="report-rejection">
      <Notice icon="info" text={t('rejection.not_waste')} tone="alert" />
    </div>
  );
}
