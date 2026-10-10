import { useTranslation } from 'react-i18next';
import type { LonLat } from '../../../domain/Site';
import { SITE_SORTS, type SiteSort } from '../../../domain/SiteOrder';
import { BottomSheet } from '../../../ui/BottomSheet';
import { Segmented } from '../../../ui/Segmented';
import type { SiteBrowser } from '../hooks/useSiteBrowser';
import '../browse.css';
import { FiltersButton } from './FiltersButton';
import { SiteListEmpty } from './SiteListEmpty';
import { SiteListRows } from './SiteListRows';

const TITLE_ID = 'site-list-title';
const SORT_KEYS: Readonly<Record<SiteSort, string>> = { nearest: 'browse.sortNearest', newest: 'browse.sortNewest', backed: 'browse.sortBacked' };

interface SiteListSheetProps {
  readonly browser: SiteBrowser;
  readonly userLocation: LonLat | null;
  readonly filters: { readonly activeCount: number; readonly onOpen: () => void };
  readonly onClose: () => void;
}

/** The list view: the sites in view (or in Jodhpur when the view has none) as compact cards, sorted and filtered. */
export function SiteListSheet({ browser, userLocation, filters, onClose }: SiteListSheetProps) {
  const { t } = useTranslation();
  const { sites, fallback } = browser.rows;
  const title = fallback ? t('browse.cityTitle') : t('browse.title', { count: sites.length });
  const sorts = SITE_SORTS.map((sort) => ({ value: sort, label: t(SORT_KEYS[sort]) }));
  return (
    <BottomSheet labelledBy={TITLE_ID} closeLabel={t('browse.close')} resizeLabel={t('sheet.resize')} onClose={onClose}>
      <div className="site-list-sheet__head">
        <h2 id={TITLE_ID} className="sheet-title" tabIndex={-1}>
          {title} {fallback && <span className="site-list-sheet__count num">{sites.length}</span>}
        </h2>
        <FiltersButton activeCount={filters.activeCount} onOpen={filters.onOpen} />
      </div>
      <div className="site-list-sheet__sort">
        <Segmented<SiteSort> label={t('browse.sort')} options={sorts} value={browser.sort} onChange={browser.setSort} />
      </div>
      <SiteListEmpty fallback={fallback} empty={sites.length === 0} loading={browser.pilot === null} onShowCity={browser.showCity} />
      {sites.length > 0 && (
        <SiteListRows key={browser.sort} sites={sites} userLocation={userLocation} chosen={browser.chosen} onChoose={browser.choose} />
      )}
    </BottomSheet>
  );
}
