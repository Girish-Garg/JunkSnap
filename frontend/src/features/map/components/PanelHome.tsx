import { useTranslation } from 'react-i18next';
import { sitePath } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import type { SiteFeature } from '../../../domain/Site';
import { EmptyState } from '../../../ui/EmptyState';
import { DESKTOP_QUERY, useMediaQuery } from '../../../ui/useMediaQuery';
import { useMapContext } from '../useMapContext';
import { SiteListItem } from './SiteListItem';

const TITLE_ID = 'panel-home-title';

/** Desktop side panel with no sheet open: the reports in view, each opening its sheet. Phones show the map only. */
export function PanelHome() {
  const { t } = useTranslation();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const { sites, showSite } = useMapContext();
  const sheets = useSheetNavigation();
  if (!desktop) return null;
  const open = (site: SiteFeature) => {
    showSite(site);
    sheets.open(sitePath(site.properties.site_id));
  };
  return (
    <section className="panel-home" aria-labelledby={TITLE_ID}>
      <h2 id={TITLE_ID} className="panel-home__title">
        {t('panel.title')} <span className="panel-home__count num">{sites.length}</span>
      </h2>
      <p className="sheet-text">{t('panel.text')}</p>
      {sites.length === 0 ? (
        <EmptyState art="clean" title={t('panel.emptyTitle')} text={t('panel.emptyText')} />
      ) : (
        <ul className="site-rows stagger">
          {sites.map((site) => (
            <SiteListItem key={site.properties.site_id} site={site} onOpen={open} />
          ))}
        </ul>
      )}
    </section>
  );
}
