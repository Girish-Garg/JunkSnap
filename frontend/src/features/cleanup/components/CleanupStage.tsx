import { useTranslation } from 'react-i18next';
import type { Blocked } from '../../../domain/ActionAvailability';
import { RouteLocked } from '../../actions/components/RouteLocked';
import type { GpsState } from '../../snap/hooks/useGpsFix';
import type { CleanupFlow } from '../hooks/useCleanup';
import { CleanupCamera } from './CleanupCamera';
import { CleanupReview } from './CleanupReview';

interface CleanupStageProps {
  readonly flow: CleanupFlow;
  readonly gps: GpsState;
  /** Why this site takes no cleanup photo (off the map, one already checking); null when it does. */
  readonly locked: Blocked | null;
  readonly onBack: () => void;
}

/** Before Send: the camera, then the review; or why there is nothing to photograph here. */
export function CleanupStage({ flow, gps, locked, onBack }: CleanupStageProps) {
  const { t } = useTranslation();
  if (locked) return <RouteLocked reason={locked} backLabel={t('gate.back')} onBack={onBack} />;
  if (flow.phase === 'review' && flow.photo) return <CleanupReview photo={flow.photo} flow={flow} />;
  if (flow.phase !== 'camera') return null;
  return (
    <>
      <p className="sheet-text">{t('cleanup.text')}</p>
      <CleanupCamera flow={flow} gps={gps} />
    </>
  );
}
