import { useTranslation } from 'react-i18next';
import { Segmented } from '../../../ui/Segmented';
import type { GpsState } from '../hooks/useGpsFix';
import type { CaptureMode, SnapFlow } from '../hooks/useSnapFlow';
import { CameraStage } from './CameraStage';
import { NoBinStage } from './NoBinStage';
import { ScanStage } from './ScanStage';

const MODES: readonly CaptureMode[] = ['photo', 'video', 'nobin'];

interface CaptureStageProps {
  readonly flow: SnapFlow;
  readonly gps: GpsState;
}

/** Photo (the default) or Video from the in-app camera, or No bin here from where you stand. */
export function CaptureStage({ flow, gps }: CaptureStageProps) {
  const { t } = useTranslation();
  const modes = MODES.map((mode) => ({ value: mode, label: t(`snap.mode.${mode}`) }));
  return (
    <>
      <Segmented label={t('snap.mode.label')} options={modes} value={flow.mode} onChange={flow.setMode} />
      {flow.mode === 'photo' && <CameraStage flow={flow} gps={gps} />}
      {flow.mode === 'video' && <ScanStage flow={flow} gps={gps} />}
      {flow.mode === 'nobin' && <NoBinStage gps={gps} onPhoto={() => flow.setMode('photo')} />}
    </>
  );
}
