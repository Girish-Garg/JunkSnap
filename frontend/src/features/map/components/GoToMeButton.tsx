import { useTranslation } from 'react-i18next';
import { Icon } from '../../../ui/Icon';
import '../browse.css';

/** Offered when the person's location is known but off the map: the map opens on the pilot city regardless. */
export function GoToMeButton({ onGo }: { readonly onGo: () => void }) {
  const { t } = useTranslation();
  return (
    <button type="button" className="pill go-to-me" onClick={onGo}>
      <Icon name="locate" size={18} />
      {t('map.goToMe')}
    </button>
  );
}
