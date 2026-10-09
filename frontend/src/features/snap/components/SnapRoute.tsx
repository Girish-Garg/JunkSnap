import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { BottomSheet } from '../../../ui/BottomSheet';
import { Icon } from '../../../ui/Icon';

const TITLE_ID = 'snap-title';

// Placeholder until F2 (in-app camera capture) replaces this route's element.
export function SnapRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const close = useCallback(() => navigate('/'), [navigate]);
  return (
    <BottomSheet labelledBy={TITLE_ID} closeLabel={t('snap.close')} resizeLabel={t('sheet.resize')} onClose={close}>
      <h2 id={TITLE_ID} className="sheet-title" tabIndex={-1}>
        <Icon name="camera" />
        {t('snap.title')}
      </h2>
      <p className="sheet-text">{t('snap.soon')}</p>
    </BottomSheet>
  );
}
