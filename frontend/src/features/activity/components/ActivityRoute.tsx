import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { BottomSheet } from '../../../ui/BottomSheet';
import '../../../ui/form.css';
import { Icon } from '../../../ui/Icon';
import '../../snap/snap.css';
import { useActivity } from '../hooks/useActivity';
import { ActivityItem } from './ActivityItem';

const TITLE_ID = 'activity-title';

/** Reports from this phone: the device's own report ids, guest or signed in. */
export function ActivityRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const close = useCallback(() => navigate('/'), [navigate]);
  const reports = useActivity();
  return (
    <BottomSheet labelledBy={TITLE_ID} closeLabel={t('activity.close')} resizeLabel={t('sheet.resize')} onClose={close}>
      <h2 id={TITLE_ID} className="sheet-title" tabIndex={-1}>
        {t('activity.title')}
      </h2>
      <p className="sheet-text">{t('activity.text')}</p>
      {reports.length === 0 ? (
        <div className="empty-state">
          <Icon name="activity" />
          <p>{t('activity.empty')}</p>
        </div>
      ) : (
        <ul className="report-list">
          {reports.map((report) => (
            <ActivityItem key={report.id} report={report} />
          ))}
        </ul>
      )}
    </BottomSheet>
  );
}
