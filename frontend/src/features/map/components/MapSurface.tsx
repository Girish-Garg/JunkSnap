import type { SiteFeature } from '../../../domain/Site';
import { ErrorBoundary } from '../../../ui/ErrorBoundary';
import type { SiteMapBindings } from '../hooks/useSiteMap';
import type { MapNoticeView } from '../MapNotice';
import { SiteList } from './SiteList';
import { SiteMapView } from './SiteMapView';

interface MapSurfaceProps extends SiteMapBindings {
  readonly listMode: boolean;
  readonly notice: MapNoticeView | null;
  readonly onOpen: (site: SiteFeature) => void;
}

// Three guards so the map can never take down the app: a WebGL2 check, a caught constructor, an error boundary.
export function MapSurface({ listMode, notice, onOpen, ...bindings }: MapSurfaceProps) {
  if (listMode) {
    return <SiteList sites={bindings.sites} notice={notice} onViewChange={bindings.onViewChange} onOpen={onOpen} />;
  }
  return (
    <ErrorBoundary onError={bindings.onFail}>
      <SiteMapView {...bindings} />
    </ErrorBoundary>
  );
}
