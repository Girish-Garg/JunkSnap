import { useTranslation } from 'react-i18next';
import type { CaptureProblem } from '../../../domain/CaptureError';
import { Button } from '../../../ui/Button';
import { Illustration } from '../../../ui/Illustration';

interface CameraHelpProps {
  readonly problem: CaptureProblem;
  readonly onRetry: () => void;
}

/** Steps to let the in-app camera start; there is no gallery or phone-camera fallback. */
export function CameraHelp({ problem, onRetry }: CameraHelpProps) {
  const { t } = useTranslation();
  const steps = t(`snap.help.${problem}`, { returnObjects: true }) as unknown;
  return (
    <div className="camera-help">
      <Illustration name="camera" size={104} />
      <ol className="camera-help__steps">
        {(Array.isArray(steps) ? steps : []).map((step: string) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <Button onClick={onRetry}>{t('snap.tryAgain')}</Button>
    </div>
  );
}
