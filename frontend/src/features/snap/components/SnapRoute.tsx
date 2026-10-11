import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { SNAP_SITE_PARAM } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { BottomSheet } from '../../../ui/BottomSheet';
import '../../../ui/form.css';
import { useGpsFix } from '../hooks/useGpsFix';
import { useSitePhotoPreset } from '../hooks/useSitePhotoPreset';
import { useSnapFlow, type SnapPhase } from '../hooks/useSnapFlow';
import '../snap.css';
import { SnapStage } from './SnapStage';

const TITLE_ID = 'snap-title';

const TITLES: Readonly<Record<SnapPhase['kind'], string>> = {
  camera: 'snap.title',
  review: 'snap.reviewTitle',
  sent: 'snap.sentTitle',
  scanSent: 'scan.sentTitle',
  noBinSent: 'snap.sentTitle',
};

// Until the site is read there is no camera, so no photo leaves as a new report by mistake.
const WAITING: Readonly<Record<string, string>> = { loading: 'addPhoto.loading', closed: 'addPhoto.closed', failed: 'addPhoto.failed' };

/** Photo or video, then the item's progress. GPS runs until the capture is saved. /snap?site=… adds a photo to that site. */
export function SnapRoute() {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  const close = useCallback(() => sheets.close('/'), [sheets]);
  const flow = useSnapFlow();
  const { phase } = flow;
  const gps = useGpsFix(phase.kind === 'camera' || phase.kind === 'review');
  const target = useSitePhotoPreset(useSearchParams()[0].get(SNAP_SITE_PARAM));
  const waiting = WAITING[target.kind];
  const title = target.kind !== 'none' && phase.kind !== 'sent' ? 'addPhoto.title' : TITLES[phase.kind];
  return (
    <BottomSheet labelledBy={TITLE_ID} closeLabel={t('snap.close')} resizeLabel={t('sheet.resize')} onClose={close} initial="full" focusKey={phase.kind}>
      <h2 id={TITLE_ID} className="sheet-title" tabIndex={-1}>
        {t(title)}
      </h2>
      {waiting ? (
        <p className="snap-preset" role="status">
          {t(waiting)}
        </p>
      ) : (
        <SnapStage flow={flow} gps={gps} preset={target.kind === 'ready' ? target.preset : null} />
      )}
    </BottomSheet>
  );
}
