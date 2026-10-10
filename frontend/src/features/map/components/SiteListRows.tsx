import { useEffect, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import { Button } from '../../../ui/Button';
import { useRovingFocus } from '../../../ui/useRovingFocus';
import { SiteCardRow } from './SiteCardRow';

// Rows render a page at a time: a city's 500 sites never mount at once.
export const LIST_PAGE = 30;

interface SiteListRowsProps {
  readonly sites: readonly SiteFeature[];
  readonly userLocation: LonLat | null;
  readonly chosen: string | null;
  readonly onChoose: (site: SiteFeature) => void;
}

/** The list's rows in order, with roving focus, a page at a time; back from the map lands on the row last opened. */
export function SiteListRows({ sites, userLocation, chosen, onChoose }: SiteListRowsProps) {
  const { t } = useTranslation();
  const chosenIndex = Math.max(sites.findIndex((site) => site.properties.site_id === chosen), 0);
  const [limit, setLimit] = useState(() => Math.max(LIST_PAGE, chosenIndex + 1));
  const shown = sites.slice(0, limit);
  const roving = useRovingFocus(shown.length, chosenIndex);
  const { list } = roving;
  useScrollToCurrent(list);
  return (
    <>
      <ul ref={list} className="site-rows site-list-rows stagger" aria-label={t('browse.label')} onKeyDown={roving.onKeyDown}>
        {shown.map((site, index) => (
          <SiteCardRow
            key={site.properties.site_id}
            site={site}
            userLocation={userLocation}
            current={site.properties.site_id === chosen}
            onChoose={onChoose}
            focus={roving.itemProps(index)}
          />
        ))}
      </ul>
      {sites.length > limit && (
        <Button variant="secondary" onClick={() => setLimit(limit + LIST_PAGE)}>
          {t('browse.more', { count: Math.min(LIST_PAGE, sites.length - limit) })}
        </Button>
      )}
    </>
  );
}

// Back from the map, the row last opened scrolls into view. A block body: newer browsers return a promise
// from scrollIntoView, and an effect may only return a cleanup.
function useScrollToCurrent(list: RefObject<HTMLUListElement | null>): void {
  useEffect(() => {
    void list.current?.querySelector('[aria-current]')?.scrollIntoView?.({ block: 'nearest' });
  }, [list]);
}
