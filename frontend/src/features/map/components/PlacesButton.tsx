import { useTranslation } from 'react-i18next';
import { PLACES_PATH } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { Icon } from '../../../ui/Icon';
import '../browse.css';

/**
 * The way to "Places with reports", beside Filters on phones and desktop. The pill says "Places"; its name for
 * a screen reader is the list's whole title. A second press while the list is open opens no second copy.
 */
export function PlacesButton() {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  return (
    <button type="button" className="pill places-pill" aria-label={t('places.title')} title={t('places.title')} onClick={() => sheets.up(PLACES_PATH)}>
      <Icon name="pin" size={18} />
      {t('places.button')}
    </button>
  );
}
