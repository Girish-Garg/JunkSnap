import { Navigate, Route, Routes } from 'react-router';
import { MapPage } from '../features/map/components/MapPage';
import { SitePanelRoute } from '../features/site/components/SitePanelRoute';
import { SnapRoute } from '../features/snap/components/SnapRoute';
import { SITE_PATH, SNAP_PATH } from './paths';

// The map stays mounted; sheets are child routes.
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MapPage />}>
        <Route index element={null} />
        <Route path={SITE_PATH} element={<SitePanelRoute />} />
        <Route path={SNAP_PATH} element={<SnapRoute />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
