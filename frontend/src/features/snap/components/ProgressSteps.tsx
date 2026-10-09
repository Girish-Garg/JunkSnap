import { useTranslation } from 'react-i18next';
import { Icon } from '../../../ui/Icon';
import { PROGRESS_STEPS } from '../ReportProgress';

export function ProgressSteps({ done }: { readonly done: number }) {
  const { t } = useTranslation();
  return (
    <ol className="steps">
      {PROGRESS_STEPS.map((step, index) => (
        <li key={step} className={index < done ? 'steps__item steps__item--done' : 'steps__item'}>
          <span className="steps__mark" aria-hidden="true">
            {index < done && <Icon name="check" size={16} />}
          </span>
          {t(`snap.steps.${step}`)}
        </li>
      ))}
    </ol>
  );
}
