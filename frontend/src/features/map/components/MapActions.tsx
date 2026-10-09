import { useTranslation } from 'react-i18next';
import { Icon } from '../../../ui/Icon';
import { IconButton } from '../../../ui/IconButton';

interface MapActionsProps {
  readonly onLocate: () => void;
  readonly onSnap: () => void;
}

export function MapActions({ onLocate, onSnap }: MapActionsProps) {
  const { t } = useTranslation();
  return (
    <div className="map-actions">
      <IconButton icon="locate" label={t('map.locate')} onClick={onLocate} variant="surface" />
      <button type="button" className="fab" onClick={onSnap}>
        <Icon name="camera" />
        {t('map.snap')}
      </button>
    </div>
  );
}
