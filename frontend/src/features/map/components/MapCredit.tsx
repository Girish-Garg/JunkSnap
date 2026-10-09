import { useTranslation } from 'react-i18next';

// Required map attribution; it replaces MapLibre's control so it can be translated.
export function MapCredit() {
  const { t } = useTranslation();
  return (
    <p className="map-credit">
      <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">
        OpenFreeMap
      </a>{' '}
      <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer">
        © OpenMapTiles
      </a>{' '}
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
        {t('map.osmCredit')}
      </a>
    </p>
  );
}
