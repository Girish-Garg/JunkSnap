import { FeedbackChecklist } from '../../../domain/FeedbackChecklist';
import type { OutcomeKind } from '../../../domain/ReportOutcome';
import type { ReportStatusView } from '../../../domain/ReportStatus';
import type { SiteFeature } from '../../../domain/Site';
import { FeedbackChecks } from './FeedbackChecks';
import { FeedbackJudge } from './FeedbackJudge';
import { FeedbackNext } from './FeedbackNext';
import { FeedbackOutcome } from './FeedbackOutcome';

export interface FeedbackBodyProps {
  readonly view: ReportStatusView;
  readonly kind: OutcomeKind;
  /** The site the report waits in, for its backer count and share link; null otherwise. */
  readonly site: SiteFeature | null;
}

/** The outcome, the AI check's reason, the checklist and what the reporter can do next. */
export function FeedbackBody({ view, kind, site }: FeedbackBodyProps) {
  return (
    <div className="feedback stagger">
      <FeedbackOutcome view={view} kind={kind} site={site} />
      <FeedbackJudge view={view} />
      <FeedbackChecks items={FeedbackChecklist.of(view)} />
      <FeedbackNext kind={kind} site={site} />
    </div>
  );
}
