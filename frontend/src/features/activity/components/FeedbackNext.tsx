import { ReportOutcome, type OutcomeKind } from '../../../domain/ReportOutcome';
import type { SiteFeature } from '../../../domain/Site';
import { FeedbackShare } from './FeedbackShare';
import { RetakeTips } from './RetakeTips';

interface FeedbackNextProps {
  readonly kind: OutcomeKind;
  readonly site: SiteFeature | null;
}

/** "Think this is wrong?": share the site so neighbours can check, or tips for a better photo. There is no appeal. */
export function FeedbackNext({ kind, site }: FeedbackNextProps) {
  if (kind === 'waiting' && site) return <FeedbackShare site={site} />;
  if (ReportOutcome.suggestsRetake(kind)) return <RetakeTips />;
  return null;
}
