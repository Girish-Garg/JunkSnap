import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSiteMap, type SiteMapBindings } from '../hooks/useSiteMap';

export function SiteMapView(props: SiteMapBindings) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  useSiteMap(containerRef, props);
  return <div ref={containerRef} className="map-canvas" role="region" aria-label={t('map.label')} />;
}
