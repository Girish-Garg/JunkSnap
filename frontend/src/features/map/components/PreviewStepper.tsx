import { useTranslation } from 'react-i18next';
import type { SiteFeature } from '../../../domain/Site';
import type { SiteSteps } from '../../../domain/SiteSteps';
import { Icon } from '../../../ui/Icon';
import '../browse.css';

interface PreviewStepperProps {
  readonly steps: SiteSteps;
  readonly onStep: (site: SiteFeature) => void;
}

/** Previous and next in the list's order, for the preview card to host; the ends have no further step. */
export function PreviewStepper({ steps, onStep }: PreviewStepperProps) {
  const { t } = useTranslation();
  const [previous, next] = [steps.previous(), steps.next()];
  return (
    <div className="preview-stepper" role="group" aria-label={t('browse.label')}>
      <StepButton site={previous} icon="previous" label={t('browse.previous')} onStep={onStep} />
      <span className="preview-stepper__position num" aria-live="polite">
        {t('browse.position', { position: steps.position, total: steps.total })}
      </span>
      <StepButton site={next} icon="next" label={t('browse.next')} onStep={onStep} />
    </div>
  );
}

interface StepButtonProps {
  readonly site: SiteFeature | null;
  readonly icon: 'previous' | 'next';
  readonly label: string;
  readonly onStep: (site: SiteFeature) => void;
}

function StepButton({ site, icon, label, onStep }: StepButtonProps) {
  return (
    <button type="button" className="preview-stepper__button" aria-label={label} title={label} disabled={!site} onClick={() => site && onStep(site)}>
      <Icon name={icon} size={20} />
    </button>
  );
}
