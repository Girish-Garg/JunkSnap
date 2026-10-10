import { useTranslation } from 'react-i18next';
import { Icon } from '../../../ui/Icon';
import { PROGRESS_STEPS } from '../ReportProgress';

interface ProgressStepsProps {
  readonly done: number;
  readonly steps?: readonly string[];
  /** i18n prefix of the step labels. */
  readonly keyPrefix?: string;
}

export function ProgressSteps({ done, steps = PROGRESS_STEPS, keyPrefix = 'snap.steps' }: ProgressStepsProps) {
  const { t } = useTranslation();
  return (
    <ol className="steps">
      {steps.map((step, index) => (
        <li key={step} className={index < done ? 'steps__item steps__item--done' : 'steps__item'}>
          <span className="steps__mark" aria-hidden="true">
            {index < done && <Icon name="check" size={16} />}
          </span>
          {t(`${keyPrefix}.${step}`)}
        </li>
      ))}
    </ol>
  );
}
