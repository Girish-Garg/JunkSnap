import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { RANKING_PATH } from '../../../app/paths';
import { IconButton } from '../../../ui/IconButton';
import '../boundaries.css';

interface MapControlsProps {
  readonly onLocate: () => void;
}

/** The city ranking and my location, floating above the navigation. */
export function MapControls({ onLocate }: MapControlsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="map-controls">
      <IconButton icon="areas" label={t('ranking.open')} onClick={() => navigate(RANKING_PATH)} variant="float" />
      <IconButton icon="locate" label={t('map.locate')} onClick={onLocate} variant="float" />
    </div>
  );
}
