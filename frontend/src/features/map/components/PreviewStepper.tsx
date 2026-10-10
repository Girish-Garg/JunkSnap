import { useTranslation } from 'react-i18next';
import { AreaName } from '../../../domain/AreaName';
import type { SiteFeature } from '../../../domain/Site';
import type { SiteSteps } from '../../../domain/SiteSteps';
import { Icon } from '../../../ui/Icon';
import '../browse.css';

interface PreviewStepperProps {
  readonly steps: SiteSteps;
  readonly onStep: (site: SiteFeature) => void;
}

/**
 * Previous and next in the list's order, for the preview card to host. At an end the button stays focusable but
 * aria-disabled, so focus never drops to the page; each step announces the site's type, area and place in the list.
 */
export function PreviewStepper({ steps, onStep }: PreviewStepperProps) {
  const { t } = useTranslation();
  const { properties } = steps.current();
  const position = { position: steps.position, total: steps.total };
  const announce = t('browse.announce', { type: t(`reportType.${properties.report_type}`), area: AreaName.of(properties.location), ...position });
  return (
    <div className="preview-stepper" role="group" aria-label={t('browse.label')}>
      <StepButton site={steps.previous()} icon="previous" label={t('browse.previous')} onStep={onStep} />
      <span className="preview-stepper__position num" aria-hidden="true">
        {t('browse.position', position)}
      </span>
      <StepButton site={steps.next()} icon="next" label={t('browse.next')} onStep={onStep} />
      <span className="visually-hidden" aria-live="polite">
        {announce}
      </span>
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
    <button type="button" className="preview-stepper__button" aria-label={label} title={label} aria-disabled={!site} onClick={() => site && onStep(site)}>
      <Icon name={icon} size={20} />
    </button>
  );
}
