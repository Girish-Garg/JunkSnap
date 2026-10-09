import { useTranslation } from 'react-i18next';
import { IconButton } from '../../../ui/IconButton';

interface MapControlsProps {
  readonly onLocate: () => void;
}

export function MapControls({ onLocate }: MapControlsProps) {
  const { t } = useTranslation();
  return (
    <div className="map-controls">
      <IconButton icon="locate" label={t('map.locate')} onClick={onLocate} variant="float" />
    </div>
  );
}
