import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { sitePath } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { BottomSheet } from '../../../ui/BottomSheet';
import '../../../ui/form.css';
import { useSite } from '../../site/hooks/useSite';
import { useGpsFix } from '../../snap/hooks/useGpsFix';
import '../../snap/snap.css';
import { useCleanup } from '../hooks/useCleanup';
import { CleanupCamera } from './CleanupCamera';
import { CleanupReview } from './CleanupReview';
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
  const site = useSite(siteId);
  return (
    <BottomSheet labelledBy={TITLE_ID} closeLabel={t('cleanup.close')} resizeLabel={t('sheet.resize')} onClose={close} initial="full" focusKey={flow.phase}>
      <h2 id={TITLE_ID} className="sheet-title" tabIndex={-1}>
        {t(flow.phase === 'sent' ? 'cleanup.sentTitle' : 'cleanup.title')}
      </h2>
      {flow.phase === 'camera' && <p className="sheet-text">{t('cleanup.text')}</p>}
      {flow.phase === 'camera' && <CleanupCamera flow={flow} gps={gps} />}
      {flow.phase === 'review' && flow.photo && <CleanupReview photo={flow.photo} flow={flow} />}
      {flow.phase === 'sent' && <CleanupStatus site={site.site} siteId={siteId} reload={site.reload} />}
    </BottomSheet>
  );
}
