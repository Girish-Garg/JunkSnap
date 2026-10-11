import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useShareLinks } from '../../../app/useShareLinks';
import type { SiteProperties } from '../../../domain/Site';
import { useLocationPresenter } from './useLocationPresenter';
import { useShareLink } from './useShareLink';

/**
 * "Ask neighbours to confirm": the site's usual share link (the api's link preview in live mode) with a short
 * message naming what the spot is (a dump, a bin, water...), where it is and how far it is from its 10 people, so
 * people nearby can back it.
 */
export function useAskNeighbours(site: SiteProperties) {
  const { t } = useTranslation();
  const links = useShareLinks();
  const place = useLocationPresenter(site.location).nearby();
  const { share, copied } = useShareLink();
  const { site_id: siteId, report_type: type, backers } = site;
  const ask = useCallback(() => {
    const spot = t(`ask.spot.${type}`);
    const text = t('ask.text', { spot, place, count: backers.count, needed: backers.needed });
    share(t(`reportType.${type}`), links.site(siteId), text);
  }, [t, place, backers, share, type, links, siteId]);
  return { ask, copied };
}
