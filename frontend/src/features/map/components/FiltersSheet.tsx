import { useTranslation } from 'react-i18next';
import { useServices } from '../../../app/useServices';
import { MAP_MODES, type MapMode } from '../../../domain/MapMode';
import type { SiteFeature } from '../../../domain/Site';
import { BottomSheet } from '../../../ui/BottomSheet';
import { Segmented } from '../../../ui/Segmented';
import type { MapPageState } from '../hooks/useMapPage';
import { FilterTypeRows } from './FilterTypeRows';

const TITLE_ID = 'filters-title';

interface FiltersSheetProps {
  readonly filters: MapPageState['filters'];
  readonly sites: readonly SiteFeature[];
  readonly onClose: () => void;
}

export function FiltersSheet({ filters, sites, onClose }: FiltersSheetProps) {
  const { t } = useTranslation();
  const { config } = useServices();
  const modes = MAP_MODES.map((mode) => ({ value: mode, label: t(`filters.mode.${mode}`) }));
  return (
    <BottomSheet labelledBy={TITLE_ID} closeLabel={t('filters.close')} resizeLabel={t('sheet.resize')} onClose={onClose}>
      <h2 id={TITLE_ID} className="sheet-title" tabIndex={-1}>
        {t('filters.title')}
      </h2>
      <p className="facts__title filters__label">{t('filters.mapView')}</p>
      <Segmented<MapMode> label={t('filters.mapView')} options={modes} value={filters.mode} onChange={filters.setMode} />
      <p className="facts__title filters__label">{t('filters.types')}</p>
      <FilterTypeRows filter={filters.filter} onChange={filters.setFilter} sites={sites} />
      {config.isSampleData() && <p className="form__note filters__label">{t('filters.sampleNote')}</p>}
    </BottomSheet>
  );
}
