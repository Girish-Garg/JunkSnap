import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { BottomSheet } from '../../../ui/BottomSheet';
import '../../../ui/form.css';
import '../../snap/snap.css';
import '../activity.css';
import { useActivity } from '../hooks/useActivity';
import { ActivityLists } from './ActivityLists';

const TITLE_ID = 'activity-title';

/** Photos and videos from this phone: the device's own ids, read back with the signed-in token. */
export function ActivityRoute() {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  const close = useCallback(() => sheets.close('/'), [sheets]);
  const { reports, scans } = useActivity();
  return (
    <BottomSheet labelledBy={TITLE_ID} closeLabel={t('activity.close')} resizeLabel={t('sheet.resize')} onClose={close}>
      <h2 id={TITLE_ID} className="sheet-title" tabIndex={-1}>
        {t('activity.title')}
      </h2>
      <p className="activity-subtitle">{t('activity.text')}</p>
      <ActivityLists reports={reports} scans={scans} />
    </BottomSheet>
  );
}
