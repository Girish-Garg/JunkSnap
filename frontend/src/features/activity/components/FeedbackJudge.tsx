import { useTranslation } from 'react-i18next';
import { JudgeQuote } from '../../../domain/JudgeQuote';
import type { ReportStatusView } from '../../../domain/ReportStatus';

/**
 * The AI check's short reason about the reporter's own blurred photo, cleaned first (RationaleSanitizer).
 * Only the owner can read GET /reports/{id}, so only the reporter ever sees it.
 */
export function FeedbackJudge({ view }: { readonly view: ReportStatusView }) {
  const { t } = useTranslation();
  const quote = JudgeQuote.of(view);
  if (!quote) return null;
  const label = quote.label ? t('feedback.judge.label', { model: quote.label.model, provider: quote.label.provider }) : t('feedback.judge.labelPlain');
  const fallback = t(quote.agreed ? 'feedback.judge.genericAgreed' : 'feedback.judge.genericDisagreed');
  return (
    <figure className="feedback-judge">
      <figcaption className="feedback-judge__label">{label}</figcaption>
      <blockquote className="feedback-judge__quote" lang={quote.text ? 'en' : undefined}>
        {quote.text ?? fallback}
      </blockquote>
      <p className="feedback-judge__small">
        {quote.label && <span className="feedback-judge__model">{quote.label.exact}</span>}
        <span>{t('feedback.judge.private')}</span>
      </p>
    </figure>
  );
}
