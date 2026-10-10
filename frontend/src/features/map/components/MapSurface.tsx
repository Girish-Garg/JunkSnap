import { useCallback, useState } from 'react';
import type { SiteFeature } from '../../../domain/Site';
import { ErrorBoundary } from '../../../ui/ErrorBoundary';
import type { SiteMapBindings } from '../hooks/useSiteMap';
import { MapSupport } from '../MapSupport';
import { SiteList } from './SiteList';
import { SiteMapView } from './SiteMapView';

interface MapSurfaceProps extends Omit<SiteMapBindings, 'onFail'> {
  readonly onOpen: (site: SiteFeature) => void;
}

// Three guards so the map can never take down the app: a WebGL2 check, a caught constructor, an error boundary.
export function MapSurface({ onOpen, ...bindings }: MapSurfaceProps) {
  const [failed, setFailed] = useState(() => !MapSupport.hasWebGl2());
  const fail = useCallback((error: unknown) => {
    console.error('The map could not start; showing the list instead', error);
    setFailed(true);
  }, []);
  if (failed) return <SiteList sites={bindings.sites} onViewChange={bindings.onViewChange} onOpen={onOpen} />;
  return (
    <ErrorBoundary onError={fail}>
      <SiteMapView {...bindings} onFail={fail} />
    </ErrorBoundary>
  );
}
