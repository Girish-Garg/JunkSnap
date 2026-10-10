import { useTranslation } from 'react-i18next';
import { useServices } from '../../../app/useServices';
import { MAP_MODES, type MapMode } from '../../../domain/MapMode';
import { BottomSheet } from '../../../ui/BottomSheet';
import { Segmented } from '../../../ui/Segmented';
import { useHistoryLayer } from '../../../ui/useHistoryLayer';
import type { MapPageState } from '../hooks/useMapPage';
import { FilterTypeRows } from './FilterTypeRows';

const TITLE_ID = 'filters-title';

interface FiltersSheetProps {
  readonly filters: MapPageState['filters'];
  readonly onClose: () => void;
}

export function FiltersSheet({ filters, onClose }: FiltersSheetProps) {
  const { t } = useTranslation();
  const { config } = useServices();
  // Its own history entry: back closes the sheet rather than leaving the map.
  const dismiss = useHistoryLayer('filters', true, onClose);
  const modes = MAP_MODES.map((mode) => ({ value: mode, label: t(`filters.mode.${mode}`) }));
  return (
    <BottomSheet labelledBy={TITLE_ID} closeLabel={t('filters.close')} resizeLabel={t('sheet.resize')} onClose={() => dismiss()}>
      <h2 id={TITLE_ID} className="sheet-title" tabIndex={-1}>
        {t('filters.title')}
      </h2>
      <p className="facts__title filters__label">{t('filters.mapView')}</p>
      <Segmented<MapMode> label={t('filters.mapView')} options={modes} value={filters.mode} onChange={filters.setMode} />
      <p className="facts__title filters__label">{t('filters.types')}</p>
      {/* Counts cover the sites loaded for this view, never totals; the note says when that is less than the view. */}
      <p className="form__note filters__scope">{t(`filters.scope.${filters.counts?.scope ?? 'view'}`)}</p>
      <FilterTypeRows filter={filters.filter} onChange={filters.setFilter} counts={filters.counts} />
      {config.isSampleData() && <p className="form__note filters__label">{t('filters.sampleNote')}</p>}
    </BottomSheet>
  );
}
