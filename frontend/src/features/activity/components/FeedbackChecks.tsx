import { useTranslation } from 'react-i18next';
import type { CheckItem } from '../../../domain/FeedbackChecklist';
import { FeedbackMark } from './FeedbackMark';

/** ✓, ✗ or – per check, with the model checks' strength in words, never a raw score. */
export function FeedbackChecks({ items }: { readonly items: readonly CheckItem[] }) {
  const { t } = useTranslation();
  return (
    <section className="feedback-checks" aria-labelledby="feedback-checks-title">
      <h3 id="feedback-checks-title" className="feedback-checks__title">
        {t('feedback.checksTitle')}
      </h3>
      <ul className="feedback-checks__list">
        {items.map((item) => (
          <li key={item.name} className="feedback-check">
            <FeedbackMark mark={item.mark} />
            <span className="feedback-check__text">{t(`feedback.check.${item.name}.${item.variant}`, { metres: item.metres })}</span>
            {item.band && <span className={`feedback-band feedback-band--${item.band}`}>{t(`feedback.band.${item.band}`)}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
