import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { sitePath } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { BottomSheet } from '../../../ui/BottomSheet';
import '../../../ui/form.css';
import { useSiteRouteGate } from '../../actions/hooks/useRouteGates';
import { useGpsFix } from '../../snap/hooks/useGpsFix';
import '../../snap/snap.css';
import { useCleanup } from '../hooks/useCleanup';
import { CleanupStage } from './CleanupStage';
import { CleanupStatus } from './CleanupStatus';

const TITLE_ID = 'cleanup-title';

/** "Report cleaned": an after-photo of the cleared place, checked like any report photo. */
export function CleanupRoute() {
  const { t } = useTranslation();
  const { siteId = '' } = useParams();
  const sheets = useSheetNavigation();
  const close = useCallback(() => sheets.close(sitePath(siteId)), [sheets, siteId]);
  const flow = useCleanup(siteId);
  const gps = useGpsFix(flow.phase === 'camera');
  const site = useSiteRouteGate(siteId, 'cleanup');
  // After Send the site is checking this very photo, so only a sheet that has not sent yet can be locked.
  const locked = flow.phase === 'sent' ? null : site.locked;
  return (
    <BottomSheet labelledBy={TITLE_ID} closeLabel={t('cleanup.close')} resizeLabel={t('sheet.resize')} onClose={close} initial="full" focusKey={flow.phase}>
      <h2 id={TITLE_ID} className="sheet-title" tabIndex={-1}>
        {t(flow.phase === 'sent' ? 'cleanup.sentTitle' : 'cleanup.title')}
      </h2>
      <CleanupStage flow={flow} gps={gps} locked={locked} onBack={close} />
      {flow.phase === 'sent' && <CleanupStatus site={site.site} siteId={siteId} reload={site.reload} />}
    </BottomSheet>
  );
}
