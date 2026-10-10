import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CaptureProblem } from '../../../domain/CaptureError';
import { NativeBridge } from '../../../services/NativeBridge';
import { Button } from '../../../ui/Button';
import { Illustration } from '../../../ui/Illustration';

interface CameraHelpProps {
  readonly problem: CaptureProblem;
  readonly onRetry: () => void;
}

/**
 * Steps to let the in-app camera start; there is no gallery or phone-camera fallback. Inside the
 * Android app a blocked camera has its own steps and a button to the app's settings.
 */
export function CameraHelp({ problem, onRetry }: CameraHelpProps) {
  const { t, i18n } = useTranslation();
  const native = useMemo(() => new NativeBridge(window), []);
  const inApp = native.canOpenAppSettings() && i18n.exists(`snap.helpApp.${problem}`);
  const steps = t(`snap.${inApp ? 'helpApp' : 'help'}.${problem}`, { returnObjects: true }) as unknown;
  return (
    <div className="camera-help">
      <Illustration name="camera" size={104} />
      <ol className="camera-help__steps">
        {(Array.isArray(steps) ? steps : []).map((step: string) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <Button onClick={onRetry}>{t('snap.tryAgain')}</Button>
      {inApp && (
        <Button variant="text" onClick={() => native.openAppSettings()}>
          {t('snap.openSettings')}
        </Button>
      )}
    </div>
  );
}
