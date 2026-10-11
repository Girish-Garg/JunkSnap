import { useTranslation } from 'react-i18next';
import type { SitePhotoPreset } from '../../../domain/SitePhotoPreset';
import type { GpsState } from '../hooks/useGpsFix';
import type { SnapFlow } from '../hooks/useSnapFlow';
import { CaptureStage } from './CaptureStage';
import { NoBinSentStage } from './NoBinSentStage';
import { ReviewStage } from './ReviewStage';
import { ScanSentStage } from './ScanSentStage';
import { SentStage } from './SentStage';
import { SitePhotoReview } from './SitePhotoReview';

interface SnapStageProps {
  readonly flow: SnapFlow;
  readonly gps: GpsState;
  /** "Add a photo" on a site; null for an ordinary report. */
  readonly preset: SitePhotoPreset | null;
}

/** The stage for the flow's phase: camera, review (the site's own review when adding a photo to it), then progress. */
export function SnapStage({ flow, gps, preset }: SnapStageProps) {
  const { t } = useTranslation();
  const { phase } = flow;
  switch (phase.kind) {
    case 'camera':
      return <CaptureStage flow={flow} gps={gps} preset={preset} />;
    case 'review':
      return preset ? (
        <SitePhotoReview key={phase.photo.sha256} photo={phase.photo} flow={flow} preset={preset} />
      ) : (
        <ReviewStage key={phase.photo.sha256} photo={phase.photo} flow={flow} />
      );
    case 'sent':
      return (
        <>
          {preset && <p className="snap-preset">{t('addPhoto.joins')}</p>}
          <SentStage id={phase.id} onAgain={flow.restart} />
        </>
      );
    case 'scanSent':
      return <ScanSentStage id={phase.id} cameraStopped={phase.cameraStopped === true} onAgain={flow.restart} />;
    case 'noBinSent':
      return <NoBinSentStage onAgain={flow.restart} />;
  }
}
