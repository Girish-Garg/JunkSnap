import { useTranslation } from 'react-i18next';
import { IconButton } from '../../../ui/IconButton';
import type { BoundaryLayerState } from '../hooks/useBoundaryLayer';
import { BoundarySwitcher } from './BoundarySwitcher';

interface MapControlsProps {
  readonly onLocate: () => void;
  readonly boundary: BoundaryLayerState;
}

export function MapControls({ onLocate, boundary }: MapControlsProps) {
  const { t } = useTranslation();
  return (
    <div className="map-controls">
      <BoundarySwitcher boundary={boundary} />
      <IconButton icon="locate" label={t('map.locate')} onClick={onLocate} variant="float" />
    </div>
  );
}
