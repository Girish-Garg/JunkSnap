import { useTranslation } from 'react-i18next';
import { Icon } from '../../../ui/Icon';
import { usePilotName } from '../hooks/usePilotName';
import '../browse.css';

/**
 * "Reports are in Jodhpur · View": the quiet way back while the map is away from the pilot city with no site on
 * it. It only offers; the map never moves there by itself.
 */
export function PilotChip({ onView }: { readonly onView: () => void }) {
  const { t } = useTranslation();
  const city = usePilotName();
  return (
    <button type="button" className="pill pilot-chip" onClick={onView}>
      <Icon name="pin" size={18} />
      <span>
        {t('places.chip', { city })} · <span className="pilot-chip__view">{t('places.view')}</span>
      </span>
    </button>
  );
}
