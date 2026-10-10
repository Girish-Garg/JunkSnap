import { useTranslation } from 'react-i18next';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import { SiteSteps } from '../../../domain/SiteSteps';
import { Button } from '../../../ui/Button';
import { useRovingFocus } from '../../../ui/useRovingFocus';
import { useScrollToCurrent } from '../../../ui/useScrollToCurrent';
import { useRowPaging } from '../hooks/useRowPaging';
import { SiteCardRow } from './SiteCardRow';

interface SiteListRowsProps {
  readonly sites: readonly SiteFeature[];
  readonly userLocation: LonLat | null;
  readonly chosen: string | null;
  readonly onChoose: (site: SiteFeature) => void;
}

/** The list's rows in order, with roving focus, a page at a time; back from the map lands on the row last opened. */
export function SiteListRows({ sites, userLocation, chosen, onChoose }: SiteListRowsProps) {
  const { t } = useTranslation();
  const chosenIndex = (SiteSteps.at(sites, chosen ?? '')?.position ?? 1) - 1;
  const paging = useRowPaging(sites, chosenIndex);
  const { list, onKeyDown, itemProps } = useRovingFocus(paging.shown.length, chosenIndex);
  useScrollToCurrent(list);
  return (
    <>
      <ul ref={list} className="site-rows site-list-rows stagger" aria-label={t('browse.label')} onKeyDown={onKeyDown}>
        {paging.shown.map((site, index) => (
          <SiteCardRow
            key={site.properties.site_id}
            site={site}
            userLocation={userLocation}
            current={site.properties.site_id === chosen}
            onChoose={onChoose}
            focus={itemProps(index)}
          />
        ))}
      </ul>
      {paging.more > 0 && (
        <Button variant="secondary" onClick={paging.showMore}>
          {t('browse.more', { count: paging.more })}
        </Button>
      )}
    </>
  );
}
