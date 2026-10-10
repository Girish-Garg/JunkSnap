import { useTranslation } from 'react-i18next';
import { ReportOutcome, type OutcomeKind } from '../../../domain/ReportOutcome';
import type { ReportStatusView } from '../../../domain/ReportStatus';
import type { SiteFeature } from '../../../domain/Site';
import { ReportThumb } from '../../snap/components/ReportThumb';

interface FeedbackOutcomeProps {
  readonly view: ReportStatusView;
  readonly kind: OutcomeKind;
  readonly site: SiteFeature | null;
}

function useHeadline(kind: OutcomeKind, site: SiteFeature | null): string {
  const { t } = useTranslation();
  if (kind !== 'waiting' || !site) return t(`feedback.outcome.${kind}`);
  const { count, needed } = site.properties.backers;
  return t('feedback.outcome.waitingCount', { count: Math.min(count, needed), needed });
}

/** The outcome in plain words, why, and for a photo the checks stopped, which check it was. */
export function FeedbackOutcome({ view, kind, site }: FeedbackOutcomeProps) {
  const { t } = useTranslation();
  const headline = useHeadline(kind, site);
  const reason = kind === 'stopped' ? view.moderation?.reasons?.[0] : undefined;
  return (
    <div className={`feedback-outcome feedback-outcome--${ReportOutcome.tone(kind)}`}>
      <ReportThumb key={view.blurred_url ?? 'none'} url={view.blurred_url} />
      <div className="feedback-outcome__text" role="status">
        <p className="feedback-outcome__headline">{headline}</p>
        <p className="feedback-outcome__explain">{t(`feedback.explain.${kind}`)}</p>
        {reason && <p className="feedback-outcome__explain">{t(`feedback.reason.${reason}`)}</p>}
      </div>
    </div>
  );
}
