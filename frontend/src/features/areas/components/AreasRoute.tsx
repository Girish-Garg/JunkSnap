import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { AREA_KINDS } from '../../../domain/AreaKey';
import { BottomSheet } from '../../../ui/BottomSheet';
import { TextField } from '../../../ui/TextField';
import '../areas.css';
import { useAreaDirectory } from '../hooks/useAreaDirectory';
import { AreaGroup } from './AreaGroup';

const TITLE_ID = 'areas-title';

/** Pick a ward, assembly seat, Lok Sabha seat or district from the sites on the map. */
export function AreasRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const close = useCallback(() => navigate('/'), [navigate]);
  const [query, setQuery] = useState('');
  const entries = useAreaDirectory(query);
  return (
    <BottomSheet labelledBy={TITLE_ID} closeLabel={t('areas.close')} resizeLabel={t('sheet.resize')} onClose={close}>
      <h2 id={TITLE_ID} className="sheet-title" tabIndex={-1}>
        {t('areas.title')}
      </h2>
      <p className="sheet-text">{t('areas.intro')}</p>
      <div className="area-search">
        <TextField id="area-search" label={t('areas.search')} value={query} onChange={setQuery} autoComplete="off" />
      </div>
      {entries.length === 0 && <p className="sheet-text">{t(query ? 'areas.noMatch' : 'areas.none')}</p>}
      {AREA_KINDS.map((kind) => (
        <AreaGroup key={kind} kind={kind} entries={entries.filter((entry) => entry.area.kind === kind)} />
      ))}
    </BottomSheet>
  );
}
