import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RANKING_PATH } from '../../../app/paths';
import { SheetLink } from '../../../app/SheetLink';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { BottomSheet } from '../../../ui/BottomSheet';
import { TextField } from '../../../ui/TextField';
import '../areas.css';
import { useAreaDirectory } from '../hooks/useAreaDirectory';
import { AreaDirectoryList } from './AreaDirectoryList';

const TITLE_ID = 'areas-title';

/** Pick a ward, assembly seat, Lok Sabha seat or district of the pilot city or the map's own districts. */
export function AreasRoute() {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  const close = useCallback(() => sheets.close('/'), [sheets]);
  const [query, setQuery] = useState('');
  const directory = useAreaDirectory(query);
  return (
    <BottomSheet labelledBy={TITLE_ID} closeLabel={t('areas.close')} resizeLabel={t('sheet.resize')} onClose={close}>
      <h2 id={TITLE_ID} className="sheet-title" tabIndex={-1}>
        {t('areas.title')}
      </h2>
      <p className="sheet-text">{t('areas.intro')}</p>
      <SheetLink className="area-back" to={RANKING_PATH}>
        {t('ranking.open')}
      </SheetLink>
      <div className="area-search">
        <TextField id="area-search" label={t('areas.search')} value={query} onChange={setQuery} autoComplete="off" />
      </div>
      <AreaDirectoryList state={directory} query={query} />
    </BottomSheet>
  );
}
