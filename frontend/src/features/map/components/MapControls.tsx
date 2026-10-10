import { useTranslation } from 'react-i18next';
import { RANKING_PATH } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { IconButton } from '../../../ui/IconButton';
import '../boundaries.css';

interface MapControlsProps {
  readonly onLocate: () => void;
}

/** The city ranking and my location, floating above the navigation. */
export function MapControls({ onLocate }: MapControlsProps) {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  return (
    <div className="map-controls">
      <IconButton icon="areas" label={t('ranking.open')} onClick={() => sheets.open(RANKING_PATH)} variant="float" />
      <IconButton icon="locate" label={t('map.locate')} onClick={onLocate} variant="float" />
    </div>
  );
}
