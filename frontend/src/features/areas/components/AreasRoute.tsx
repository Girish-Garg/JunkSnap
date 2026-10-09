import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { BottomSheet } from '../../../ui/BottomSheet';

const TITLE_ID = 'areas-title';

// Placeholder until F4 (area scores) replaces this route's element.
export function AreasRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const close = useCallback(() => navigate('/'), [navigate]);
  return (
    <BottomSheet labelledBy={TITLE_ID} closeLabel={t('areas.close')} resizeLabel={t('sheet.resize')} onClose={close}>
      <h2 id={TITLE_ID} className="sheet-title" tabIndex={-1}>
        {t('areas.title')}
      </h2>
      <p className="sheet-text">{t('areas.soon')}</p>
    </BottomSheet>
  );
}
