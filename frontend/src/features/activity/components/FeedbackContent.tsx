import { ReportOutcome } from '../../../domain/ReportOutcome';
import type { ReportStatusView } from '../../../domain/ReportStatus';
import { FeedbackBody } from './FeedbackBody';
import { WaitingFeedback } from './WaitingFeedback';

interface FeedbackContentProps {
  readonly view: ReportStatusView;
  /** Gets the status the reporter's answer returned (contracts v1.16). */
  readonly onAnswered: (view: ReportStatusView) => void;
}

/** Picks the outcome; only a report waiting in a site needs that site read too. */
export function FeedbackContent({ view, onAnswered }: FeedbackContentProps) {
  const kind = ReportOutcome.of(view);
  if (kind === 'waiting' && view.site_id) return <WaitingFeedback siteId={view.site_id} view={view} kind={kind} />;
  return <FeedbackBody view={view} kind={kind} site={null} onAnswered={onAnswered} />;
}
