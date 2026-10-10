import { useSite } from '../../site/hooks/useSite';
import { FeedbackBody, type FeedbackBodyProps } from './FeedbackBody';

interface WaitingFeedbackProps extends Omit<FeedbackBodyProps, 'site'> {
  readonly siteId: string;
}

/** A report waiting for neighbours: reads its site for the "n of 10" count and the share link. */
export function WaitingFeedback({ siteId, view, kind }: WaitingFeedbackProps) {
  const { site } = useSite(siteId);
  return <FeedbackBody view={view} kind={kind} site={site} />;
}
