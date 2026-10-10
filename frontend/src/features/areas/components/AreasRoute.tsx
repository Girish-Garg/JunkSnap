import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { RANKING_PATH } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { AREA_KINDS } from '../../../domain/AreaKey';
import { BottomSheet } from '../../../ui/BottomSheet';
import { EmptyState } from '../../../ui/EmptyState';
import { TextField } from '../../../ui/TextField';
import '../areas.css';
import { useAreaDirectory } from '../hooks/useAreaDirectory';
import { AreaGroup } from './AreaGroup';

const TITLE_ID = 'areas-title';

/** Pick a ward, assembly seat, Lok Sabha seat or district from the sites on the map. */
export function AreasRoute() {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  const close = useCallback(() => sheets.close('/'), [sheets]);
  const [query, setQuery] = useState('');
  const entries = useAreaDirectory(query);
  return (
    <BottomSheet labelledBy={TITLE_ID} closeLabel={t('areas.close')} resizeLabel={t('sheet.resize')} onClose={close}>
      <h2 id={TITLE_ID} className="sheet-title" tabIndex={-1}>
        {t('areas.title')}
      </h2>
      <p className="sheet-text">{t('areas.intro')}</p>
      <Link className="area-back" to={RANKING_PATH} state={sheets.linkState}>
        {t('ranking.open')}
      </Link>
      <div className="area-search">
        <TextField id="area-search" label={t('areas.search')} value={query} onChange={setQuery} autoComplete="off" />
      </div>
      {entries.length === 0 && query && <p className="sheet-text">{t('areas.noMatch')}</p>}
      {entries.length === 0 && !query && <EmptyState art="clean" title={t('areas.noneTitle')} text={t('areas.none')} />}
      {AREA_KINDS.map((kind) => (
        <AreaGroup key={kind} kind={kind} entries={entries.filter((entry) => entry.area.kind === kind)} />
      ))}
    </BottomSheet>
  );
}
