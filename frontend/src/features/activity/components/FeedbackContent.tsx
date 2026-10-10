import { ReportOutcome } from '../../../domain/ReportOutcome';
import type { ReportStatusView } from '../../../domain/ReportStatus';
import { FeedbackBody } from './FeedbackBody';
import { WaitingFeedback } from './WaitingFeedback';

/** Picks the outcome; only a report waiting in a site needs that site read too. */
export function FeedbackContent({ view }: { readonly view: ReportStatusView }) {
  const kind = ReportOutcome.of(view);
  if (kind === 'waiting' && view.site_id) return <WaitingFeedback siteId={view.site_id} view={view} kind={kind} />;
  return <FeedbackBody view={view} kind={kind} site={null} />;
}
