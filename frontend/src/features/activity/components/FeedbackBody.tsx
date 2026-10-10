import { FeedbackChecklist } from '../../../domain/FeedbackChecklist';
import type { OutcomeKind } from '../../../domain/ReportOutcome';
import type { ReportStatusView } from '../../../domain/ReportStatus';
import type { SiteFeature } from '../../../domain/Site';
import { ConfirmPrompt } from './ConfirmPrompt';
import { FeedbackChecks } from './FeedbackChecks';
import { FeedbackJudge } from './FeedbackJudge';
import { FeedbackNext } from './FeedbackNext';
import { FeedbackOutcome } from './FeedbackOutcome';

export interface FeedbackBodyProps {
  readonly view: ReportStatusView;
  readonly kind: OutcomeKind;
  /** The site the report waits in, for its backer count and share link; null otherwise. */
  readonly site: SiteFeature | null;
  /** Gets the status the reporter's answer returned, for a report the check was unsure about. */
  readonly onAnswered?: (view: ReportStatusView) => void;
}

/** The outcome, the AI check's reason (or the question when it was unsure), the checklist and what the reporter can do next. */
export function FeedbackBody({ view, kind, site, onAnswered }: FeedbackBodyProps) {
  return (
    <div className="feedback stagger">
      <FeedbackOutcome view={view} kind={kind} site={site} />
      {kind === 'asking' ? <ConfirmPrompt view={view} onAnswered={onAnswered} /> : <FeedbackJudge view={view} />}
      <FeedbackChecks items={FeedbackChecklist.of(view)} />
      <FeedbackNext kind={kind} site={site} />
    </div>
  );
}
