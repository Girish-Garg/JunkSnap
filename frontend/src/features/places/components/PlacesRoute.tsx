import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { BottomSheet } from '../../../ui/BottomSheet';
import { Skeleton } from '../../../ui/Skeleton';
import { useMapContext } from '../../map/useMapContext';
import '../../site/site.css';
import { useReportedPlaces, type PlaceRow } from '../hooks/useReportedPlaces';
import '../places.css';
import { PlaceItem } from './PlaceItem';

const TITLE_ID = 'places-title';

/**
 * /places, "Places with reports": where the reported sites are, with how many each place has. Picking a place fits
 * the map to its sites and closes the list. The pilot city is listed at once, before any count has loaded.
 */
export function PlacesRoute() {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  const { frame } = useMapContext();
  const places = useReportedPlaces();
  const close = useCallback(() => sheets.close('/'), [sheets]);
  const pick = (row: PlaceRow) => {
    frame(row.points);
    close();
  };
  const note = places.failed ? t('places.failed') : places.loading ? t('places.loading') : '';
  return (
    <BottomSheet labelledBy={TITLE_ID} closeLabel={t('places.close')} resizeLabel={t('sheet.resize')} onClose={close}>
      <h2 id={TITLE_ID} className="sheet-title" tabIndex={-1}>
        {t('places.title')}
      </h2>
      <p className="sheet-text">{t('places.intro')}</p>
      <ul className="site-rows place-rows" aria-label={t('places.listLabel')}>
        {places.rows.map((row) => (
          <PlaceItem key={row.place.area.key} row={row} onPick={pick} />
        ))}
      </ul>
      {places.loading && <Skeleton height="56px" />}
      {/* Always in the page, so a screen reader hears it change: loading, then nothing, or that counts are missing. */}
      <p className="form__note place-rows__note" role="status">{note}</p>
    </BottomSheet>
  );
}
