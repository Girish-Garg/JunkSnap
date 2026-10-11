import { useTranslation } from 'react-i18next';
import type { SitePhotoPreset } from '../../../domain/SitePhotoPreset';
import { Segmented } from '../../../ui/Segmented';
import type { GpsState } from '../hooks/useGpsFix';
import type { CaptureMode, SnapFlow } from '../hooks/useSnapFlow';
import '../nobin.css';
import { CameraStage } from './CameraStage';
import { NoBinStage } from './NoBinStage';
import { ScanStage } from './ScanStage';

const MODES: readonly CaptureMode[] = ['photo', 'video', 'nobin'];

interface CaptureStageProps {
  readonly flow: SnapFlow;
  readonly gps: GpsState;
  /** "Add a photo" on a site: a photo only, for that site. */
  readonly preset?: SitePhotoPreset | null;
}

/**
 * Photo (the default) or Video from the in-app camera, or No bin here from where you stand; No bin's photo keeps the
 * No bin type. A photo for a site is a photo only, and says which site it is for.
 */
export function CaptureStage({ flow, gps, preset = null }: CaptureStageProps) {
  const { t } = useTranslation();
  const modes = MODES.map((mode) => ({ value: mode, label: t(`snap.mode.${mode}`) }));
  const noBinPhoto = flow.mode === 'photo' && flow.presetType === 'no_bin';
  return (
    <>
      {preset ? (
        <p className="snap-preset" role="status">
          {t('addPhoto.preset', { type: t(`reportType.${preset.reportType}`) })}
        </p>
      ) : (
        <Segmented label={t('snap.mode.label')} options={modes} value={flow.mode} onChange={flow.setMode} disabled={flow.recording} />
      )}
      {noBinPhoto && (
        <p className="snap-preset" role="status">
          {t('nobin.photoFor')}
        </p>
      )}
      {flow.mode === 'photo' && <CameraStage flow={flow} gps={gps} />}
      {flow.mode === 'video' && <ScanStage flow={flow} gps={gps} />}
      {flow.mode === 'nobin' && <NoBinStage gps={gps} onPhoto={() => flow.photoFor('no_bin')} onSent={flow.noBinSent} />}
    </>
  );
}
