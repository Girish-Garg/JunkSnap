import { useEffect, useEffectEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { BBox } from '../../../domain/BBox';
import type { SiteFeature } from '../../../domain/Site';
import { Icon } from '../../../ui/Icon';
import { useAppTextKey } from '../../../ui/useNativeBridge';
import type { MapNoticeView } from '../MapNotice';
import type { MapView } from '../SiteMap';
import { MapStatus } from './MapStatus';
import { SiteListItem } from './SiteListItem';

// Same opening view as SiteMap: Jodhpur, one API query wide.
const FALLBACK_VIEW: MapView = { bbox: BBox.around([73.02, 26.27], 0.99) };

interface SiteListProps {
  readonly sites: readonly SiteFeature[];
  readonly notice: MapNoticeView | null;
  readonly onViewChange: (view: MapView) => void;
  readonly onOpen: (site: SiteFeature) => void;
}

/** Without WebGL2 the Map tab lists nearby sites instead; tapping one opens the same site sheet. */
export function SiteList({ sites, notice, onViewChange, onOpen }: SiteListProps) {
  const { t } = useTranslation();
  const textKey = useAppTextKey('map.fallback', 'map.fallbackApp');
  const hintKey = useAppTextKey('map.fallbackHint', 'map.fallbackHintApp');
  const requestSites = useEffectEvent(() => onViewChange(FALLBACK_VIEW));
  useEffect(() => requestSites(), []);
  return (
    <section className="site-list" aria-label={t('map.listLabel')}>
      <p className="site-list__notice" role="status">
        <Icon name="info" size={20} />
        <span>
          {t(textKey)} <span className="site-list__hint">{t(hintKey)}</span>
        </span>
      </p>
      {/* MapNotice says "No reports here yet." only once loading has finished. */}
      <MapStatus notice={notice} />
      <ul className="site-list__items">
        {sites.map((site) => (
          <SiteListItem key={site.properties.site_id} site={site} onOpen={onOpen} />
        ))}
      </ul>
    </section>
  );
}
