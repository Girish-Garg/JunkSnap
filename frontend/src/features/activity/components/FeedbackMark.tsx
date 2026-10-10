import { useTranslation } from 'react-i18next';
import type { CheckMark } from '../../../domain/FeedbackChecklist';
import { Icon } from '../../../ui/Icon';

/** ✓ passed, ✗ did not pass, – skipped; the word is the accessible name, so colour is never the only cue. */
export function FeedbackMark({ mark }: { readonly mark: CheckMark }) {
  const { t } = useTranslation();
  return (
    <span className={`feedback-mark feedback-mark--${mark}`} role="img" aria-label={t(`feedback.mark.${mark}`)}>
      {mark === 'pass' && <Icon name="check" size={16} />}
      {mark === 'fail' && <Icon name="close" size={16} />}
      {mark === 'skip' && <span className="feedback-mark__dash" />}
    </span>
  );
}
