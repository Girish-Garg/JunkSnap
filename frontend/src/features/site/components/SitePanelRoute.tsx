import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { useParams } from 'react-router';
import { BottomSheet } from '../../../ui/BottomSheet';
import { useMapContext } from '../../map/useMapContext';
import { useMergedSiteRedirect } from '../hooks/useMergedSiteRedirect';
import { useSite } from '../hooks/useSite';
import { SITE_TITLE_ID, SitePanel } from './SitePanel';
import { SitePanelPending } from './SitePanelPending';

export function SitePanelRoute() {
  const { t } = useTranslation();
  const { siteId = '' } = useParams();
  const sheets = useSheetNavigation();
  const { userLocation, showSite, refreshSites } = useMapContext();
  const { site, failed, missing, reload } = useSite(siteId);
  // A merged duplicate opens the site it merged into instead (decision 20261011-1730).
  const merged = useMergedSiteRedirect(site);
  const close = useCallback(() => sheets.close('/'), [sheets]);
  // A vote can clear or reject the site, so the map fetches again too.
  const changed = useCallback(() => {
    reload();
    refreshSites();
  }, [reload, refreshSites]);
  useEffect(() => {
    // A shared link may point outside the loaded area: move the map to the site.
    if (site) showSite(site);
  }, [site, showSite]);
  return (
    <BottomSheet
      labelledBy={SITE_TITLE_ID}
      closeLabel={t('site.close')}
      resizeLabel={t('sheet.resize')}
      onClose={close}
      focusKey={site?.properties.site_id ?? failed}
    >
      {site && !merged ? <SitePanel site={site} userLocation={userLocation} onChanged={changed} /> : <SitePanelPending titleId={SITE_TITLE_ID} failed={failed} missing={missing} onRetry={reload} />}
    </BottomSheet>
  );
}
