import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { BottomSheet } from '../../../ui/BottomSheet';
import { Button } from '../../../ui/Button';
import { Illustration } from '../../../ui/Illustration';
import '../actions.css';

const TITLE_ID = 'sheet-crash-title';

/** What a route sheet shows when its content crashed: the map and the rest of the app keep working. */
export function SheetCrash({ onRetry }: { readonly onRetry: () => void }) {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  const close = useCallback(() => sheets.close('/'), [sheets]);
  return (
    <BottomSheet labelledBy={TITLE_ID} closeLabel={t('crash.close')} resizeLabel={t('sheet.resize')} onClose={close}>
      <div className="sheet-crash" role="alert">
        <Illustration name="offline" size={104} />
        <h2 id={TITLE_ID} className="sheet-crash__title" tabIndex={-1}>
          {t('crash.title')}
        </h2>
        <p className="sheet-crash__text">{t('crash.text')}</p>
        <div className="sheet-crash__buttons">
          <Button onClick={onRetry}>{t('crash.retry')}</Button>
          <Button variant="text" onClick={close}>
            {t('crash.close')}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
