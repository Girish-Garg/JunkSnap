import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { BottomSheet } from '../../../ui/BottomSheet';
import { Icon } from '../../../ui/Icon';

const TITLE_ID = 'activity-title';

// Placeholder: the list of the user's reports and letters arrives with F2 and F4.
export function ActivityRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const close = useCallback(() => navigate('/'), [navigate]);
  return (
    <BottomSheet labelledBy={TITLE_ID} closeLabel={t('activity.close')} resizeLabel={t('sheet.resize')} onClose={close}>
      <h2 id={TITLE_ID} className="sheet-title" tabIndex={-1}>
        {t('activity.title')}
      </h2>
      <p className="sheet-text">{t('activity.text')}</p>
      <div className="empty-state">
        <Icon name="activity" />
        <p>{t('activity.empty')}</p>
      </div>
    </BottomSheet>
  );
}
