import { useTranslation } from 'react-i18next';

const TIPS = ['closer', 'daylight', 'frame'] as const;

/** For a photo the checks turned down: how to take one they can confirm. */
export function RetakeTips() {
  const { t } = useTranslation();
  return (
    <details className="feedback-tips">
      <summary className="feedback-tips__summary">{t('feedback.tips.title')}</summary>
      <p className="feedback-tips__text">{t('feedback.tips.text')}</p>
      <ul className="feedback-tips__list">
        {TIPS.map((tip) => (
          <li key={tip}>{t(`feedback.tips.${tip}`)}</li>
        ))}
      </ul>
    </details>
  );
}
