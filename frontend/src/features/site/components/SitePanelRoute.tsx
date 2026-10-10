import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { BottomSheet } from '../../../ui/BottomSheet';
import { useMapContext } from '../../map/useMapContext';
import { useSite } from '../hooks/useSite';
import { SITE_TITLE_ID, SitePanel } from './SitePanel';
import { SitePanelPending } from './SitePanelPending';

export function SitePanelRoute() {
  const { t } = useTranslation();
  const { siteId = '' } = useParams();
  const navigate = useNavigate();
  const { userLocation, showSite } = useMapContext();
  const { site, failed, reload } = useSite(siteId);
  const close = useCallback(() => navigate('/'), [navigate]);
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
      {site ? <SitePanel site={site} userLocation={userLocation} onChanged={reload} /> : <SitePanelPending titleId={SITE_TITLE_ID} failed={failed} />}
    </BottomSheet>
  );
}
