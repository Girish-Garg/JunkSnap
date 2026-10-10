import type { QueuedReport } from '../../../domain/QueuedReport';
import { RejectionNotice } from '../../snap/components/RejectionNotice';
import { ConfirmPrompt } from './ConfirmPrompt';

/** Under one of this phone's reports: why the models turned it down, or the question when the check was unsure. */
export function ReportNotices({ report }: { readonly report: QueuedReport }) {
  return (
    <>
      <RejectionNotice report={report} />
      <ConfirmPrompt view={report.data.status} />
    </>
  );
}
