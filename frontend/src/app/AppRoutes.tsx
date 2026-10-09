import { Navigate, Route, Routes } from 'react-router';
import { AreasRoute } from '../features/areas/components/AreasRoute';
import { AccountRoute } from '../features/auth/components/AccountRoute';
import { MapPage } from '../features/map/components/MapPage';
import { SitePanelRoute } from '../features/site/components/SitePanelRoute';
import { SnapRoute } from '../features/snap/components/SnapRoute';
import { ACCOUNT_PATH, AREAS_PATH, SITE_PATH, SNAP_PATH } from './paths';

// The map stays mounted; every other screen is a sheet over it.
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MapPage />}>
        <Route index element={null} />
        <Route path={SITE_PATH} element={<SitePanelRoute />} />
        <Route path={SNAP_PATH} element={<SnapRoute />} />
        <Route path={AREAS_PATH} element={<AreasRoute />} />
        <Route path={ACCOUNT_PATH} element={<AccountRoute />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
